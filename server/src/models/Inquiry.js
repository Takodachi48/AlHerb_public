const mongoose = require('mongoose');

const inquirySchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true,
    maxlength: 100,
  },
  contactType: {
    type: String,
    enum: ['email', 'phone'],
    required: true,
  },
  contactValue: {
    type: String,
    required: true,
    trim: true,
    maxlength: 255,
  },
  message: {
    type: String,
    required: true,
    trim: true,
    maxlength: 1000,
  },
  isResponded: {
    type: Boolean,
    default: false,
  },
  createdAt: {
    type: Date,
    default: Date.now,
    index: true,
  },
  updatedAt: {
    type: Date,
    default: Date.now,
  },
}, {
  timestamps: true,
});

// Index for efficient querying
inquirySchema.index({ createdAt: -1 });
inquirySchema.index({ isResponded: 1, createdAt: -1 });

// Update the updatedAt field before saving
inquirySchema.pre('save', function (next) {
  this.updatedAt = Date.now();
  next();
});

// Static method to get pending inquiries
inquirySchema.statics.findPending = function (limit = 50) {
  return this.find({ isResponded: false })
    .sort({ createdAt: -1 })
    .limit(limit);
};

// Static method to get recent inquiries
inquirySchema.statics.findRecent = function (limit = 20) {
  return this.find({})
    .sort({ createdAt: -1 })
    .limit(limit);
};

module.exports = mongoose.model('Inquiry', inquirySchema);
