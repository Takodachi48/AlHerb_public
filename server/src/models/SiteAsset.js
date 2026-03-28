const mongoose = require('mongoose');

const siteAssetSchema = new mongoose.Schema({
  type: {
    type: String,
    required: true,
    enum: ['placeholder', 'carousel', 'background'],
  },
  name: {
    type: String,
    required: true,
    trim: true,
  },
  description: {
    type: String,
    trim: true,
    default: '',
  },
  cloudinaryUrl: {
    type: String,
    required: true,
  },
  publicId: {
    type: String,
    required: true,
  },
  isActive: {
    type: Boolean,
    default: true,
  },
  order: {
    type: Number,
    default: 0,
  },
  metadata: {
    width: Number,
    height: Number,
    format: String,
    size: Number,
  },
}, {
  timestamps: true, // Adds createdAt and updatedAt
});

// Index for efficient queries
siteAssetSchema.index({ type: 1, isActive: 1, order: 1 });

// Static method to get active assets by type
siteAssetSchema.statics.getActiveByType = function(type) {
  return this.find({ type, isActive: true }).sort({ order: 1 });
};

// Static method to get all assets by type
siteAssetSchema.statics.getByType = function(type) {
  return this.find({ type }).sort({ order: 1 });
};

const SiteAsset = mongoose.model('SiteAsset', siteAssetSchema);

module.exports = SiteAsset;
