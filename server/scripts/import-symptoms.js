/* eslint-disable no-console */
const path = require('path');
const fs = require('fs');
const mongoose = require('mongoose');
require('dotenv').config();

const Symptom = require('../src/models/Symptom');
const User = require('../src/models/User');
const {
  parseArgs,
  readRows,
  splitList,
  parseBoolean,
  pickHeaderValue,
} = require('./import-helpers');

const dbUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/herb-app';

const normalizeEnum = (value, allowed, fallback) => {
  const normalized = String(value || '').trim().toLowerCase();
  return allowed.includes(normalized) ? normalized : fallback;
};

const run = async () => {
  const args = parseArgs(process.argv.slice(2));
  const file = args.file || path.resolve(process.cwd(), '..', 'data for importing (excel)', 'symptoms.xlsx');
  const sheet = args.sheet || 'Symptoms';
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
    const defaultUser = await User.findOne({ role: 'admin' }).select('_id').lean()
      || await User.findOne({}).select('_id').lean();

    if (!defaultUser?._id) {
      throw new Error('No users found. At least one user is required for createdBy.');
    }

    let inserted = 0;
    let updated = 0;
    let skipped = 0;
    let rowErrors = 0;

    for (let index = 0; index < rows.length; index += 1) {
      const row = rows[index];
      const rowNum = index + 2;
      try {
        const name = String(pickHeaderValue(row, 'name') || '').trim();
        const description = String(pickHeaderValue(row, 'description') || '').trim();
        if (!name || !description) {
          skipped += 1;
          continue;
        }

        const doc = {
          name,
          description,
          category: normalizeEnum(
            pickHeaderValue(row, 'category'),
            ['digestive', 'respiratory', 'cardiovascular', 'nervous', 'musculoskeletal', 'skin', 'immune', 'endocrine', 'reproductive', 'mental', 'general'],
            'general',
          ),
          severity: normalizeEnum(pickHeaderValue(row, 'severity'), ['mild', 'moderate', 'severe'], 'moderate'),
          duration: normalizeEnum(pickHeaderValue(row, 'duration'), ['acute', 'chronic', 'episodic'], 'acute'),
          commonCauses: splitList(pickHeaderValue(row, 'common_causes')),
          keywords: splitList(pickHeaderValue(row, 'keywords')),
          seekMedicalAttention: parseBoolean(pickHeaderValue(row, 'seek_medical_attention'), false),
          medicalAttentionNote: String(pickHeaderValue(row, 'medical_attention_note') || '').trim(),
          isActive: true,
          createdBy: defaultUser._id,
        };

        if (dryRun) {
          updated += 1;
          continue;
        }

        const result = await Symptom.updateOne(
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

    console.log(`Symptom import complete: inserted=${inserted}, updated=${updated}, skipped=${skipped}, errors=${rowErrors}, dryRun=${dryRun}`);
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB');
  }
};

run().catch((error) => {
  console.error('Import failed:', error.message);
  process.exit(1);
});


