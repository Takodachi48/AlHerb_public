const mongoose = require('mongoose');

const herbReviewSchema = new mongoose.Schema({
  herbId: {
    type: String,
    ref: 'Herb',
    required: true,
    index: true,
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  rating: {
    type: Number,
    required: true,
    min: 1,
    max: 5,
  },
  effectiveness: {
    type: Number,
    required: true,
    min: 1,
    max: 5,
  },
  usedFor: [{
    type: String,
    trim: true,
  }],
  comment: {
    type: String,
    required: true,
    maxlength: 1000,
  },
  wouldRecommend: {
    type: Boolean,
    default: true,
  },
  verified: {
    type: Boolean,
    default: false,
  },
  helpful: {
    count: {
      type: Number,
      default: 0,
    },
    users: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    }],
  },
  isActive: {
    type: Boolean,
    default: true,
  },
}, {
  timestamps: true,
});

// Compound unique index - one review per user per herb
herbReviewSchema.index({ herbId: 1, userId: 1 }, { unique: true });

// Index for filtering
herbReviewSchema.index({ herbId: 1, rating: 1 });
herbReviewSchema.index({ herbId: 1, createdAt: -1 });

// Static method to get herb rating statistics
herbReviewSchema.statics.getHerbStats = async function (herbId) {
  const stats = await this.aggregate([
    {
      $match: {
        herbId,
        isActive: true
      }
    },
    {
      $group: {
        _id: null,
        averageRating: { $avg: '$rating' },
        averageEffectiveness: { $avg: '$effectiveness' },
        totalReviews: { $sum: 1 },
        wouldRecommendCount: {
          $sum: { $cond: ['$wouldRecommend', 1, 0] }
        },
        ratingDistribution: {
          $push: '$rating'
        }
      }
    }
  ]);

  if (stats.length === 0) {
    return {
      averageRating: 0,
      averageEffectiveness: 0,
      totalReviews: 0,
      wouldRecommendPercentage: 0,
      ratingDistribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 }
    };
  }

  const stat = stats[0];

  // Calculate rating distribution
  const distribution = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  stat.ratingDistribution.forEach(rating => {
    distribution[rating] = (distribution[rating] || 0) + 1;
  });

  return {
    averageRating: Math.round(stat.averageRating * 10) / 10,
    averageEffectiveness: Math.round(stat.averageEffectiveness * 10) / 10,
    totalReviews: stat.totalReviews,
    wouldRecommendPercentage: Math.round((stat.wouldRecommendCount / stat.totalReviews) * 100),
    ratingDistribution: distribution
  };
};

// Method to mark review as helpful
herbReviewSchema.methods.markHelpful = function (userId) {
  if (!this.helpful.users.includes(userId)) {
    this.helpful.users.push(userId);
    this.helpful.count += 1;
    return this.save();
  }
  return Promise.resolve(this);
};

module.exports = mongoose.model('HerbReview', herbReviewSchema);
