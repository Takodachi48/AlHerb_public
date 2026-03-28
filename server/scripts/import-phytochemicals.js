/* eslint-disable no-console */
const path = require('path');
const fs = require('fs');
const mongoose = require('mongoose');
require('dotenv').config();

const Phytochemical = require('../src/models/Phytochemical');
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

const normalizeCategory = (value) => {
  const normalized = String(value || '').trim().toLowerCase();
  if (['alkaloids', 'flavonoids', 'terpenoids', 'phenolic_compounds', 'glycosides', 'essential_oils', 'tannins', 'saponins', 'other'].includes(normalized)) {
    return normalized;
  }
  if (normalized.includes('alkaloid')) return 'alkaloids';
  if (normalized.includes('flavonoid')) return 'flavonoids';
  if (normalized.includes('terpene')) return 'terpenoids';
  if (normalized.includes('phenol')) return 'phenolic_compounds';
  if (normalized.includes('glycoside')) return 'glycosides';
  if (normalized.includes('essential oil')) return 'essential_oils';
  if (normalized.includes('tannin')) return 'tannins';
  if (normalized.includes('saponin')) return 'saponins';
  return 'other';
};

const parseInteractionItems = (value) => splitList(value, ';').map((item) => {
  const [
    drugClass = '',
    genericNamesRaw = '',
    effect = '',
    severityRaw = '',
    mechanism = '',
    evidenceLevelRaw = '',
    evidenceQualityRaw = '',
  ] = item.split('|').map((part) => part.trim());

  if (!drugClass || !effect) return null;
  return {
    drugClass,
    genericNames: splitList(genericNamesRaw),
    effect,
    severity: normalizeEnum(severityRaw, ['minor', 'moderate', 'major', 'contraindicated'], 'moderate'),
    mechanism,
    evidence: {
      level: normalizeEnum(
        evidenceLevelRaw,
        ['theoretical', 'case_report', 'observational', 'clinical_trial', 'traditional_use'],
        'theoretical',
      ),
      quality: normalizeEnum(evidenceQualityRaw, ['low', 'moderate', 'high'], undefined),
    },
  };
}).filter(Boolean);

const parseSafetyConditions = (value) => splitList(value, ';').map((item) => {
  const [condition = '', recommendationRaw = '', notes = ''] = item.split('|').map((part) => part.trim());
  if (!condition || !recommendationRaw) return null;
  return {
    condition,
    recommendation: normalizeEnum(recommendationRaw, ['safe', 'caution', 'avoid'], 'caution'),
    notes,
  };
}).filter(Boolean);

const parseAllergyRisk = (value) => splitList(value, ';').map((item) => {
  const [allergen = '', severityRaw = '', notes = ''] = item.split('|').map((part) => part.trim());
  if (!allergen) return null;
  return {
    allergen,
    severity: normalizeEnum(severityRaw, ['mild', 'moderate', 'severe'], 'mild'),
    notes,
  };
}).filter(Boolean);

const parseSideEffects = (value) => splitList(value, ';').map((item) => {
  const [effect = '', frequencyRaw = '', severityRaw = ''] = item.split('|').map((part) => part.trim());
  if (!effect) return null;
  return {
    effect,
    frequency: normalizeEnum(frequencyRaw, ['common', 'uncommon', 'rare'], 'rare'),
    severity: normalizeEnum(severityRaw, ['mild', 'moderate', 'severe'], 'mild'),
  };
}).filter(Boolean);

const parseSources = (value) => {
  const entries = splitList(value, ';');
  if (!entries.length && String(value || '').trim()) {
    return [{ citation: String(value).trim() }];
  }
  return entries.map((item) => {
    const [citation = '', pubmedId = '', url = '', yearRaw = ''] = item.split('|').map((part) => part.trim());
    if (!citation && !pubmedId && !url && !yearRaw) return null;
    return {
      citation,
      pubmedId,
      url,
      year: parseNumber(yearRaw),
    };
  }).filter(Boolean);
};

const resolveDefaultFile = (providedFile) => {
  if (providedFile) return providedFile;

  const candidates = [
    path.resolve(process.cwd(), 'data for importing (excel)', 'phytochemicals_v2.xlsx'),
    path.resolve(process.cwd(), '..', 'data for importing (excel)', 'phytochemicals_v2.xlsx'),
    path.resolve(process.cwd(), 'data for importing (excel)', 'phytochemicals.xlsx'),
    path.resolve(process.cwd(), '..', 'data for importing (excel)', 'phytochemicals.xlsx'),
  ];

  const existing = candidates.find((candidate) => fs.existsSync(candidate));
  return existing || candidates[0];
};

const run = async () => {
  const args = parseArgs(process.argv.slice(2));
  const file = resolveDefaultFile(args.file);
  const sheet = args.sheet || 'Phytochemicals';
  const dryRun = Boolean(args.dryRun);

  if (!fs.existsSync(file)) {
    throw new Error(`File not found: ${file}`);
  }

  const rows = readRows(file, sheet);
  if (!rows.length) {
    console.log('No rows to import.');
    return;
  }

  await mongoose.connect(dbUri);
  console.log('Connected to MongoDB');

  try {
    let inserted = 0;
    let updated = 0;
    let skipped = 0;
    let rowErrors = 0;

    for (let index = 0; index < rows.length; index += 1) {
      const row = rows[index];
      const rowNum = index + 2;
      try {
        const name = String(pickHeaderValue(row, 'name') || '').trim();
        if (!name) {
          skipped += 1;
          continue;
        }

        const doc = {
          name,
          alternateNames: splitList(pickHeaderValue(row, 'alternatenames')),
          category: normalizeCategory(pickHeaderValue(row, 'category')),
          description: pickHeaderValue(row, 'description') || '',
          effects: splitList(pickHeaderValue(row, 'effects')),
          drugInteractions: parseInteractionItems(pickHeaderValue(row, 'druginteractions')),
          safety: {
            pregnancy: {
              status: normalizeEnum(pickHeaderValue(row, 'safety.pregnancy.status'), ['safe', 'caution', 'avoid', 'unknown'], 'unknown'),
              notes: pickHeaderValue(row, 'safety.pregnancy.notes') || '',
            },
            breastfeeding: {
              status: normalizeEnum(pickHeaderValue(row, 'safety.breastfeeding.status'), ['safe', 'caution', 'avoid', 'unknown'], 'unknown'),
              notes: pickHeaderValue(row, 'safety.breastfeeding.notes') || '',
            },
            children: {
              status: normalizeEnum(pickHeaderValue(row, 'safety.children.status'), ['safe', 'caution', 'avoid', 'unknown'], 'unknown'),
              minAge: parseNumber(pickHeaderValue(row, 'safety.children.minage')),
              notes: pickHeaderValue(row, 'safety.children.notes') || '',
            },
            elderly: {
              status: normalizeEnum(pickHeaderValue(row, 'safety.elderly.status'), ['safe', 'caution', 'avoid', 'unknown'], 'unknown'),
              notes: pickHeaderValue(row, 'safety.elderly.notes') || '',
            },
            male: {
              status: normalizeEnum(pickHeaderValue(row, 'safety.male.status'), ['safe', 'caution', 'avoid', 'unknown'], 'unknown'),
              notes: pickHeaderValue(row, 'safety.male.notes') || '',
            },
            female: {
              status: normalizeEnum(pickHeaderValue(row, 'safety.female.status'), ['safe', 'caution', 'avoid', 'unknown'], 'unknown'),
              notes: pickHeaderValue(row, 'safety.female.notes') || '',
            },
            medicalConditions: parseSafetyConditions(pickHeaderValue(row, 'safety.medicalconditions')),
            allergyRisk: parseAllergyRisk(pickHeaderValue(row, 'safety.allergyrisk')),
            sideEffects: parseSideEffects(pickHeaderValue(row, 'safety.sideeffects')),
            overdoseRisk: {
              level: normalizeEnum(pickHeaderValue(row, 'safety.overdoserisk.level'), ['low', 'moderate', 'high'], 'low'),
              symptoms: splitList(pickHeaderValue(row, 'safety.overdoserisk.symptoms')),
              treatment: pickHeaderValue(row, 'safety.overdoserisk.treatment') || '',
            },
          },
          verified: parseBoolean(pickHeaderValue(row, 'verified'), false),
          isActive: parseBoolean(pickHeaderValue(row, 'isactive'), true),
          sources: parseSources(pickHeaderValue(row, 'sources')),
        };

        if (dryRun) {
          updated += 1;
          continue;
        }

        const result = await Phytochemical.updateOne(
          { name: new RegExp(`^${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') },
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

    console.log(`Phytochemical import complete: inserted=${inserted}, updated=${updated}, skipped=${skipped}, errors=${rowErrors}, dryRun=${dryRun}`);
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB');
  }
};

run().catch((error) => {
  console.error('Import failed:', error.message);
  process.exit(1);
});


