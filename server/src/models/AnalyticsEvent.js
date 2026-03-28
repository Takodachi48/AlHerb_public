const mongoose = require('mongoose');

const analyticsEventSchema = new mongoose.Schema(
  {
    eventType: {
      type: String,
      required: true,
      trim: true,
      default: 'api_request',
      index: true,
    },
    timestamp: {
      type: Date,
      default: Date.now,
      index: true,
    },
    path: {
      type: String,
      trim: true,
    },
    method: {
      type: String,
      trim: true,
    },
    statusCode: {
      type: Number,
      min: 100,
      max: 599,
    },
    responseTimeMs: {
      type: Number,
      min: 0,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      index: true,
      default: null,
    },
    meta: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
  },
  {
    timestamps: true,
  }
);

analyticsEventSchema.index({ eventType: 1, timestamp: -1 });
analyticsEventSchema.index({ path: 1, timestamp: -1 });

module.exports = mongoose.model('AnalyticsEvent', analyticsEventSchema);
