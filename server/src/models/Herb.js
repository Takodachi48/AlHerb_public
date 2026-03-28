const mongoose = require('mongoose');

// ─────────────────────────────────────────────────────────────────────────────
// CHANGES FROM ORIGINAL:
//   1. phytochemicals: embedded subdocs → ObjectId refs to Phytochemical model
//      (concentration and partSource remain here — they are herb-specific)
//   2. safetyProfile: new denormalized field (Phase 2, background job only)
//      DO NOT write manually — always derived via Phytochemical.deriveSafetyProfile()
//   3. All other fields unchanged from original
// ─────────────────────────────────────────────────────────────────────────────

const sourceSchema = new mongoose.Schema({
  url:       { type: String, required: true, trim: true },
  title:     { type: String, trim: true },
  publisher: { type: String, trim: true },
  accessedAt:{ type: Date, default: Date.now },
}, { _id: false });

const herbSchema = new mongoose.Schema({
  _id: {
    type: String,
    required: true,
  },

  // ── Basic Information ─────────────────────────────────────────
  name: {
    type: String,
    required: true,
    trim: true,
    index: true,
  },
  slug: {
    type: String,
    unique: true,
    lowercase: true,
    trim: true,
  },
  scientificName: {
    type: String,
    required: true,
    trim: true,
    index: true,
  },
  commonNames: [{ type: String, trim: true }],
  description: { type: String },
  info: {
    sources: { type: [sourceSchema], default: [] },
  },
  family: { type: String, trim: true },

  // ── Usage Information ─────────────────────────────────────────
  partsUsed:  [{ type: String, trim: true }],
  properties: [{ type: String, trim: true }],
  symptoms:   [{ type: String, trim: true }],

  // ── Dosage ────────────────────────────────────────────────────
  dosage: {
    adult:   { min: String, max: String, unit: String, frequency: String },
    child:   { min: String, max: String, unit: String, frequency: String },
    elderly: { min: String, max: String, unit: String, frequency: String },
    sources: { type: [sourceSchema], default: [] },
  },

  // ── Preparation ───────────────────────────────────────────────
  preparation: [{
    method: {
      type: String,
      enum: [
        'tea', 'tincture', 'capsule', 'powder', 'ointment',
        'essential_oil', 'compress', 'poultice', 'decoction',
        'infusion', 'syrup', 'salve',
      ],
    },
    instructions: String,
    ratio: String,
  }],

  // ── Images ────────────────────────────────────────────────────
  images: [{
    url:       String,
    caption:   String,
    isPrimary: { type: Boolean, default: false },
  }],

  // ── Growing Info ──────────────────────────────────────────────
  // Display-only — shown on herb detail/encyclopedia pages.
  // Not used in recommendation logic, safety checks, or flora-service.
  growingInfo: {
    climate:    String,
    soil:       String,
    sunlight:   String,
    water:      String,
    harvesting: String,
  },

  // ── Phytochemicals ────────────────────────────────────────────
  // CHANGED: was embedded subdocuments, now ObjectId refs.
  // Compound profiles (effects, drug interactions, safety) live in
  // the Phytochemical model and are shared across herbs.
  // concentration and partSource remain here — they are herb-specific.
  phytochemicals: [{
    compound: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Phytochemical',
      required: true,
    },
    concentration: {
      type: String,
      trim: true,
      // e.g. "2–3% in dried root", "0.5 mg per 100g"
    },
    partSource: {
      type: String,
      trim: true,
      // Which part of the plant this compound is found in
      // e.g. "root", "leaf", "seed", "bark"
    },
  }],

  // ── Phase 2: Denormalized Safety Profile ─────────────────────
  // Populated by background job via Phytochemical.deriveSafetyProfile().
  // Reflects the most restrictive safety status across all phytochemicals.
  // Used for fast pre-filtering without joins at recommendation time.
  // DO NOT write to this manually.
  safetyProfile: {
    pregnancy:     { type: String, enum: ['safe', 'caution', 'avoid', 'unknown'] },
    breastfeeding: { type: String, enum: ['safe', 'caution', 'avoid', 'unknown'] },
    children:      { type: String, enum: ['safe', 'caution', 'avoid', 'unknown'] },
    elderly:       { type: String, enum: ['safe', 'caution', 'avoid', 'unknown'] },
    male:          { type: String, enum: ['safe', 'caution', 'avoid', 'unknown'] },
    female:        { type: String, enum: ['safe', 'caution', 'avoid', 'unknown'] },
    // Most restrictive recommendation per condition across all compounds
    medicalConditions: [{
      condition:      { type: String },
      recommendation: { type: String, enum: ['safe', 'caution', 'avoid'] },
      notes:          { type: String },
    }],
    // Drug classes with major or contraindicated interactions (for quick exclusion)
    majorDrugInteractions: [String],
    lastComputedAt: { type: Date },
  },

  // ── Flags ─────────────────────────────────────────────────────
  isActive:   { type: Boolean, default: true },
  isFeatured: { type: Boolean, default: false },

  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
}, {
  timestamps: true,
});

// ── Indexes ───────────────────────────────────────────────────────────────────

herbSchema.index({
  name: 'text',
  scientificName: 'text',
  commonNames: 'text',
  description: 'text',
  properties: 'text',
  symptoms: 'text',
});

herbSchema.index({ isActive: 1 });
herbSchema.index({ isFeatured: 1 });
herbSchema.index({ isActive: 1, isFeatured: 1 });
// Supports primary list pagination/sort path used by HerbService.getHerbs.
herbSchema.index({ isActive: 1, isFeatured: -1, name: 1 });
// Phase 2: fast pre-filter on denormalized safety
herbSchema.index({ 'safetyProfile.pregnancy': 1 });
herbSchema.index({ 'safetyProfile.breastfeeding': 1 });
herbSchema.index({ 'safetyProfile.male': 1 });
herbSchema.index({ 'safetyProfile.female': 1 });
herbSchema.index({ 'safetyProfile.majorDrugInteractions': 1 });

// ── Pre-save Hooks ────────────────────────────────────────────────────────────

herbSchema.pre('save', function (next) {
  if (this.isModified('name') && !this.slug) {
    this.slug = this.name
      .toLowerCase()
      .replace(/\s+/g, '-')
      .replace(/[^a-z0-9-]/g, '')
      .replace(/-+/g, '-')
      .trim();
  }
  next();
});

herbSchema.pre('validate', function (next) {
  const hasDosage =
    this.dosage?.adult?.min ||
    this.dosage?.child?.min ||
    this.dosage?.elderly?.min;
  if (hasDosage && (!this.dosage.sources || this.dosage.sources.length === 0)) {
    return next(new Error('Dosage information requires at least one source.'));
  }
  next();
});

herbSchema.pre('validate', function (next) {
  if (this.description && (!this.info.sources || this.info.sources.length === 0)) {
    return next(new Error('Herb description requires at least one source.'));
  }
  next();
});

// ── Static Methods ────────────────────────────────────────────────────────────

/**
 * PURE LOGIC
 * Initial candidate pool for the recommendation pipeline.
 * Returns herbs whose symptoms array overlaps with user input.
 */
herbSchema.statics.findBySymptoms = function (symptoms) {
  const escaped = (symptoms || [])
    .map((value) => String(value || '').trim())
    .filter(Boolean)
    .map((value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  const regexes = escaped.map((value) => new RegExp(`^${value}$`, 'i'));

  return this.find({
    symptoms: { $in: regexes },
    isActive: true,
  })
    .select('name scientificName description symptoms properties images dosage phytochemicals safetyProfile')
    .populate('phytochemicals.compound', 'name category effects');
};

/**
 * PURE LOGIC — Phase 2
 * Fast exclusion pass using denormalized safetyProfile.
 * Returns only herbs that pass basic safety checks for the user profile.
 * Runs before the full HerbSafety.assessForUser() deep check.
 *
 * @param {string[]} herbIds
 * @param {object} userProfile - { isPregnant, isBreastfeeding, medications[] }
 */
herbSchema.statics.filterSafeForUser = function (herbIds, userProfile) {
  const profile = userProfile || {};
  const query = { _id: { $in: herbIds }, isActive: true };

  if (profile.isPregnant === true) {
    query['safetyProfile.pregnancy'] = { $nin: ['avoid'] };
  }
  if (profile.isBreastfeeding === true) {
    query['safetyProfile.breastfeeding'] = { $nin: ['avoid'] };
  }
  if (profile.age !== undefined && profile.age < 18) {
    query['safetyProfile.children'] = { $nin: ['avoid'] };
  }
  if (profile.age !== undefined && profile.age >= 65) {
    query['safetyProfile.elderly'] = { $nin: ['avoid'] };
  }
  if (String(profile.gender || '').toLowerCase() === 'male') {
    query['safetyProfile.male'] = { $nin: ['avoid'] };
  }
  if (String(profile.gender || '').toLowerCase() === 'female') {
    query['safetyProfile.female'] = { $nin: ['avoid'] };
  }
  if (profile.medications?.length) {
    query['safetyProfile.majorDrugInteractions'] = {
      $not: { $elemMatch: { $in: profile.medications } },
    };
  }

  return this.find(query).select('_id safetyProfile');
};

herbSchema.statics.searchHerbs = function (query) {
  return this.find({
    $text: { $search: query },
    isActive: true,
  }).sort({ score: { $meta: 'textScore' } });
};

herbSchema.statics.getFeatured = function (limit = 10) {
  return this.find({ isFeatured: true, isActive: true })
    .limit(limit)
    .select('name scientificName description images symptoms');
};

herbSchema.statics.findByFamily = function (family) {
  return this.find({
    family: new RegExp(family, 'i'),
    isActive: true,
  });
};

herbSchema.statics.getPaginated = async function (page = 1, limit = 20, filters = {}) {
  const query = { isActive: true, ...filters };
  const total = await this.countDocuments(query);
  const herbs = await this.find(query)
    .skip((page - 1) * limit)
    .limit(limit)
    .select('name scientificName description images symptoms isFeatured')
    .sort({ isFeatured: -1, name: 1 });

  return {
    herbs,
    pagination: { total, page, pages: Math.ceil(total / limit), limit },
  };
};

// ── Instance Methods ──────────────────────────────────────────────────────────

/**
 * Returns compound ObjectIds — input to Phytochemical static methods.
 * e.g. Phytochemical.deriveSafetyProfile(herb.getCompoundIds())
 */
herbSchema.methods.getCompoundIds = function () {
  return (this.phytochemicals || [])
    .map(p => p?.compound?._id || p?.compound)
    .filter(Boolean);
};

herbSchema.methods.getAllSources = function () {
  const sources = [
    ...(this.info?.sources || []),
    ...(this.dosage?.sources || []),
  ];
  return sources.filter(
    (src, i, self) => i === self.findIndex(s => s.url === src.url)
  );
};

herbSchema.methods.getDosageSources = function () {
  return this.dosage?.sources || [];
};

herbSchema.methods.getInfoSources = function () {
  return this.info?.sources || [];
};

herbSchema.methods.isWellCited = function () {
  return (
    (this.info?.sources?.length || 0) > 0 &&
    (this.dosage?.sources?.length || 0) > 0
  );
};

herbSchema.methods.getPrimaryImage = function () {
  const primary = this.images.find(img => img.isPrimary);
  return primary ? primary.url : (this.images[0]?.url || null);
};

herbSchema.methods.getAllImages = function () {
  return this.images.map(img => img.url);
};

herbSchema.methods.treatsSymptom = function (symptom) {
  return this.symptoms.some(s =>
    s.toLowerCase().includes(symptom.toLowerCase())
  );
};

herbSchema.methods.getPreparationMethod = function (method) {
  return this.preparation.find(p => p.method === method) || null;
};

herbSchema.methods.getDosage = function (ageGroup = 'adult') {
  return this.dosage[ageGroup] || null;
};

herbSchema.methods.getSummary = function () {
  return {
    id:           this._id,
    name:         this.name,
    scientificName: this.scientificName,
    slug:         this.slug,
    description:  this.description ? this.description.substring(0, 150) + '...' : '',
    primaryImage: this.getPrimaryImage(),
    symptoms:     this.symptoms.slice(0, 3),
    isFeatured:   this.isFeatured,
  };
};

// ── Virtuals ──────────────────────────────────────────────────────────────────

herbSchema.virtual('locationCount', {
  ref: 'Location',
  localField: '_id',
  foreignField: 'herbs.herbId',
  count: true,
});

herbSchema.virtual('reviews', {
  ref: 'HerbReview',
  localField: '_id',
  foreignField: 'herbId',
});

herbSchema.virtual('safety', {
  ref: 'HerbSafety',
  localField: '_id',
  foreignField: 'herbId',
  justOne: true,
});

herbSchema.virtual('interactions', {
  ref: 'HerbInteraction',
  localField: '_id',
  foreignField: 'herbId',
});

herbSchema.virtual('contraindications', {
  ref: 'Contraindication',
  localField: '_id',
  foreignField: 'herbId',
});

// ── Configuration ─────────────────────────────────────────────────────────────

herbSchema.set('toJSON', { virtuals: true });
herbSchema.set('toObject', { virtuals: true });

module.exports = mongoose.model('Herb', herbSchema);
