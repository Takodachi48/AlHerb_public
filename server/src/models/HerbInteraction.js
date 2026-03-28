const mongoose = require('mongoose');

/**
 * HerbInteraction
 * Herb-herb and herb-drug interactions.
 *
 * Relationship to Phytochemical:
 *   - mechanism field now references the specific Phytochemical responsible
 *     for the interaction (e.g. "Coumarin in Herb A inhibits CYP3A4")
 *   - Herb-drug interactions at the compound level live in
 *     Phytochemical.drugInteractions — this model captures the herb-level
 *     interaction record that gets shown to users
 *
 * Used by: PURE LOGIC only — interactions are deterministic safety rules,
 * not probabilistic predictions. ML model does not consume this data.
 */
const herbInteractionSchema = new mongoose.Schema({
  herbId: {
    type: String,
    ref: 'Herb',
    required: true,
    index: true,
  },

  // ── What It Interacts With ────────────────────────────────────
  interactsWith: {
    type: {
      type: String,
      enum: ['herb', 'drug'],
      required: true,
    },
    // Herb-herb: populate herbId
    herbId: {
      type: String,
      ref: 'Herb',
    },
    // Herb-drug: populate drugName + optional aliases
    drugName:     String,
    drugClass:    String,       // e.g. "Anticoagulants", "SSRIs"
    genericNames: [String],     // Alternate drug names for fuzzy matching
  },

  // ── Mechanism ─────────────────────────────────────────────────
  // CHANGED: now references the specific Phytochemical responsible.
  // mechanismText kept for plain-language display; compound ref for traceability.
  mechanism: {
    compound: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Phytochemical',
      // e.g. the Coumarin record that drives the CYP3A4 inhibition
    },
    description: {
      type: String,
      // Plain-language e.g. "Inhibits CYP3A4 enzyme pathway"
      // Shown to users and clinicians; compound ref is for data traceability
    },
  },

  // ── Interaction Details ───────────────────────────────────────
  effect: {
    type: String,
    required: true,
    // User-facing description e.g. "May increase bleeding risk"
  },

  severity: {
    type: String,
    enum: ['minor', 'moderate', 'major', 'contraindicated'],
    required: true,
    index: true,
  },

  recommendation: {
    type: String,
    required: true,
    // Actionable e.g. "Avoid combination", "Separate doses by 2 hours"
  },

  interactionType: {
    type: String,
    enum: ['synergistic', 'antagonistic', 'additive', 'adverse', 'unknown'],
  },

  management: {
    type: String,
    // Specific management steps e.g. "Monitor INR weekly"
  },

  // ── Evidence ─────────────────────────────────────────────────
  evidence: {
    level: {
      type: String,
      enum: ['theoretical', 'case_report', 'observational', 'clinical_trial', 'traditional_use'],
      default: 'theoretical',
    },
    quality: {
      type: String,
      enum: ['low', 'moderate', 'high'],
    },
  },

  sources: [{
    citation: String,
    pubmedId: String,
    url:      String,
    year:     Number,
  }],

  // ── Audit ─────────────────────────────────────────────────────
  verified:     { type: Boolean, default: false },
  verifiedBy:   { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  verifiedDate: Date,
  isActive:     { type: Boolean, default: true },

}, { timestamps: true });

// ── Indexes ───────────────────────────────────────────────────────────────────

herbInteractionSchema.index({ herbId: 1, 'interactsWith.type': 1 });
herbInteractionSchema.index({ herbId: 1, 'interactsWith.herbId': 1 });
herbInteractionSchema.index({ herbId: 1, 'interactsWith.drugName': 1 });

// ── Pre-save Hooks ────────────────────────────────────────────────────────────

// Validate correct fields are populated per interaction type
herbInteractionSchema.pre('save', function (next) {
  if (this.interactsWith.type === 'herb') {
    if (!this.interactsWith.herbId) {
      return next(new Error('herbId is required for herb-herb interactions'));
    }
    this.interactsWith.drugName    = undefined;
    this.interactsWith.drugClass   = undefined;
    this.interactsWith.genericNames = undefined;
  } else if (this.interactsWith.type === 'drug') {
    if (!this.interactsWith.drugName) {
      return next(new Error('drugName is required for herb-drug interactions'));
    }
    this.interactsWith.herbId = undefined;
  }
  next();
});

// Canonical ordering for herb-herb pairs — prevents duplicate A↔B records.
// IMPORTANT: This silently swaps herbId fields. Always query using
// findByHerb() which checks both sides, never query herbId directly.
herbInteractionSchema.pre('save', function (next) {
  if (this.interactsWith.type === 'herb' && this.interactsWith.herbId) {
    if (this.herbId.toString() > this.interactsWith.herbId.toString()) {
      [this.herbId, this.interactsWith.herbId] = [this.interactsWith.herbId, this.herbId];
    }
  }
  next();
});

// ── Static Methods ────────────────────────────────────────────────────────────

/**
 * PURE LOGIC
 * Find all interactions for a herb (checks both sides of herb-herb pairs).
 * Primary method for herb detail page interaction display.
 *
 * @param {string|ObjectId} herbId
 * @param {object} options - { type: 'herb'|'drug', minSeverity: string }
 */
herbInteractionSchema.statics.findByHerb = function (herbId, options = {}) {
  const order = ['minor', 'moderate', 'major', 'contraindicated'];
  const query = {
    $or: [
      { herbId },
      { 'interactsWith.type': 'herb', 'interactsWith.herbId': herbId },
    ],
    isActive: true,
  };

  if (options.type) query['interactsWith.type'] = options.type;

  if (options.minSeverity) {
    const minIdx = order.indexOf(options.minSeverity);
    query.severity = { $in: order.slice(minIdx >= 0 ? minIdx : 1) };
  }

  return this.find(query)
    .populate('interactsWith.herbId', 'name scientificName')
    .populate('mechanism.compound', 'name category')
    .then((records) => records.sort((a, b) => order.indexOf(b.severity) - order.indexOf(a.severity)));
};

/**
 * PURE LOGIC
 * Check if a herb interacts with any of the user's medications.
 * Used as a per-herb safety gate after the ML scoring step.
 *
 * @param {string|ObjectId} herbId
 * @param {string[]} medications
 * @returns {Promise<Array>} interactions found (empty = no interactions)
 */
herbInteractionSchema.statics.checkDrugs = function (herbId, medications = []) {
  if (!medications.length) return Promise.resolve([]);
  const order = ['minor', 'moderate', 'major', 'contraindicated'];

  const regexes = medications.map(m => new RegExp(m, 'i'));

  return this.find({
    herbId,
    'interactsWith.type': 'drug',
    isActive: true,
    $or: [
      { 'interactsWith.drugName':    { $in: regexes } },
      { 'interactsWith.genericNames': { $in: regexes } },
    ],
  })
    .populate('mechanism.compound', 'name category')
    .then((records) => records.sort((a, b) => order.indexOf(b.severity) - order.indexOf(a.severity)));
};

/**
 * Batch variant of checkDrugs to avoid N+1 queries when evaluating multiple herbs.
 */
herbInteractionSchema.statics.checkDrugsBulk = function (herbIds = [], medications = []) {
  if (!Array.isArray(herbIds) || herbIds.length === 0 || !medications.length) {
    return Promise.resolve([]);
  }

  const normalizedHerbIds = [...new Set(herbIds.map((id) => String(id)).filter(Boolean))];
  if (normalizedHerbIds.length === 0) return Promise.resolve([]);

  const order = ['minor', 'moderate', 'major', 'contraindicated'];
  const regexes = medications.map((m) => new RegExp(m, 'i'));

  return this.find({
    herbId: { $in: normalizedHerbIds },
    'interactsWith.type': 'drug',
    isActive: true,
    $or: [
      { 'interactsWith.drugName': { $in: regexes } },
      { 'interactsWith.genericNames': { $in: regexes } },
    ],
  })
    .populate('mechanism.compound', 'name category')
    .then((records) => records.sort((a, b) => order.indexOf(b.severity) - order.indexOf(a.severity)));
};

/**
 * PURE LOGIC
 * Check herb-herb interactions across a final recommended set.
 * Run after ML scoring to validate no conflicts in the top-N results.
 *
 * @param {string[]|ObjectId[]} herbIds
 */
herbInteractionSchema.statics.checkCombination = function (herbIds) {
  const order = ['minor', 'moderate', 'major', 'contraindicated'];
  return this.find({
    'interactsWith.type': 'herb',
    herbId: { $in: herbIds },
    'interactsWith.herbId': { $in: herbIds },
    isActive: true,
  })
    .populate('herbId', 'name scientificName')
    .populate('interactsWith.herbId', 'name scientificName')
    .populate('mechanism.compound', 'name category')
    .then((records) => records.sort((a, b) => order.indexOf(b.severity) - order.indexOf(a.severity)));
};

/**
 * PURE LOGIC
 * Returns herbIds that have major/contraindicated interactions with the
 * user's medications. Used to build the pre-ML exclusion list.
 *
 * @param {string[]} medications
 * @returns {Promise<string[]>} herbIds to exclude
 */
herbInteractionSchema.statics.getDangerousHerbsForDrugs = async function (medications = []) {
  if (!medications.length) return [];

  const regexes = medications.map(m => new RegExp(m, 'i'));

  const records = await this.find({
    'interactsWith.type': 'drug',
    severity: { $in: ['major', 'contraindicated'] },
    isActive: true,
    $or: [
      { 'interactsWith.drugName':    { $in: regexes } },
      { 'interactsWith.genericNames': { $in: regexes } },
    ],
  }).select('herbId');

  return [...new Set(records.map(r => r.herbId.toString()))];
};

// ── Instance Methods ──────────────────────────────────────────────────────────

herbInteractionSchema.methods.getSummary = function () {
  const base = {
    effect:         this.effect,
    severity:       this.severity,
    recommendation: this.recommendation,
    mechanism:      this.mechanism?.description || null,
    compound:       this.mechanism?.compound?.name || null,
  };

  if (this.interactsWith.type === 'herb') {
    return { type: 'herb-herb', with: this.interactsWith.herbId?.name || 'Unknown herb', ...base };
  }
  return {
    type:      'herb-drug',
    with:      this.interactsWith.drugName,
    drugClass: this.interactsWith.drugClass,
    ...base,
  };
};

module.exports = mongoose.model('HerbInteraction', herbInteractionSchema);
