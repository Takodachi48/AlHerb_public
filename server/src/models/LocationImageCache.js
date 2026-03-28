const mongoose = require('mongoose');

const locationImageCacheSchema = new mongoose.Schema({
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
  point: {
    type: {
      type: String,
      enum: ['Point'],
      default: 'Point',
    },
    coordinates: {
      type: [Number], // [lng, lat]
      required: true,
    },
  },
  provider: {
    type: String,
    enum: ['wikimedia', 'mapillary', 'kartaView', 'googleStreetView'],
    default: 'wikimedia',
  },
  imageUrl: {
    type: String,
    trim: true,
    default: '',
  },
  thumbnailUrl: {
    type: String,
    trim: true,
    default: '',
  },
  distanceMeters: {
    type: Number,
    default: null,
  },
  attribution: {
    type: String,
    trim: true,
    default: '',
  },
  capturedAt: {
    type: Date,
    default: null,
  },
  status: {
    type: String,
    enum: ['success', 'missing', 'failed'],
    default: 'success',
  },
  failureCount: {
    type: Number,
    default: 0,
  },
  lastFetchedAt: {
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

locationImageCacheSchema.index({ point: '2dsphere' });
locationImageCacheSchema.index({ lastFetchedAt: -1 });

module.exports = mongoose.model('LocationImageCache', locationImageCacheSchema);
