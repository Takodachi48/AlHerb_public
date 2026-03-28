/* eslint-disable no-console */
const path = require('path');
const fs = require('fs');
const mongoose = require('mongoose');
require('dotenv').config();

const Herb = require('../src/models/Herb');
const Phytochemical = require('../src/models/Phytochemical');
const HerbInteraction = require('../src/models/HerbInteraction');
const {
  parseArgs,
  readRows,
  splitList,
  parseBoolean,
  parseNumber,
  pickHeaderValue,
} = require('./import-helpers');

const dbUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/herb-app';

const normalizeEnum = (value, allowed, fallback = undefined) => {
  const normalized = String(value || '').trim().toLowerCase();
  if (allowed.includes(normalized)) return normalized;
  return fallback;
};

const parseSources = (value) => splitList(value, ';').map((item) => {
  const [citation = '', pubmedId = '', yearRaw = ''] = item.split('|').map((part) => part.trim());
  if (!citation && !pubmedId && !yearRaw) return null;
  const year = parseNumber(yearRaw);
  return {
    citation,
    pubmedId,
    year,
  };
}).filter(Boolean);

const run = async () => {
  const args = parseArgs(process.argv.slice(2));
  const file = args.file || path.resolve(process.cwd(), 'data for importing (excel)', 'herbinteractions.xlsx');
  const sheet = args.sheet || 'HerbInteractions';
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
        const type = normalizeEnum(pickHeaderValue(row, 'interactswith.type'), ['herb', 'drug']);
        const effect = String(pickHeaderValue(row, 'effect') || '').trim();
        const severity = normalizeEnum(
          pickHeaderValue(row, 'severity'),
          ['minor', 'moderate', 'major', 'contraindicated'],
        );
        const recommendation = String(pickHeaderValue(row, 'recommendation') || '').trim();

        if (!herbId || !type || !effect || !severity || !recommendation) {
          console.log(`Row ${rowNum}: missing required fields or herb not found, skipping`);
          skipped += 1;
          continue;
        }

        const doc = {
          herbId,
          interactsWith: {
            type,
            herbId: undefined,
            drugName: undefined,
            drugClass: undefined,
            genericNames: undefined,
          },
          mechanism: {
            compound: resolveCompoundId(pickHeaderValue(row, 'mechanism.compound')) || undefined,
            description: pickHeaderValue(row, 'mechanism.description') || '',
          },
          effect,
          severity,
          recommendation,
          interactionType: normalizeEnum(
            pickHeaderValue(row, 'interactiontype'),
            ['synergistic', 'antagonistic', 'additive', 'adverse', 'unknown'],
            undefined,
          ),
          management: pickHeaderValue(row, 'management') || '',
          evidence: {
            level: normalizeEnum(
              pickHeaderValue(row, 'evidence.level'),
              ['theoretical', 'case_report', 'observational', 'clinical_trial', 'traditional_use'],
              'theoretical',
            ),
            quality: normalizeEnum(
              pickHeaderValue(row, 'evidence.quality'),
              ['low', 'moderate', 'high'],
              undefined,
            ),
          },
          sources: parseSources(pickHeaderValue(row, 'sources')),
          verified: parseBoolean(pickHeaderValue(row, 'verified'), false),
          isActive: parseBoolean(pickHeaderValue(row, 'isactive'), true),
        };

        let existing = null;

        if (type === 'herb') {
          const targetHerbName = pickHeaderValue(row, 'interactswith.herbid');
          const targetHerbId = resolveHerbId(targetHerbName);
          if (!targetHerbId) {
            console.log(`Row ${rowNum}: target herb not found for "${targetHerbName}", skipping`);
            skipped += 1;
            continue;
          }

          doc.interactsWith.herbId = targetHerbId;
          existing = await HerbInteraction.findOne({
            'interactsWith.type': 'herb',
            $or: [
              { herbId, 'interactsWith.herbId': targetHerbId },
              { herbId: targetHerbId, 'interactsWith.herbId': herbId },
            ],
          });
        } else {
          const drugName = String(pickHeaderValue(row, 'interactswith.drugname') || '').trim();
          if (!drugName) {
            console.log(`Row ${rowNum}: drug interaction missing drugName, skipping`);
            skipped += 1;
            continue;
          }
          doc.interactsWith.drugName = drugName;
          doc.interactsWith.drugClass = pickHeaderValue(row, 'interactswith.drugclass') || '';
          doc.interactsWith.genericNames = splitList(pickHeaderValue(row, 'interactswith.genericnames'));

          existing = await HerbInteraction.findOne({
            herbId,
            'interactsWith.type': 'drug',
            'interactsWith.drugName': drugName,
          });
        }

        if (dryRun) {
          if (existing) updated += 1;
          else inserted += 1;
          continue;
        }

        if (existing) {
          Object.assign(existing, doc);
          await existing.save();
          updated += 1;
        } else {
          await HerbInteraction.create(doc);
          inserted += 1;
        }
      } catch (error) {
        console.log(`Row ${rowNum}: ${error.message}`);
        rowErrors += 1;
      }
    }

    console.log(
      `HerbInteraction import complete: inserted=${inserted}, updated=${updated}, skipped=${skipped}, errors=${rowErrors}, dryRun=${dryRun}`,
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


