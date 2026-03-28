/* eslint-disable no-console */
const mongoose = require('mongoose');
require('dotenv').config();

const dbUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/herb-app';
const dryRun = process.argv.includes('--dryRun');

const toStringIfObjectId = (pathExpr) => ({
  $cond: [
    { $eq: [{ $type: pathExpr }, 'objectId'] },
    { $toString: pathExpr },
    pathExpr,
  ],
});

const mapArrayToStringIds = (pathExpr, idField) => ({
  $map: {
    input: { $ifNull: [pathExpr, []] },
    as: 'item',
    in: {
      $mergeObjects: [
        '$$item',
        {
          [idField]: toStringIfObjectId(`$$item.${idField}`),
        },
      ],
    },
  },
});

const run = async () => {
  await mongoose.connect(dbUri);
  console.log('Connected to MongoDB');

  const db = mongoose.connection.db;
  const collections = await db.listCollections({}, { nameOnly: true }).toArray();
  const collectionNames = new Set(collections.map((item) => item.name));

  const jobs = [
    {
      name: 'blogs',
      update: [{
        $set: {
          relatedHerbs: {
            $map: {
              input: { $ifNull: ['$relatedHerbs', []] },
              as: 'id',
              in: toStringIfObjectId('$$id'),
            },
          },
        },
      }],
    },
    {
      name: 'contraindications',
      update: [{
        $set: {
          herbId: toStringIfObjectId('$herbId'),
          alternatives: {
            $map: {
              input: { $ifNull: ['$alternatives', []] },
              as: 'id',
              in: toStringIfObjectId('$$id'),
            },
          },
        },
      }],
    },
    {
      name: 'feedback',
      update: [{
        $set: {
          herb: toStringIfObjectId('$herb'),
        },
      }],
    },
    {
      name: 'herbinteractions',
      update: [{
        $set: {
          herbId: toStringIfObjectId('$herbId'),
          'interactsWith.herbId': toStringIfObjectId('$interactsWith.herbId'),
        },
      }],
    },
    {
      name: 'herbreviews',
      update: [{
        $set: {
          herbId: toStringIfObjectId('$herbId'),
        },
      }],
    },
    {
      name: 'herbsafeties',
      update: [{
        $set: {
          herbId: toStringIfObjectId('$herbId'),
        },
      }],
    },
    {
      name: 'locations',
      update: [{
        $set: {
          herbs: mapArrayToStringIds('$herbs', 'herbId'),
        },
      }],
    },
    {
      name: 'recommendations',
      update: [{
        $set: {
          recommendations: {
            $map: {
              input: { $ifNull: ['$recommendations', []] },
              as: 'rec',
              in: {
                $mergeObjects: [
                  '$$rec',
                  {
                    herb: toStringIfObjectId('$$rec.herb'),
                    alternatives: {
                      $map: {
                        input: { $ifNull: ['$$rec.alternatives', []] },
                        as: 'alt',
                        in: {
                          $mergeObjects: [
                            '$$alt',
                            { herb: toStringIfObjectId('$$alt.herb') },
                          ],
                        },
                      },
                    },
                  },
                ],
              },
            },
          },
        },
      }],
    },
    {
      name: 'users',
      update: [{
        $set: {
          'profile.favoriteHerbs': {
            $map: {
              input: { $ifNull: ['$profile.favoriteHerbs', []] },
              as: 'id',
              in: toStringIfObjectId('$$id'),
            },
          },
        },
      }],
    },
  ];

  try {
    for (const job of jobs) {
      if (!collectionNames.has(job.name)) {
        console.log(`Skipping ${job.name}: collection not found`);
        continue;
      }

      if (dryRun) {
        const total = await db.collection(job.name).countDocuments();
        console.log(`[dryRun] ${job.name}: would process up to ${total} documents`);
      } else {
        const result = await db.collection(job.name).updateMany({}, job.update);
        console.log(`${job.name}: matched=${result.matchedCount}, modified=${result.modifiedCount}`);
      }
    }
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB');
  }
};

run().catch((error) => {
  console.error('Migration failed:', error.message);
  process.exit(1);
});


