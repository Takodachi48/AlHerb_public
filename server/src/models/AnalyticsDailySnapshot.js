const mongoose = require('mongoose');

const analyticsDailySnapshotSchema = new mongoose.Schema(
  {
    date: {
      type: Date,
      required: true,
      unique: true,
      index: true,
    },
    counts: {
      signups: { type: Number, default: 0 },
      blogsCreated: { type: Number, default: 0 },
      blogsPublished: { type: Number, default: 0 },
      inquiries: { type: Number, default: 0 },
      classifications: { type: Number, default: 0 },
      recommendations: { type: Number, default: 0 },
    },
    operations: {
      requests: { type: Number, default: 0 },
      errors5xx: { type: Number, default: 0 },
      errorRate5xx: { type: Number, default: 0 },
      avgResponseMs: { type: Number, default: 0 },
      p95ResponseMs: { type: Number, default: 0 },
    },
    quality: {
      pendingBlogReview: { type: Number, default: 0 },
      missingSafetyProfile: { type: Number, default: 0 },
      missingDemographics: { type: Number, default: 0 },
    },
  },
  {
    timestamps: true,
  }
);

analyticsDailySnapshotSchema.index({ date: -1 });

module.exports = mongoose.model('AnalyticsDailySnapshot', analyticsDailySnapshotSchema);
