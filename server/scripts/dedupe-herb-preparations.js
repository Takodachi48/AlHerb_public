/* eslint-disable no-console */
const mongoose = require('mongoose');
require('dotenv').config();

const Herb = require('../src/models/Herb');
const { parseArgs } = require('./import-helpers');

const dbUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/herb-app';

const normalizeText = (value) => String(value || '')
  .trim()
  .replace(/\s+/g, ' ')
  .toLowerCase();

const normalizePreparationEntry = (entry = {}) => ({
  method: normalizeText(entry.method),
  instructions: normalizeText(entry.instructions),
  ratio: normalizeText(entry.ratio),
});

const buildPreparationKey = (entry = {}) => {
  const normalized = normalizePreparationEntry(entry);
  return `${normalized.method}|${normalized.instructions}|${normalized.ratio}`;
};

const shouldKeepEntry = (entry = {}) => {
  const normalized = normalizePreparationEntry(entry);
  return Boolean(normalized.method || normalized.instructions || normalized.ratio);
};

const buildHerbLabelSet = (herb = {}) => {
  const labels = new Set();
  [herb.name, herb.scientificName, herb.slug, ...(Array.isArray(herb.commonNames) ? herb.commonNames : [])]
    .forEach((value) => {
      const normalized = normalizeText(value);
      if (normalized) labels.add(normalized);
    });
  return labels;
};

const isPlaceholderPreparation = (entry = {}, herb = {}) => {
  const normalized = normalizePreparationEntry(entry);
  if (!normalized.instructions || !normalized.ratio) return false;
  if (normalized.instructions !== normalized.ratio) return false;
  if (normalized.method && normalized.method !== 'decoction') return false;

  const herbLabels = buildHerbLabelSet(herb);
  return herbLabels.has(normalized.instructions);
};

const run = async () => {
  const args = parseArgs(process.argv.slice(2));
  const dryRun = Boolean(args.dryRun);

  await mongoose.connect(dbUri);
  console.log('Connected to MongoDB');

  try {
    const herbs = await Herb.find({}).select('_id name scientificName slug commonNames preparation').lean();

    let scanned = 0;
    let modified = 0;
    let removedEntries = 0;

    for (const herb of herbs) {
      scanned += 1;
      const current = Array.isArray(herb.preparation) ? herb.preparation : [];
      if (current.length <= 1) continue;

      const deduped = [];
      const seen = new Set();

      for (const entry of current) {
        if (!shouldKeepEntry(entry)) continue;
        if (isPlaceholderPreparation(entry, herb)) continue;
        const key = buildPreparationKey(entry);
        if (seen.has(key)) continue;
        seen.add(key);
        deduped.push(entry);
      }

      if (deduped.length === current.length) continue;

      modified += 1;
      removedEntries += (current.length - deduped.length);
      console.log(`Updated ${herb.name || herb._id}: ${current.length} -> ${deduped.length}`);

      if (!dryRun) {
        // eslint-disable-next-line no-await-in-loop
        await Herb.updateOne({ _id: herb._id }, { $set: { preparation: deduped } });
      }
    }

    console.log(
      `Preparation dedupe complete: scanned=${scanned}, modified=${modified}, removedEntries=${removedEntries}, dryRun=${dryRun}`,
    );
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB');
  }
};

run().catch((error) => {
  console.error('Dedupe failed:', error.message);
  process.exit(1);
});
