const mongoose = require('mongoose');

const blogCommentSchema = new mongoose.Schema({
  blog: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Blog',
    required: true,
    index: true,
  },
  author: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true,
  },
  content: {
    type: String,
    required: true,
    trim: true,
    maxlength: 2000,
  },
  parent: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'BlogComment',
    default: null,
  },
  replies: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'BlogComment',
  }],
  likes: [{
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    createdAt: {
      type: Date,
      default: Date.now,
    },
  }],
  likeCount: {
    type: Number,
    default: 0,
  },
  isEdited: {
    type: Boolean,
    default: false,
  },
  editedAt: {
    type: Date,
  },
  isDeleted: {
    type: Boolean,
    default: false,
  },
  isRemoved: {
    type: Boolean,
    default: false,
    index: true,
  },
  removedBy: {
    type: String,
    enum: ['user', 'admin', 'moderator'],
    default: null,
  },
  removedAt: {
    type: Date,
    default: null,
  },
  deletedAt: {
    type: Date,
  },
  deletedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  },
  moderation: {
    isApproved: {
      type: Boolean,
      default: true,
    },
    isFlagged: {
      type: Boolean,
      default: false,
    },
    flagReason: String,
    moderatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    moderatedAt: Date,
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

// Index for blog comments lookup
blogCommentSchema.index({ blog: 1, createdAt: -1 });

// Index for parent-child relationships
blogCommentSchema.index({ parent: 1, createdAt: 1 });

// Index for author comments
blogCommentSchema.index({ author: 1, createdAt: -1 });

// Update the updatedAt field before saving
blogCommentSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  
  // Mark as edited if content is modified and it's not a new comment
  if (this.isModified('content') && !this.isNew) {
    this.isEdited = true;
    this.editedAt = new Date();
  }
  
  next();
});

// Update like count when likes array changes
blogCommentSchema.pre('save', function(next) {
  this.likeCount = this.likes.length;
  next();
});

// Static method to find comments by blog post
blogCommentSchema.statics.findByBlog = function(blogId, includeDeleted = false) {
  const query = { 
    blog: blogId,
    parent: null, // Only top-level comments
    isActive: true,
  };
  
  if (!includeDeleted) {
    query.isDeleted = false;
  }
  
  return this.find(query)
    .sort({ createdAt: -1 })
    .populate('author', 'displayName photoURL email')
    .populate({
      path: 'replies',
      match: { isDeleted: false, isActive: true },
      populate: {
        path: 'author',
        select: 'displayName photoURL email',
      },
    });
};

// Static method to find comments by author
blogCommentSchema.statics.findByAuthor = function(authorId, limit = 10) {
  return this.find({
    author: authorId,
    isDeleted: false,
    isActive: true,
  })
    .sort({ createdAt: -1 })
    .limit(limit)
    .populate('blog', 'title slug');
};

// Static method to find flagged comments
blogCommentSchema.statics.findFlagged = function() {
  return this.find({
    'moderation.isFlagged': true,
    isActive: true,
  })
    .sort({ 'moderation.moderatedAt': -1 })
    .populate('author', 'displayName email')
    .populate('blog', 'title slug');
};

// Method to add reply
blogCommentSchema.methods.addReply = function(replyId) {
  this.replies.push(replyId);
  return this.save();
};

// Method to toggle like
blogCommentSchema.methods.toggleLike = function(userId) {
  const existingLike = this.likes.findIndex(function(like) {
    return like.user.toString() === userId.toString();
  });
  
  if (existingLike > -1) {
    this.likes.splice(existingLike, 1);
  } else {
    this.likes.push({ user: userId });
  }
  
  return this.save();
};

// Method to check if user liked comment
blogCommentSchema.methods.isLikedBy = function(userId) {
  return this.likes.some(like => like.user.toString() === userId.toString());
};

// Method to soft delete comment
blogCommentSchema.methods.softDelete = function(deletedBy, removedByRole = 'user') {
  const normalizedRole = ['admin', 'moderator'].includes(removedByRole) ? removedByRole : 'user';
  this.isRemoved = true;
  this.removedBy = normalizedRole;
  this.removedAt = new Date();
  this.isDeleted = true;
  this.deletedAt = new Date();
  this.deletedBy = deletedBy;
  return this.save();
};

// Method to flag comment for moderation
blogCommentSchema.methods.flag = function(reason, moderatedBy) {
  this.moderation.isFlagged = true;
  this.moderation.flagReason = reason;
  this.moderation.moderatedBy = moderatedBy;
  this.moderation.moderatedAt = new Date();
  return this.save();
};

// Method to approve comment
blogCommentSchema.methods.approve = function(moderatedBy) {
  this.moderation.isApproved = true;
  this.moderation.isFlagged = false;
  this.moderation.moderatedBy = moderatedBy;
  this.moderation.moderatedAt = new Date();
  return this.save();
};

// Method to get comment depth
blogCommentSchema.methods.getDepth = async function() {
  let depth = 0;
  let currentComment = this;
  
  while (currentComment.parent) {
    depth++;
    currentComment = await this.constructor.findById(currentComment.parent);
    if (!currentComment) break;
  }
  
  return depth;
};

// Method to format comment for API response
blogCommentSchema.methods.toJSON = function() {
  const comment = this.toObject();
  
  if (comment.isDeleted) {
    const role = comment.removedBy || 'user';
    comment.content = '';
    comment.removalNote = role === 'user'
      ? 'Comment removed by user'
      : 'Comment removed by admin/moderator';
  }
  
  return comment;
};

module.exports = mongoose.model('BlogComment', blogCommentSchema);
