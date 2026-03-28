const mongoose = require('mongoose');

/**
 * Feedback
 * The primary training signal for the random forest model.
 *
 * ML role:
 *   - getTrainingData() exports records the ML pipeline ingests
 *   - Feature columns: user profile at feedback time + herb properties
 *   - Target columns: rating, effectiveness, wouldRecommend
 *
 * NOT related to Phytochemical — feedback is about user outcomes,
 * not compound science. The ML model learns "user profile X responded
 * well to herb Y" patterns, not "compound Z causes effect W".
 */
const feedbackSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true,
  },
  recommendation: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Recommendation',
    required: true,
    index: true,
  },
  herb: {
    type: String,
    ref: 'Herb',
    required: true,
    index: true,
  },

  // ── ML Target Variables ───────────────────────────────────────
  // What the model learns to predict
  rating: {
    type: Number,
    min: 1,
    max: 5,
    required: true,
  },
  effectiveness: {
    type: String,
    enum: ['very_poor', 'poor', 'neutral', 'good', 'excellent'],
    required: true,
  },
  sideEffects: {
    type: String,
    enum: ['none', 'mild', 'moderate', 'severe'],
    required: true,
  },
  wouldRecommend: {
    type: Boolean,
    required: true,
  },
  wouldUseAgain: {
    type: Boolean,
    required: true,
  },

  // ── ML Feature Variables ──────────────────────────────────────
  // User profile captured at feedback time. Mirrors the input the model
  // receives at inference time so training and scoring features match exactly.
  conditions:  [String],  // e.g. ["hypertension", "diabetes"]
  medications: [String],  // e.g. ["metformin", "lisinopril"]
  age:         Number,
  gender: {
    type: String,
    enum: ['male', 'female', 'other'],
  },
  severity: {
    type: String,
    enum: ['mild', 'moderate', 'severe'],
    // Severity of the symptom/condition the herb was taken for
  },

  // ── User Notes (non-ML) ───────────────────────────────────────
  // Free text — admin review and monitoring only, not fed to ML
  sideEffectDetails: [String],
  comments: {
    type: String,
    maxlength: 1000,
    trim: true,
  },

  isActive: { type: Boolean, default: true },

}, { timestamps: true });

// ── Indexes ───────────────────────────────────────────────────────────────────

feedbackSchema.index({ herb: 1, rating: -1 });
feedbackSchema.index({ createdAt: -1 });
feedbackSchema.index({ user: 1, createdAt: -1 });

// ── Static Methods ────────────────────────────────────────────────────────────

/**
 * ML — Training data export.
 * Returns flat records the random forest pipeline ingests.
 * Populates herb.symptoms and herb.properties as additional feature columns
 * so the model can learn herb property × user profile interactions.
 *
 * @param {number} limit
 */
feedbackSchema.statics.getTrainingData = function (limit = 5000) {
  return this.find({ isActive: true })
    .select('herb rating effectiveness sideEffects wouldRecommend wouldUseAgain conditions medications age gender severity')
    .limit(limit)
    .populate('herb', 'symptoms properties')
    .lean()
    .then((rows) => rows.map((row) => ({
      herbId: row.herb?._id || row.herb,
      age: row.age,
      gender: row.gender,
      severity: row.severity,
      conditions: row.conditions || [],
      medications: row.medications || [],
      herb_symptoms: row.herb?.symptoms || [],
      herb_properties: row.herb?.properties || [],
      rating: row.rating,
      effectiveness: row.effectiveness,
      sideEffects: row.sideEffects,
      wouldRecommend: row.wouldRecommend,
      wouldUseAgain: row.wouldUseAgain,
    })));
};

/**
 * PURE LOGIC — Aggregate rating stats per herb for display.
 * @param {string|ObjectId} herbId
 */
feedbackSchema.statics.getHerbStats = function (herbId) {
  return this.aggregate([
    { $match: { herb: String(herbId), isActive: true } },
    {
      $group: {
        _id: '$herb',
        averageRating:      { $avg: '$rating' },
        totalFeedback:      { $sum: 1 },
        wouldRecommendRate: { $avg: { $cond: ['$wouldRecommend', 1, 0] } },
        wouldUseAgainRate:  { $avg: { $cond: ['$wouldUseAgain', 1, 0] } },
        severeSideEffects:  { $sum: { $cond: [{ $eq: ['$sideEffects', 'severe'] }, 1, 0] } },
      },
    },
  ]).then((results) => (results[0] || {
    averageRating: 0,
    totalFeedback: 0,
    wouldRecommendRate: 0,
    wouldUseAgainRate: 0,
    severeSideEffects: 0,
  }));
};

/**
 * PURE LOGIC — User-facing reviews for an herb detail page.
 */
feedbackSchema.statics.findByHerb = function (herbId, limit = 50) {
  return this.find({ herb: herbId, isActive: true })
    .sort({ createdAt: -1 })
    .limit(limit)
    .populate('user', 'displayName')
    .populate('herb', 'name scientificName');
};

/**
 * PURE LOGIC — A user's own feedback history.
 */
feedbackSchema.statics.findByUser = function (userId, limit = 20) {
  return this.find({ user: userId, isActive: true })
    .sort({ createdAt: -1 })
    .limit(limit)
    .populate('herb', 'name scientificName');
};

/**
 * PURE LOGIC — Duplicate submission guard.
 */
feedbackSchema.statics.canUserProvideFeedback = function (userId, recommendationId, herbId) {
  return this.exists({
    user: userId,
    recommendation: recommendationId,
    herb: herbId,
    isActive: true,
  }).then((existing) => !existing);
};

/**
 * PURE LOGIC — Admin: flag low-rated feedback for review.
 */
feedbackSchema.statics.findLowRated = function (ratingThreshold = 2) {
  return this.find({ rating: { $lte: ratingThreshold }, isActive: true })
    .sort({ createdAt: -1 })
    .populate('herb', 'name scientificName')
    .populate('user', 'displayName');
};

/**
 * PURE LOGIC — Admin: recent feedback monitoring stream.
 */
feedbackSchema.statics.getRecentFeedback = function (hours = 24) {
  const cutoff = new Date(Date.now() - hours * 60 * 60 * 1000);
  return this.find({ createdAt: { $gte: cutoff }, isActive: true })
    .sort({ createdAt: -1 })
    .populate('herb', 'name')
    .populate('user', 'displayName');
};

module.exports = mongoose.model('Feedback', feedbackSchema);
