/* eslint-disable no-console */
const path = require('path');
const fs = require('fs');
const mongoose = require('mongoose');
require('dotenv').config();

const Herb = require('../src/models/Herb');
const Phytochemical = require('../src/models/Phytochemical');
const HerbSafety = require('../src/models/HerbSafety');
const {
  parseArgs,
  readRows,
  splitList,
  parseBoolean,
  parseNumber,
  pickHeaderValue,
} = require('./import-helpers');

const dbUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/herb-app';

const normalizeEnum = (value, allowed, fallback) => {
  const normalized = String(value || '').trim().toLowerCase();
  return allowed.includes(normalized) ? normalized : fallback;
};

const buildSources = (value) => splitList(value, ';').map((item) => {
  const [citation = '', url = ''] = item.split('|').map((part) => part.trim());
  if (!citation && !url) return null;
  return { citation, url };
}).filter(Boolean);

const resolveDefaultFile = (providedFile) => {
  if (providedFile) return providedFile;

  const candidates = [
    path.resolve(process.cwd(), 'data for importing (excel)', 'herbsafety_v2.xlsx'),
    path.resolve(process.cwd(), '..', 'data for importing (excel)', 'herbsafety_v2.xlsx'),
    path.resolve(process.cwd(), 'data for importing (excel)', 'herbsafety.xlsx'),
    path.resolve(process.cwd(), '..', 'data for importing (excel)', 'herbsafety.xlsx'),
  ];

  const existing = candidates.find((candidate) => fs.existsSync(candidate));
  return existing || candidates[0];
};

const run = async () => {
  const args = parseArgs(process.argv.slice(2));
  const file = resolveDefaultFile(args.file);
  const sheet = args.sheet || 'HerbSafety';
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
      const keys = [compound.name, ...(compound.alternateNames || [])];
      keys.forEach((key) => {
        if (key) compoundByName.set(String(key).trim().toLowerCase(), compound._id);
      });
    }

    const resolveHerbId = (value) => herbByName.get(String(value || '').trim().toLowerCase()) || null;
    const resolveCompoundId = (value) => compoundByName.get(String(value || '').trim().toLowerCase()) || null;
    const resolveCompoundList = (value) => splitList(value).map(resolveCompoundId).filter(Boolean);

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
        if (!herbId) {
          console.log(`Row ${rowNum}: herb not found for "${herbName}", skipping`);
          skipped += 1;
          continue;
        }

        const medicalConditions = splitList(
          pickHeaderValue(row, 'medicalconditions'),
          ';',
        ).map((item) => {
          const [condition = '', recommendation = '', notes = '', compoundsRaw = ''] = item.split('|').map((part) => part.trim());
          if (!condition || !recommendation) return null;
          return {
            condition,
            recommendation: normalizeEnum(recommendation, ['safe', 'caution', 'avoid'], 'caution'),
            notes,
            causativeCompounds: resolveCompoundList(compoundsRaw),
          };
        }).filter(Boolean);

        const allergies = splitList(
          pickHeaderValue(row, 'allergies'),
          ';',
        ).map((item) => {
          const [allergen = '', severity = '', compoundName = '', notes = ''] = item.split('|').map((part) => part.trim());
          if (!allergen) return null;
          return {
            allergen,
            severity: normalizeEnum(severity, ['mild', 'moderate', 'severe'], 'mild'),
            causativeCompound: resolveCompoundId(compoundName) || undefined,
            notes,
          };
        }).filter(Boolean);

        const sideEffects = splitList(
          pickHeaderValue(row, 'sideeffects'),
          ';',
        ).map((item) => {
          const [effect = '', frequency = '', severity = '', compoundName = ''] = item.split('|').map((part) => part.trim());
          if (!effect) return null;
          return {
            effect,
            frequency: normalizeEnum(frequency, ['common', 'uncommon', 'rare'], 'rare'),
            severity: normalizeEnum(severity, ['mild', 'moderate', 'severe'], 'mild'),
            causativeCompound: resolveCompoundId(compoundName) || undefined,
          };
        }).filter(Boolean);

        const doc = {
          herbId,
          derivedFromCompounds: resolveCompoundList(pickHeaderValue(row, 'derivedfromcompounds')),
          pregnancy: {
            status: normalizeEnum(pickHeaderValue(row, 'pregnancy.status'), ['safe', 'caution', 'avoid', 'unknown'], 'unknown'),
            notes: pickHeaderValue(row, 'pregnancy.notes'),
            causativeCompounds: resolveCompoundList(pickHeaderValue(row, 'pregnancy.causativecompounds')),
            sources: buildSources(pickHeaderValue(row, 'pregnancy.sources')),
          },
          breastfeeding: {
            status: normalizeEnum(pickHeaderValue(row, 'breastfeeding.status'), ['safe', 'caution', 'avoid', 'unknown'], 'unknown'),
            notes: pickHeaderValue(row, 'breastfeeding.notes'),
            causativeCompounds: resolveCompoundList(pickHeaderValue(row, 'breastfeeding.causativecompounds')),
            sources: buildSources(pickHeaderValue(row, 'breastfeeding.sources')),
          },
          children: {
            status: normalizeEnum(pickHeaderValue(row, 'children.status'), ['safe', 'caution', 'avoid', 'unknown'], 'unknown'),
            minAge: parseNumber(pickHeaderValue(row, 'children.minage')),
            notes: pickHeaderValue(row, 'children.notes'),
            causativeCompounds: resolveCompoundList(pickHeaderValue(row, 'children.causativecompounds')),
            sources: buildSources(pickHeaderValue(row, 'children.sources')),
          },
          elderly: {
            status: normalizeEnum(pickHeaderValue(row, 'elderly.status'), ['safe', 'caution', 'avoid', 'unknown'], 'unknown'),
            notes: pickHeaderValue(row, 'elderly.notes'),
            causativeCompounds: resolveCompoundList(pickHeaderValue(row, 'elderly.causativecompounds')),
          },
          male: {
            status: normalizeEnum(pickHeaderValue(row, 'male.status'), ['safe', 'caution', 'avoid', 'unknown'], 'unknown'),
            notes: pickHeaderValue(row, 'male.notes'),
            causativeCompounds: resolveCompoundList(pickHeaderValue(row, 'male.causativecompounds')),
            sources: buildSources(pickHeaderValue(row, 'male.sources')),
          },
          female: {
            status: normalizeEnum(pickHeaderValue(row, 'female.status'), ['safe', 'caution', 'avoid', 'unknown'], 'unknown'),
            notes: pickHeaderValue(row, 'female.notes'),
            causativeCompounds: resolveCompoundList(pickHeaderValue(row, 'female.causativecompounds')),
            sources: buildSources(pickHeaderValue(row, 'female.sources')),
          },
          medicalConditions,
          allergies,
          sideEffects,
          overdoseRisk: {
            level: normalizeEnum(pickHeaderValue(row, 'overdoserisk.level'), ['low', 'moderate', 'high'], 'low'),
            symptoms: splitList(pickHeaderValue(row, 'overdoserisk.symptoms')),
            treatment: pickHeaderValue(row, 'overdoserisk.treatment'),
          },
          verified: parseBoolean(pickHeaderValue(row, 'verified'), false),
        };

        const safetyProfile = {
          pregnancy: doc.pregnancy.status,
          breastfeeding: doc.breastfeeding.status,
          children: doc.children.status,
          elderly: doc.elderly.status,
          male: doc.male.status,
          female: doc.female.status,
          medicalConditions: medicalConditions.map((item) => ({
            condition: item.condition,
            recommendation: item.recommendation,
            notes: item.notes || '',
          })),
          lastComputedAt: new Date(),
        };

        if (dryRun) {
          updated += 1;
          continue;
        }

        const result = await HerbSafety.updateOne(
          { herbId },
          { $set: doc },
          { upsert: true },
        );
        if (result.upsertedCount > 0) inserted += 1;
        else updated += 1;

        await Herb.updateOne(
          { _id: herbId },
          {
            $set: {
              safetyProfile,
            },
          },
        );
      } catch (error) {
        console.log(`Row ${rowNum}: ${error.message}`);
        rowErrors += 1;
      }
    }

    console.log(
      `HerbSafety import complete: inserted=${inserted}, updated=${updated}, skipped=${skipped}, errors=${rowErrors}, dryRun=${dryRun}`,
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


