const mongoose = require('mongoose');

const plantIdentificationSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  image: {
    publicId: {
      type: String,
      required: true
    },
    url: {
      type: String,
      required: true
    },
    originalName: String,
    size: Number,
    format: String
  },
  classification: {
    scientificName: {
      type: String,
      required: true,
      index: true
    },
    commonName: String,
    herbId: {
      type: String, // String to match Herb model _id
      index: true
    },
    confidence: {
      type: Number,
      required: true,
      min: 0,
      max: 100
    },
    alternatives: [{
      scientificName: String,
      confidence: Number
    }],
    modelVersion: String,
    processingTime: Number,
    illustrationUrl: String,
    description: String,
    symptoms: [String],
    uncertainty: {
      isUncertain: { type: Boolean, default: false },
      maxProbability: Number,
      secondProbability: Number,
      margin: Number,
      reasons: [String],
    }
  },
  status: {
    type: String,
    enum: ['pending', 'classified', 'uncertain', 'verified', 'rejected'],
    default: 'pending',
    index: true
  },
  verifiedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  notes: {
    type: String,
    maxlength: 1000
  },
  feedback: {
    userCorrection: String,
    isCorrect: Boolean,
    rating: {
      type: Number,
      min: 1,
      max: 5
    }
  },
  metadata: {
    uploadedAt: {
      type: Date,
      default: Date.now
    },
    classifiedAt: Date,
    verifiedAt: Date,
    ipAddress: String,
    userAgent: String
  }
}, {
  timestamps: true
});

// Indexes for performance
plantIdentificationSchema.index({ user: 1, createdAt: -1 });
plantIdentificationSchema.index({ status: 1, createdAt: -1 });
plantIdentificationSchema.index({ 'classification.scientificName': 1, createdAt: -1 });

// Static methods
plantIdentificationSchema.statics.findByUser = function (userId, limit = 20) {
  return this.find({ user: userId })
    .sort({ createdAt: -1 })
    .limit(limit)
    .populate('user', 'displayName email')
    .populate('verifiedBy', 'displayName email');
};

plantIdentificationSchema.statics.findPending = function (limit = 50) {
  return this.find({ status: 'pending' })
    .sort({ createdAt: -1 })
    .limit(limit)
    .populate('user', 'displayName email');
};

plantIdentificationSchema.statics.findByScientificName = function (scientificName, limit = 20) {
  return this.find({ 'classification.scientificName': scientificName })
    .sort({ createdAt: -1 })
    .limit(limit)
    .populate('user', 'displayName email');
};

// Instance methods
plantIdentificationSchema.methods.markClassified = function (classificationData) {
  this.classification = classificationData;
  this.status = 'classified';
  this.metadata.classifiedAt = new Date();
  return this.save();
};

plantIdentificationSchema.methods.markVerified = function (verifiedBy, notes) {
  this.status = 'verified';
  this.verifiedBy = verifiedBy;
  this.notes = notes;
  this.metadata.verifiedAt = new Date();
  return this.save();
};

plantIdentificationSchema.methods.addFeedback = function (feedbackData) {
  this.feedback = { ...this.feedback, ...feedbackData };
  return this.save();
};

module.exports = mongoose.model('PlantIdentification', plantIdentificationSchema);
