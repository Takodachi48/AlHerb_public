/* eslint-disable no-console */
const path = require('path');
const fs = require('fs');
const mongoose = require('mongoose');
require('dotenv').config();

const Herb = require('../src/models/Herb');
const Phytochemical = require('../src/models/Phytochemical');
const Contraindication = require('../src/models/Contraindication');
const {
  parseArgs,
  readRows,
  splitList,
  parseBoolean,
  pickHeaderValue,
} = require('./import-helpers');

const dbUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/herb-app';

const normalizeSeverity = (value) => {
  const normalized = String(value || '').trim().toLowerCase();
  return ['relative', 'absolute'].includes(normalized) ? normalized : null;
};

const parseSources = (value) => splitList(value, ';').map((item) => {
  const [citation = '', url = ''] = item.split('|').map((part) => part.trim());
  if (!citation && !url) return null;
  return { citation, url };
}).filter(Boolean);

const run = async () => {
  const args = parseArgs(process.argv.slice(2));
  const file = args.file || path.resolve(process.cwd(), 'data for importing (excel)', 'contraindications.xlsx');
  const sheet = args.sheet || 'Contraindications';
  const dryRun = Boolean(args.dryRun);

  if (!fs.existsSync(file)) {
    throw new Error(`File not found: ${file}`);
  }

  const rows = readRows(file, sheet);
  if (rows.length === 0) {
    console.log('No rows found to import.');
    return;
  }

  await mongoose.connect(dbUri);
  console.log('Connected to MongoDB');

  try {
    const herbs = await Herb.find({}).select('_id name scientificName slug').lean();
    const compounds = await Phytochemical.find({}).select('_id name alternateNames').lean();

    const herbByName = new Map();
    for (const herb of herbs) {
      [herb.scientificName, herb.name, herb.slug, herb._id].forEach((key) => {
        if (key) herbByName.set(String(key).trim().toLowerCase(), String(herb._id));
      });
    }

    const compoundByName = new Map();
    for (const compound of compounds) {
      [compound.name, ...(compound.alternateNames || [])].forEach((key) => {
        if (key) compoundByName.set(String(key).trim().toLowerCase(), compound._id);
      });
    }

    const resolveHerbId = (value) => herbByName.get(String(value || '').trim().toLowerCase()) || null;
    const resolveCompoundId = (value) => compoundByName.get(String(value || '').trim().toLowerCase()) || null;

    let inserted = 0;
    let updated = 0;
    let skipped = 0;
    let rowErrors = 0;

    for (let index = 0; index < rows.length; index += 1) {
      const row = rows[index];
      const rowNum = index + 2;

      try {
        const herbName = pickHeaderValue(row, 'herbid');
        const herbId = resolveHerbId(herbName);
        const condition = String(pickHeaderValue(row, 'condition') || '').trim();
        const severity = normalizeSeverity(pickHeaderValue(row, 'severity'));
        const reason = String(pickHeaderValue(row, 'reason') || '').trim();

        if (!herbId) {
          console.log(`Row ${rowNum}: herb not found for "${herbName}", skipping`);
          skipped += 1;
          continue;
        }
        if (!condition || !severity || !reason) {
          console.log(`Row ${rowNum}: missing condition/severity/reason, skipping`);
          skipped += 1;
          continue;
        }

        const alternatives = splitList(pickHeaderValue(row, 'alternatives'))
          .map(resolveHerbId)
          .filter(Boolean);

        const doc = {
          herbId,
          condition,
          severity,
          reason,
          causativeCompound: resolveCompoundId(pickHeaderValue(row, 'causativecompound')) || undefined,
          alternatives,
          sources: parseSources(pickHeaderValue(row, 'sources')),
          verified: parseBoolean(pickHeaderValue(row, 'verified'), false),
          isActive: parseBoolean(pickHeaderValue(row, 'isactive'), true),
        };

        if (dryRun) {
          updated += 1;
          continue;
        }

        const result = await Contraindication.updateOne(
          { herbId, condition },
          { $set: doc },
          { upsert: true },
        );
        if (result.upsertedCount > 0) inserted += 1;
        else updated += 1;
      } catch (error) {
        console.log(`Row ${rowNum}: ${error.message}`);
        rowErrors += 1;
      }
    }

    console.log(
      `Contraindication import complete: inserted=${inserted}, updated=${updated}, skipped=${skipped}, errors=${rowErrors}, dryRun=${dryRun}`,
    );
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB');
  }
};

run().catch((error) => {
  console.error('Import failed:', error.message);
  process.exit(1);
});


