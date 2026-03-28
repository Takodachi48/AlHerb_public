const mongoose = require('mongoose');

const locationReviewSchema = new mongoose.Schema({
  locationId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Location',
    required: true,
    index: true,
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  likes: {
    count: {
      type: Number,
      default: 0,
    },
    users: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    }],
  },
  dislikes: {
    count: {
      type: Number,
      default: 0,
    },
    users: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    }],
  },
  comment: {
    type: String,
    required: true,
    maxlength: 1000,
  },
  wouldReturn: {
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
  images: [{
    url: String,
    caption: String,
  }],
  isActive: {
    type: Boolean,
    default: true,
  },
}, {
  timestamps: true,
});

// Compound unique index - one review per user per location
locationReviewSchema.index({ locationId: 1, userId: 1 }, { unique: true });

// Index for filtering
locationReviewSchema.index({ locationId: 1, createdAt: -1 });

// Static method to get location rating statistics
locationReviewSchema.statics.getLocationStats = async function (locationId) {
  const stats = await this.aggregate([
    {
      $match: {
        locationId: new mongoose.Types.ObjectId(locationId),
        isActive: true
      }
    },
    {
      $group: {
        _id: null,
        totalReviews: { $sum: 1 },
        totalLikes: { $sum: '$likes.count' },
        totalDislikes: { $sum: '$dislikes.count' },
        wouldReturnCount: {
          $sum: { $cond: ['$wouldReturn', 1, 0] }
        },
      }
    }
  ]);

  if (stats.length === 0) {
    return {
      totalReviews: 0,
      totalLikes: 0,
      totalDislikes: 0,
      wouldReturnPercentage: 0,
      likeRatio: 0
    };
  }

  const stat = stats[0];
  const totalVotes = stat.totalLikes + stat.totalDislikes;
  const likeRatio = totalVotes > 0 ? Math.round((stat.totalLikes / totalVotes) * 100) : 0;

  return {
    totalReviews: stat.totalReviews,
    totalLikes: stat.totalLikes,
    totalDislikes: stat.totalDislikes,
    wouldReturnPercentage: Math.round((stat.wouldReturnCount / stat.totalReviews) * 100),
    likeRatio: likeRatio
  };
};

// Method to like a review
locationReviewSchema.methods.likeReview = function (userId) {
  // Remove from dislikes if present
  const dislikeIndex = this.dislikes.users.indexOf(userId);
  if (dislikeIndex !== -1) {
    this.dislikes.users.splice(dislikeIndex, 1);
    this.dislikes.count -= 1;
  }
  
  // Add to likes if not already present
  if (!this.likes.users.includes(userId)) {
    this.likes.users.push(userId);
    this.likes.count += 1;
    return this.save();
  }
  return Promise.resolve(this);
};

// Method to dislike a review
locationReviewSchema.methods.dislikeReview = function (userId) {
  // Remove from likes if present
  const likeIndex = this.likes.users.indexOf(userId);
  if (likeIndex !== -1) {
    this.likes.users.splice(likeIndex, 1);
    this.likes.count -= 1;
  }
  
  // Add to dislikes if not already present
  if (!this.dislikes.users.includes(userId)) {
    this.dislikes.users.push(userId);
    this.dislikes.count += 1;
    return this.save();
  }
  return Promise.resolve(this);
};

// Method to remove like/dislike
locationReviewSchema.methods.removeVote = function (userId) {
  const likeIndex = this.likes.users.indexOf(userId);
  const dislikeIndex = this.dislikes.users.indexOf(userId);
  
  if (likeIndex !== -1) {
    this.likes.users.splice(likeIndex, 1);
    this.likes.count -= 1;
  }
  
  if (dislikeIndex !== -1) {
    this.dislikes.users.splice(dislikeIndex, 1);
    this.dislikes.count -= 1;
  }
  
  return this.save();
};

// Method to mark review as helpful
locationReviewSchema.methods.markHelpful = function (userId) {
  if (!this.helpful.users.includes(userId)) {
    this.helpful.users.push(userId);
    this.helpful.count += 1;
    return this.save();
  }
  return Promise.resolve(this);
};

module.exports = mongoose.model('LocationReview', locationReviewSchema);