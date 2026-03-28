const mongoose = require('mongoose');

const coordinateLookupCacheSchema = new mongoose.Schema({
  coordHash: {
    type: String,
    required: true,
    unique: true,
    index: true,
  },
  lat: {
    type: Number,
    required: true,
  },
  lng: {
    type: Number,
    required: true,
  },
  city: {
    type: String,
    trim: true,
    default: '',
  },
  province: {
    type: String,
    trim: true,
    default: '',
  },
  country: {
    type: String,
    trim: true,
    default: '',
  },
  postcode: {
    type: String,
    trim: true,
    default: '',
  },
  provider: {
    type: String,
    enum: ['nominatim', 'geoapify', 'opencage'],
    default: 'nominatim',
  },
  lookupStatus: {
    type: String,
    enum: ['success', 'failed'],
    default: 'success',
  },
  failureCount: {
    type: Number,
    default: 0,
  },
  lastLookupAt: {
    type: Date,
    default: Date.now,
  },
  nextRetryAt: {
    type: Date,
    default: null,
  },
  raw: {
    type: mongoose.Schema.Types.Mixed,
    default: null,
  },
}, {
  timestamps: true,
});

coordinateLookupCacheSchema.index({ lastLookupAt: -1 });

module.exports = mongoose.model('CoordinateLookupCache', coordinateLookupCacheSchema);
