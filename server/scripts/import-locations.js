/* eslint-disable no-console */
const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
require('dotenv').config();

const Location = require('../src/models/Location');
const Herb = require('../src/models/Herb');
const { transformLocationImportRows } = require('../src/utils/locationImport');
const { getLocationFromCoordinates } = require('../src/services/reverseGeocodingService');
const { getLocationImage } = require('../src/services/locationImageService');

const parseArgs = (argv) => {
  const args = {};
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (!token.startsWith('--')) {
      continue;
    }

    const key = token.slice(2);
    const next = argv[i + 1];
    if (!next || next.startsWith('--')) {
      args[key] = true;
      continue;
    }

    args[key] = next;
    i += 1;
  }
  return args;
};

const parseCsvLine = (line) => {
  const values = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    const next = line[i + 1];

    if (char === '"' && inQuotes && next === '"') {
      current += '"';
      i += 1;
      continue;
    }

    if (char === '"') {
      inQuotes = !inQuotes;
      continue;
    }

    if (char === ',' && !inQuotes) {
      values.push(current.trim());
      current = '';
      continue;
    }

    current += char;
  }

  values.push(current.trim());
  return values;
};

const readCsvRows = (filePath) => {
  const content = fs.readFileSync(filePath, 'utf8');
  const lines = content.split(/\r?\n/).filter((line) => line.trim().length > 0);
  if (lines.length === 0) {
    return [];
  }

  const headers = parseCsvLine(lines[0]);
  return lines.slice(1).map((line) => {
    const values = parseCsvLine(line);
    const row = {};
    headers.forEach((header, index) => {
      row[header] = values[index] ?? '';
    });
    return row;
  });
};

const readExcelRows = (filePath) => {
  let xlsx;
  try {
    // Optional dependency for Excel support.
    // eslint-disable-next-line global-require, import/no-extraneous-dependencies
    xlsx = require('xlsx');
  } catch (error) {
    throw new Error('Excel import requires `xlsx`. Install with: npm i xlsx');
  }

  const workbook = xlsx.readFile(filePath);
  const [firstSheetName] = workbook.SheetNames;
  const firstSheet = workbook.Sheets[firstSheetName];
  return xlsx.utils.sheet_to_json(firstSheet, { defval: '' });
};

const isLocationDifferent = (existing, newDoc) => {
  const fieldsToCompare = ['name', 'scientificName', 'description', 'herbs'];

  for (const field of fieldsToCompare) {
    if (JSON.stringify(existing[field]) !== JSON.stringify(newDoc[field])) {
      return true;
    }
  }

  if (JSON.stringify(existing.derivedLocation) !== JSON.stringify(newDoc.derivedLocation)) {
    return true;
  }

  if (JSON.stringify(existing.images) !== JSON.stringify(newDoc.images)) {
    return true;
  }

  return false;
};

const run = async () => {
  const args = parseArgs(process.argv.slice(2));
  const file = args.file;
  const dryRun = Boolean(args.dryRun || args.dryrun || args['dry-run']);
  const defaultCreatedBy = args.createdBy || (dryRun ? '000000000000000000000000' : undefined);
  const batchSize = Math.max(100, Number(args.batchSize) || 500);
  const enrichGeo = Boolean(args.enrichGeo);
  const enrichImages = Boolean(args.enrichImages);
  const dbUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/herb-app';

  if (!file) {
    throw new Error('Missing --file argument');
  }

  const absolutePath = path.resolve(process.cwd(), file);
  if (!fs.existsSync(absolutePath)) {
    throw new Error(`File not found: ${absolutePath}`);
  }

  const extension = path.extname(absolutePath).toLowerCase();
  const rawRows = extension === '.xlsx' || extension === '.xls'
    ? readExcelRows(absolutePath)
    : readCsvRows(absolutePath);

  await mongoose.connect(dbUri);
  console.log('Connected to MongoDB');

  const herbs = await Herb.find({}).select('_id name scientificName slug').lean();
  const herbByKey = new Map();
  for (const herb of herbs) {
    [herb._id, herb.slug, herb.name, herb.scientificName].forEach((value) => {
      if (value) herbByKey.set(String(value).trim().toLowerCase(), String(herb._id));
    });
  }

  // Support simple comma-separated herb names in location sheets.
  // Existing JSON payloads are still accepted.
  for (const row of rawRows) {
    if (!row.herbs || typeof row.herbs !== 'string') continue;
    const trimmed = row.herbs.trim();
    if (!trimmed || trimmed.startsWith('[')) continue;

    const herbIds = trimmed
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean)
      .map((item) => herbByKey.get(item.toLowerCase()))
      .filter(Boolean);

    row.herbs = JSON.stringify(herbIds.map((herbId) => ({ herbId })));
  }

  if (!dryRun && !args.createdBy) {
    const hasMissingCreatedBy = rawRows.some((row) => !row.createdBy || String(row.createdBy).trim() === '');
    if (hasMissingCreatedBy) {
      throw new Error('Missing createdBy in input rows. Provide --createdBy <userObjectId> or add createdBy per row.');
    }
  }

  const docs = transformLocationImportRows(rawRows, { defaultCreatedBy });
  console.log(`Parsed ${docs.length} location rows from ${absolutePath}`);

  if (enrichGeo && docs.length > 0) {
    console.log('Reverse geocoding enabled for import. This runs at ~1 request/second due to provider limits.');
    const lookupCache = new Map();

    for (const doc of docs) {
      const [lng, lat] = doc.location.coordinates;
      const key = `${lat.toFixed(6)},${lng.toFixed(6)}`;

      if (!lookupCache.has(key)) {
        // eslint-disable-next-line no-await-in-loop
        const locationData = await getLocationFromCoordinates(lat, lng);
        lookupCache.set(key, locationData || null);
      }

      const locationData = lookupCache.get(key);
      if (locationData) {
        doc.derivedLocation = {
          city: locationData.city || '',
          province: locationData.province || '',
          country: locationData.country || '',
          postcode: locationData.postcode || '',
          provider: locationData.provider || 'nominatim',
          updatedAt: new Date(),
        };
      }
    }
  }

  if (enrichImages && docs.length > 0) {
    console.log('Location image lookup enabled for import. Requests are queued to respect provider limits.');
    const imageCache = new Map();

    for (const doc of docs) {
      const [lng, lat] = doc.location.coordinates;
      const key = `${lat.toFixed(6)},${lng.toFixed(6)}`;

      if (!imageCache.has(key)) {
        // eslint-disable-next-line no-await-in-loop
        const imageData = await getLocationImage(lat, lng);
        imageCache.set(key, imageData || null);
      }

      const imageData = imageCache.get(key);
      if (imageData?.imageUrl && (!Array.isArray(doc.images) || doc.images.length === 0)) {
        doc.images = [{
          url: imageData.thumbnailUrl || imageData.imageUrl,
          caption: `Location image (${imageData.provider})`,
          isPrimary: true,
        }];
      }
    }
  }

  if (dryRun) {
    console.log('Dry run enabled; no writes were performed.');
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB');
    return;
  }

  if (docs.length === 0) {
    console.log('No rows to import.');
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB');
    return;
  }

  try {
    let inserted = 0;
    let updated = 0;
    let skipped = 0;

    for (const doc of docs) {
      // eslint-disable-next-line no-await-in-loop
      const existing = await Location.findOne({ 'location.coordinates': doc.location.coordinates });

      if (existing) {
        if (isLocationDifferent(existing, doc)) {
          Object.assign(existing, doc);
          // eslint-disable-next-line no-await-in-loop
          await existing.save();
          updated++;
        } else {
          skipped++;
        }
      } else {
        // eslint-disable-next-line no-await-in-loop
        await Location.create(doc);
        inserted++;
      }

      if ((inserted + updated + skipped) % 100 === 0) {
        console.log(`Processed ${inserted + updated + skipped}/${docs.length}`);
      }
    }

    console.log(`Import complete: ${inserted} inserted, ${updated} updated, ${skipped} skipped.`);
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB');
  }
};

run().catch((error) => {
  console.error('Import failed:', error.message);
  process.exit(1);
});

