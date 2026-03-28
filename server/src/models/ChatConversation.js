const mongoose = require('mongoose');

const chatMessageSchema = new mongoose.Schema({
  role: {
    type: String,
    enum: ['user', 'assistant', 'system'],
    required: true,
  },
  content: {
    type: String,
    required: true,
    trim: true,
  },
  timestamp: {
    type: Date,
    default: Date.now,
  },
  metadata: {
    model: String,
    tokens: Number,
    processingTime: Number,
    confidence: Number,
  },
});

const chatConversationSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true,
  },
  title: {
    type: String,
    required: true,
    trim: true,
    maxlength: 100,
  },
  messages: [chatMessageSchema],
  context: {
    symptoms: [String],
    age: Number,
    gender: {
      type: String,
      enum: ['male', 'female'],
    },
    medications: [String],
    allergies: [String],
    conditions: [String],
    preferences: [String],
    location: {
      type: {
        type: String,
        enum: ['Point'],
        default: 'Point',
      },
      coordinates: {
        type: [Number],
        default: [0, 0],
      },
    },
  },
  session: {
    sessionId: {
      type: String,
      required: true,
      index: true,
    },
    startTime: {
      type: Date,
      default: Date.now,
    },
    endTime: Date,
    duration: Number,
    platform: {
      type: String,
      enum: ['web', 'mobile'],
      default: 'web',
    },
  },
  feedback: {
    helpful: {
      type: Boolean,
    },
    rating: {
      type: Number,
      min: 1,
      max: 5,
    },
    comments: String,
    feedbackDate: Date,
  },
  analytics: {
    messageCount: {
      type: Number,
      default: 0,
    },
    totalTokens: {
      type: Number,
      default: 0,
    },
    averageResponseTime: {
      type: Number,
      default: 0,
    },
    userSatisfaction: {
      type: Number,
      min: 1,
      max: 5,
    },
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

// Index for user conversations
chatConversationSchema.index({ user: 1, createdAt: -1 });

// Update the updatedAt field before saving
chatConversationSchema.pre('save', function (next) {
  this.updatedAt = Date.now();

  // Update analytics
  if (this.isModified('messages')) {
    this.analytics.messageCount = this.messages.length;
    this.analytics.totalTokens = this.messages.reduce((sum, msg) =>
      sum + (msg.metadata?.tokens || 0), 0);
  }

  // Update session duration
  if (this.session.endTime && this.session.startTime) {
    this.session.duration = this.session.endTime - this.session.startTime;
  }

  next();
});

// Static method to find conversations by user
chatConversationSchema.statics.findByUser = function (userId, limit = 20) {
  return this.find({ user: userId, isActive: true })
    .sort({ createdAt: -1 })
    .limit(limit)
    .select('title createdAt updatedAt session feedback analytics');
};

// Static method to find conversation by session ID
chatConversationSchema.statics.findBySessionId = function (sessionId) {
  return this.findOne({ 'session.sessionId': sessionId, isActive: true })
    .populate('user', 'displayName email');
};

// Static method to get conversation statistics
chatConversationSchema.statics.getStats = function (userId = null) {
  const matchCondition = { isActive: true };
  if (userId) {
    matchCondition.user = new mongoose.Types.ObjectId(userId);
  }

  return this.aggregate([
    { $match: matchCondition },
    {
      $group: {
        _id: null,
        totalConversations: { $sum: 1 },
        averageMessages: { $avg: '$analytics.messageCount' },
        averageDuration: { $avg: '$session.duration' },
        satisfactionRate: { $avg: '$analytics.userSatisfaction' },
      },
    },
  ]);
};

// Static method to get recent conversations for monitoring
chatConversationSchema.statics.getRecentConversations = function (hours = 24) {
  const cutoffDate = new Date(Date.now() - hours * 60 * 60 * 1000);
  return this.find({
    createdAt: { $gte: cutoffDate },
    isActive: true,
  })
    .sort({ createdAt: -1 })
    .populate('user', 'displayName email')
    .select('title createdAt session analytics');
};

// Method to add message
chatConversationSchema.methods.addMessage = function (role, content, metadata = {}) {
  this.messages.push({
    role,
    content,
    timestamp: new Date(),
    metadata,
  });
  return this.save();
};

// Method to end conversation
chatConversationSchema.methods.endConversation = function () {
  this.session.endTime = new Date();
  if (this.session.startTime) {
    this.session.duration = this.session.endTime - this.session.startTime;
  }
  return this.save();
};

// Method to add feedback
chatConversationSchema.methods.addFeedback = function (feedbackData) {
  this.feedback = {
    ...feedbackData,
    feedbackDate: new Date(),
  };
  return this.save();
};

// Method to get last message
chatConversationSchema.methods.getLastMessage = function () {
  if (!this.messages || this.messages.length === 0) {
    return null;
  }
  return this.messages[this.messages.length - 1];
};

// Method to get conversation summary
chatConversationSchema.methods.getSummary = function () {
  return {
    id: this._id,
    title: this.title,
    messageCount: this.messages.length,
    duration: this.session.duration,
    startTime: this.session.startTime,
    endTime: this.session.endTime,
    hasFeedback: !!this.feedback,
    rating: this.feedback?.rating,
  };
};

module.exports = mongoose.model('ChatConversation', chatConversationSchema);
