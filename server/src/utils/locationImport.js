const mongoose = require('mongoose');

const LOCATION_TYPES = new Set(['market', 'foraging', 'shop', 'pharmacy', 'clinic']);
const LOCATION_TYPE_ALIASES = {
  garden: 'foraging',
  farm: 'foraging',
  nursery: 'shop',
  store: 'shop',
  drugstore: 'pharmacy',
};

const createSlug = (value = '') => value
  .toString()
  .toLowerCase()
  .trim()
  .replace(/\s+/g, '-')
  .replace(/[^a-z0-9-]/g, '')
  .replace(/-+/g, '-')
  .replace(/^-|-$/g, '');

const parseBoolean = (value, fallback) => {
  if (value === undefined || value === null || value === '') {
    return fallback;
  }

  if (typeof value === 'boolean') {
    return value;
  }

  const normalized = String(value).trim().toLowerCase();
  return ['true', '1', 'yes', 'y'].includes(normalized);
};

const parseJsonArray = (value, fallback = []) => {
  if (Array.isArray(value)) {
    return value;
  }

  if (value === undefined || value === null || value === '') {
    return fallback;
  }

  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed : fallback;
    } catch (error) {
      return fallback;
    }
  }

  return fallback;
};

const normalizeHerbId = (value) => {
  if (!value) return null;
  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed || null;
  }
  if (mongoose.Types.ObjectId.isValid(value)) {
    return String(value);
  }
  return null;
};

const normalizeHerbs = (herbsValue) => parseJsonArray(herbsValue, []).map((item) => {
  if (typeof item === 'string') {
    const herbId = normalizeHerbId(item);
    if (!herbId) {
      return null;
    }
    return { herbId, notes: '', lastUpdated: new Date() };
  }

  if (!item || typeof item !== 'object') {
    return null;
  }

  const herbId = normalizeHerbId(item.herbId || item.id);
  if (!herbId) {
    return null;
  }

  return {
    herbId,
    notes: item.notes || '',
    lastUpdated: item.lastUpdated ? new Date(item.lastUpdated) : new Date(),
  };
}).filter(Boolean);

const normalizeImages = (imagesValue) => parseJsonArray(imagesValue, []).map((item, index) => {
  if (typeof item === 'string') {
    return {
      url: item,
      caption: '',
      isPrimary: index === 0,
    };
  }

  if (!item || typeof item !== 'object' || !item.url) {
    return null;
  }

  return {
    url: item.url,
    caption: item.caption || '',
    isPrimary: Boolean(item.isPrimary),
  };
}).filter(Boolean);

const buildLocationImportDoc = (row, options = {}) => {
  const {
    defaultCreatedBy = null,
    now = new Date(),
  } = options;

  const name = String(row.name || '').trim();
  const rawType = String(row.type || '').trim().toLowerCase();
  const type = LOCATION_TYPE_ALIASES[rawType] || rawType;
  const lng = Number(row.location_lng);
  const lat = Number(row.location_lat);
  const createdBy = row.createdBy || defaultCreatedBy;

  if (!name) {
    throw new Error('Missing required field: name');
  }

  if (!LOCATION_TYPES.has(type)) {
    throw new Error(`Invalid location type: ${row.type}`);
  }

  if (!Number.isFinite(lng) || !Number.isFinite(lat)) {
    throw new Error('Invalid coordinates. location_lng and location_lat are required numbers.');
  }

  if (!createdBy || !mongoose.Types.ObjectId.isValid(createdBy)) {
    throw new Error('Missing or invalid createdBy');
  }

  const verified = parseBoolean(row.verified, false);
  const isActive = parseBoolean(row.isActive, true);

  return {
    name,
    slug: createSlug(name),
    type,
    location: {
      type: 'Point',
      coordinates: [lng, lat],
    },
    herbs: normalizeHerbs(row.herbs),
    description: row.description ? String(row.description) : '',
    images: normalizeImages(row.images),
    createdBy: new mongoose.Types.ObjectId(createdBy),
    isActive,
    verified,
    verifiedDate: verified ? (row.verifiedDate ? new Date(row.verifiedDate) : now) : undefined,
  };
};

const transformLocationImportRows = (rows = [], options = {}) => {
  const usedSlugs = new Set();

  return rows.map((row) => {
    const doc = buildLocationImportDoc(row, options);
    let slug = doc.slug;
    let suffix = 1;

    while (usedSlugs.has(slug)) {
      suffix += 1;
      slug = `${doc.slug}-${suffix}`;
    }

    usedSlugs.add(slug);
    doc.slug = slug;
    return doc;
  });
};

const importLocationsFromRows = async (rows = [], { Location, ...options }) => {
  if (!Location) {
    throw new Error('Location model is required');
  }

  const docs = transformLocationImportRows(rows, options);
  return Location.insertMany(docs, { ordered: false });
};

module.exports = {
  buildLocationImportDoc,
  transformLocationImportRows,
  importLocationsFromRows,
};
