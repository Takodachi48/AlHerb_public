const mongoose = require('mongoose');

/**
 * Symptom
 * Pure taxonomy — what a symptom IS, not what treats it.
 *
 * The recommendation pipeline handles symptom → herb mapping by querying
 * Herb.symptoms directly. This model exists to:
 *   1. Power the symptom autocomplete / search UI
 *   2. Provide category browsing
 *   3. Flag red-flag symptoms that need medical attention
 *   4. Seed the ML feature vocabulary (getAllActive)
 *
 * NOT related to Phytochemical — symptoms are a user-facing concept.
 * The phytochemical → effect → symptom relief chain is captured in
 * Phytochemical.effects and Herb.symptoms, not here.
 */
const symptomSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    index: true,
  },

  description: {
    type: String,
    required: true,
  },

  // ── Taxonomy ──────────────────────────────────────────────────
  category: {
    type: String,
    required: true,
    enum: [
      'digestive',
      'respiratory',
      'cardiovascular',
      'nervous',
      'musculoskeletal',
      'skin',
      'immune',
      'endocrine',
      'reproductive',
      'mental',
      'general',
    ],
    index: true,
  },

  severity: {
    type: String,
    enum: ['mild', 'moderate', 'severe'],
    default: 'moderate',
  },

  duration: {
    type: String,
    enum: ['acute', 'chronic', 'episodic'],
    default: 'acute',
  },

  commonCauses: [{ type: String, trim: true }],

  // Related symptoms — used to suggest related searches in the UI
  relatedSymptoms: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Symptom',
  }],

  // Search keywords — improves text search recall for colloquial terms
  // e.g. symptom name "Cephalalgia" with keyword "headache"
  keywords: [{ type: String, trim: true }],

  // ── Red Flag ──────────────────────────────────────────────────
  // When true, the recommendation UI shows a medical attention warning
  // BEFORE or INSTEAD OF herbal recommendations.
  seekMedicalAttention: {
    type: Boolean,
    default: false,
  },
  medicalAttentionNote: {
    type: String,
    // e.g. "Chest pain may indicate a serious cardiac event. Seek emergency care immediately."
  },

  isActive: { type: Boolean, default: true },

  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },

}, { timestamps: true });

// ── Indexes ───────────────────────────────────────────────────────────────────

symptomSchema.index({
  name: 'text',
  description: 'text',
  keywords: 'text',
  commonCauses: 'text',
});

symptomSchema.index({ seekMedicalAttention: 1 });

// ── Static Methods ────────────────────────────────────────────────────────────

/**
 * PURE LOGIC — Symptom autocomplete / full-text search.
 * Used in the symptom input UI before a recommendation is requested.
 */
symptomSchema.statics.searchSymptoms = function (query) {
  return this.find({
    $text: { $search: query },
    isActive: true,
  })
    .select({ name: 1, category: 1, severity: 1, medicalAttentionNote: 1, score: { $meta: 'textScore' } })
    .sort({ score: { $meta: 'textScore' } });
};

/**
 * PURE LOGIC — Browse symptoms by body system category.
 */
symptomSchema.statics.findByCategory = function (category) {
  return this.find({ category, isActive: true }).sort({ name: 1 });
};

/**
 * PURE LOGIC — Returns all active symptoms for seeding ML feature vocabulary.
 * The ML model needs a consistent symptom label set across training and inference.
 */
symptomSchema.statics.getAllActive = function () {
  return this.find({ isActive: true })
    .select('name category severity')
    .sort({ category: 1, name: 1 });
};

/**
 * PURE LOGIC — Check if any of the user's symptoms are red flags.
 * Called at the start of the recommendation flow — if any red flags are
 * found, the UI warns the user before proceeding with herb suggestions.
 *
 * @param {string[]} symptomNames
 * @returns {Promise<Array>} red flag symptom records
 */
symptomSchema.statics.checkRedFlags = function (symptomNames) {
  if (!Array.isArray(symptomNames) || symptomNames.length === 0) {
    return Promise.resolve([]);
  }
  const patterns = symptomNames
    .map((name) => String(name || '').trim())
    .filter(Boolean)
    .map((name) => new RegExp(`^${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i'));

  return this.find({
    name: { $in: patterns },
    seekMedicalAttention: true,
    isActive: true,
  }).select('name medicalAttentionNote');
};

module.exports = mongoose.model('Symptom', symptomSchema);
