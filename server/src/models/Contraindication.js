const mongoose = require('mongoose');

/**
 * Contraindication
 * Clinically significant herb-condition contraindications with cited sources.
 * Distinct from HerbSafety.medicalConditions — this model is for records
 * that require a sourced citation and offer an alternative herb suggestion.
 *
 * Relationship to Phytochemical:
 *   - causativeCompound links to the specific compound responsible,
 *     providing scientific traceability for each contraindication record
 *
 * Used by: PURE LOGIC — pre-ML exclusion and post-ML warning attachment
 */
const contraindicationSchema = new mongoose.Schema({
  herbId: {
    type: String,
    ref: 'Herb',
    required: true,
    index: true,
  },

  condition: {
    type: String,
    required: true,
    trim: true,
    // e.g. "Hypertension", "Kidney disease", "Autoimmune disorder"
  },

  severity: {
    type: String,
    enum: ['relative', 'absolute'],
    required: true,
    // relative = use with caution / may be managed
    // absolute = do not use under any circumstance
  },

  reason: {
    type: String,
    required: true,
    // Plain-language explanation shown to user
  },

  // Which phytochemical causes this contraindication
  causativeCompound: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Phytochemical',
    // e.g. the Berberine record that drives the contraindication in pregnancy
  },

  // Herbs that can be safely substituted for users with this condition
  alternatives: [{
    type: String,
    ref: 'Herb',
  }],

  sources: [{
    citation: String,
    url: String,
  }],

  verified: { type: Boolean, default: false },
  isActive: { type: Boolean, default: true },

}, { timestamps: true });

contraindicationSchema.index({ herbId: 1, condition: 1 }, { unique: true });

// ── Static Methods ────────────────────────────────────────────────────────────

/**
 * PURE LOGIC
 * Returns contraindications for a specific herb that match the user's conditions.
 * Called post-ML to attach contraindication detail + alternatives to results.
 *
 * @param {string|ObjectId} herbId
 * @param {string[]} userConditions
 * @returns {Promise<Array>}
 */
contraindicationSchema.statics.checkForUser = function (herbId, userConditions = []) {
  if (!userConditions.length) return Promise.resolve([]);

  const regexes = userConditions.map(c => new RegExp(c, 'i'));

  return this.find({
    herbId,
    isActive: true,
    condition: { $in: regexes },
  })
    .populate('alternatives', 'name scientificName slug')
    .populate('causativeCompound', 'name category');
};

/**
 * Batch variant of checkForUser to avoid N+1 queries when evaluating multiple herbs.
 */
contraindicationSchema.statics.checkForUserBulk = function (herbIds = [], userConditions = []) {
  if (!Array.isArray(herbIds) || herbIds.length === 0 || !userConditions.length) {
    return Promise.resolve([]);
  }

  const normalizedHerbIds = [...new Set(herbIds.map((id) => String(id)).filter(Boolean))];
  if (normalizedHerbIds.length === 0) return Promise.resolve([]);

  const regexes = userConditions.map((c) => new RegExp(c, 'i'));

  return this.find({
    herbId: { $in: normalizedHerbIds },
    isActive: true,
    condition: { $in: regexes },
  })
    .populate('alternatives', 'name scientificName slug')
    .populate('causativeCompound', 'name category');
};

/**
 * PURE LOGIC
 * Returns herbIds that are absolutely contraindicated for any of the
 * user's conditions. Used to build the pre-ML exclusion list alongside
 * HerbInteraction.getDangerousHerbsForDrugs().
 *
 * @param {string[]} userConditions
 * @returns {Promise<string[]>} herbIds to exclude from ML candidates
 */
contraindicationSchema.statics.getAbsolutelyContraindicated = async function (userConditions = []) {
  if (!userConditions.length) return [];

  const regexes = userConditions.map(c => new RegExp(c, 'i'));

  const records = await this.find({
    isActive: true,
    severity: 'absolute',
    condition: { $in: regexes },
  }).select('herbId');

  return [...new Set(records.map(r => r.herbId.toString()))];
};

module.exports = mongoose.model('Contraindication', contraindicationSchema);
