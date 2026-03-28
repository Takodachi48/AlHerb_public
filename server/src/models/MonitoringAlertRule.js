const mongoose = require('mongoose');

const monitoringAlertRuleSchema = new mongoose.Schema(
  {
    key: {
      type: String,
      required: true,
      unique: true,
      default: 'default',
      index: true,
    },
    enabled: {
      type: Boolean,
      default: false,
    },
    cooldownMinutes: {
      type: Number,
      min: 1,
      max: 1440,
      default: 30,
    },
    thresholds: {
      availabilityPctMin: { type: Number, min: 0, max: 100, default: 99 },
      p95LatencyMsMax: { type: Number, min: 1, default: 1200 },
      errorRate5xxPctMax: { type: Number, min: 0, max: 100, default: 1 },
    },
    channels: {
      email: {
        enabled: { type: Boolean, default: false },
        to: [{ type: String, trim: true }],
      },
      slack: {
        enabled: { type: Boolean, default: false },
        webhookUrl: { type: String, trim: true, default: '' },
      },
      webhook: {
        enabled: { type: Boolean, default: false },
        url: { type: String, trim: true, default: '' },
      },
    },
    lastTriggeredAt: {
      type: Date,
      default: null,
    },
    lastTriggeredMetrics: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model('MonitoringAlertRule', monitoringAlertRuleSchema);
