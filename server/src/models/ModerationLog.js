const mongoose = require('mongoose');

const moderationLogSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      enum: ['comment_profanity'],
      required: true,
      index: true,
    },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    blog: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Blog',
      required: true,
      index: true,
    },
    originalContent: {
      type: String,
      required: true,
    },
    sanitizedContent: {
      type: String,
      required: true,
    },
    metadata: {
      sourceIp: String,
      userAgent: String,
    },
  },
  {
    timestamps: true,
  }
);

moderationLogSchema.index({ createdAt: -1 });

module.exports = mongoose.model('ModerationLog', moderationLogSchema);
