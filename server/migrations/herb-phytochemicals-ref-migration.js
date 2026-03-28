/* eslint-disable no-console */
require('dotenv').config({ path: './server/.env' });

const mongoose = require('mongoose');
const Herb = require('../src/models/Herb');
const Phytochemical = require('../src/models/Phytochemical');

const escapeRegex = (value = '') => String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const getMongoUri = () => process.env.MONGODB_URI;

async function findOrCreateCompoundByName(name) {
  const regex = new RegExp(`^${escapeRegex(name)}$`, 'i');
  let compound = await Phytochemical.findOne({ name: regex }).select('_id');

  if (compound) {
    return { compound, created: false };
  }

  compound = await Phytochemical.create({
    name,
    category: 'other',
    isActive: true,
  });

  return { compound, created: true };
}

async function run() {
  const mongoUri = getMongoUri();
  if (!mongoUri) {
    throw new Error('Missing MongoDB URI. Set MONGODB_URI.');
  }

  await mongoose.connect(mongoUri);

  const summary = {
    herbsProcessed: 0,
    compoundsCreated: 0,
    compoundsMatched: 0,
    errors: 0,
  };

  const herbs = await Herb.find({}).select('_id phytochemicals');

  for (const herb of herbs) {
    try {
      const raw = Array.isArray(herb.phytochemicals) ? herb.phytochemicals : [];
      let changed = false;
      const nextPhytochemicals = [];

      for (const item of raw) {
        // Already migrated or valid reference shape.
        if (item?.compound) {
          nextPhytochemicals.push({
            compound: item.compound?._id || item.compound,
            concentration: item.concentration || '',
            partSource: item.partSource ?? null,
          });
          continue;
        }

        // Legacy embedded shape.
        if (item?.name && String(item.name).trim()) {
          const { compound, created } = await findOrCreateCompoundByName(String(item.name).trim());
          if (created) summary.compoundsCreated += 1;
          else summary.compoundsMatched += 1;

          nextPhytochemicals.push({
            compound: compound._id,
            concentration: item.concentration || '',
            partSource: null,
          });
          changed = true;
          continue;
        }

        // Skip invalid legacy entries.
        changed = true;
      }

      if (changed) {
        herb.phytochemicals = nextPhytochemicals;
        await herb.save();
        summary.herbsProcessed += 1;
      }
    } catch (error) {
      summary.errors += 1;
      console.error(`Failed herb ${herb._id}: ${error.message}`);
    }
  }

  console.log('Migration summary:', summary);
  await mongoose.disconnect();
}

run()
  .then(() => {
    console.log('herb-phytochemicals-ref-migration completed');
    process.exit(0);
  })
  .catch(async (error) => {
    console.error('Migration failed:', error.message);
    try {
      await mongoose.disconnect();
    } catch (disconnectError) {
      console.error('Disconnect failed:', disconnectError.message);
    }
    process.exit(1);
  });
