const mongoose = require('mongoose');

const recommendationSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true,
  },
  symptoms: [{
    type: String,
    required: true,
    trim: true,
  }],
  age: {
    type: Number,
    min: 0,
    max: 150,
  },
  gender: {
    type: String,
    enum: ['male', 'female'],
  },
  additionalInfo: {
    medications: [String],
    allergies: [String],
    conditions: [String],
    preferences: [String],
  },
  recommendations: [{
    herb: {
      type: String,
      ref: 'Herb',
      required: true,
    },
    confidence: {
      type: Number,
      min: 0,
      max: 1,
      required: true,
    },
    reasoning: String,
    dosage: String,
    preparation: String,
    warnings: [String],
    alternatives: [{
      herb: {
        type: String,
        ref: 'Herb',
      },
      reason: String,
    }],
  }],
  mlModel: {
    version: String,
    confidence: Number,
    processingTime: Number,
  },
  userFeedback: {
    helpful: {
      type: Boolean,
    },
    effective: {
      type: Boolean,
    },
    sideEffects: [String],
    notes: String,
    rating: {
      type: Number,
      min: 1,
      max: 5,
    },
    wouldRecommend: {
      type: Boolean,
    },
    feedbackDate: {
      type: Date,
    },
  },
  status: {
    type: String,
    enum: ['pending', 'completed', 'feedback_provided'],
    default: 'completed',
  },
  isActive: {
    type: Boolean,
    default: true,
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

// Index for user recommendations lookup
recommendationSchema.index({ user: 1, createdAt: -1 });

// Index for feedback analysis
recommendationSchema.index({ 'userFeedback.feedbackDate': 1 });

// Index for ML training data
recommendationSchema.index({ symptoms: 1, age: 1, gender: 1 });

// Update the updatedAt field before saving
recommendationSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

// Static method to get recommendations by user
recommendationSchema.statics.findByUser = function(userId, limit = 10) {
  return this.find({ user: userId, isActive: true })
    .sort({ createdAt: -1 })
    .limit(limit)
    .populate('recommendations.herb')
    .populate('recommendations.alternatives.herb');
};

// Static method to get recommendations with feedback
recommendationSchema.statics.findWithFeedback = function() {
  return this.find({
    'userFeedback.feedbackDate': { $exists: true },
    isActive: true,
  }).populate('user recommendations.herb');
};

// Static method to get recommendations for ML training
recommendationSchema.statics.getTrainingData = function(limit = 1000) {
  return this.find({
    'userFeedback.feedbackDate': { $exists: true },
    isActive: true,
  })
    .select('symptoms age gender additionalInfo recommendations userFeedback')
    .limit(limit)
    .lean();
};

// Method to add user feedback
recommendationSchema.methods.addFeedback = function(feedbackData) {
  this.userFeedback = {
    ...feedbackData,
    feedbackDate: new Date(),
  };
  this.status = 'feedback_provided';
  return this.save();
};

// Method to get top recommendation
recommendationSchema.methods.getTopRecommendation = function() {
  if (!this.recommendations || this.recommendations.length === 0) {
    return null;
  }
  
  return this.recommendations.reduce((top, current) => 
    current.confidence > top.confidence ? current : top
  );
};

// Method to calculate average confidence
recommendationSchema.methods.getAverageConfidence = function() {
  if (!this.recommendations || this.recommendations.length === 0) {
    return 0;
  }
  
  const total = this.recommendations.reduce((sum, rec) => sum + rec.confidence, 0);
  return total / this.recommendations.length;
};

module.exports = mongoose.model('Recommendation', recommendationSchema);
