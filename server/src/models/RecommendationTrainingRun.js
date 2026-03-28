const mongoose = require('mongoose');

const recommendationTrainingRunSchema = new mongoose.Schema(
  {
    idempotency_key: { type: String, trim: true, index: true, unique: true, sparse: true },
    saved: { type: Boolean, required: true, index: true },
    model_version: { type: String, trim: true },
    trained_at: { type: Date, index: true },
    run_started_at: { type: Date },
    reason: { type: String, trim: true },
    record_count: { type: Number, min: 0 },
    cv_scores: {
      rmse_mean: { type: Number },
      accuracy_mean: { type: Number },
    },
  },
  {
    timestamps: true,
    strict: false,
  }
);

recommendationTrainingRunSchema.index({ saved: 1, trained_at: -1, createdAt: -1 });

module.exports = mongoose.model('RecommendationTrainingRun', recommendationTrainingRunSchema);
