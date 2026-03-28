const mongoose = require('mongoose');

const blogSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
    trim: true,
    index: true,
  },
  slug: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true,
  },
  excerpt: {
    type: String,
    required: true,
    maxlength: 300,
  },
  content: {
    type: String,
    required: true,
  },
  author: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true,
  },
  category: {
    type: String,
    required: true,
    enum: [
      'herb_profiles',
      'remedies',
      'research',
      'safety',
      'gardening',
      'foraging',
      'recipes',
      'news',
      'interviews',
      'general',
    ],
    index: true,
  },
  tags: [{
    type: String,
    trim: true,
    index: true,
  }],
  featuredImage: {
    url: String,
    caption: String,
    alt: String,
  },
  images: [{
    url: String,
    caption: String,
    alt: String,
  }],
  relatedHerbs: [{
    type: String,
    ref: 'Herb',
  }],
  relatedSymptoms: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Symptom',
  }],
  readingTime: {
    type: Number,
    min: 1,
  },
  status: {
    type: String,
    enum: ['draft', 'review', 'published', 'archived'],
    default: 'draft',
    index: true,
  },
  revisionOf: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Blog',
    default: null,
    index: true,
  },
  supersededBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Blog',
    default: null,
    index: true,
  },
  moderation: {
    reason: {
      type: String,
      trim: true,
      maxlength: 300,
    },
    reasonType: {
      type: String,
      enum: ['preset', 'custom', 'system'],
      default: 'system',
    },
    presetKey: {
      type: String,
      trim: true,
      maxlength: 100,
    },
    previousStatus: {
      type: String,
      enum: ['draft', 'review', 'published', 'archived'],
    },
    nextStatus: {
      type: String,
      enum: ['draft', 'review', 'published', 'archived'],
    },
    actedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    actedAt: {
      type: Date,
    },
  },
  moderationHistory: [{
    reason: {
      type: String,
      trim: true,
      maxlength: 300,
    },
    reasonType: {
      type: String,
      enum: ['preset', 'custom', 'system'],
      default: 'system',
    },
    presetKey: {
      type: String,
      trim: true,
      maxlength: 100,
    },
    previousStatus: {
      type: String,
      enum: ['draft', 'review', 'published', 'archived'],
    },
    nextStatus: {
      type: String,
      enum: ['draft', 'review', 'published', 'archived'],
    },
    actedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    actedAt: {
      type: Date,
      default: Date.now,
    },
  }],
  publishedAt: {
    type: Date,
  },
  seo: {
    metaTitle: String,
    metaDescription: String,
    keywords: [String],
  },
  social: {
    facebookShareCount: {
      type: Number,
      default: 0,
    },
    twitterShareCount: {
      type: Number,
      default: 0,
    },
    linkedinShareCount: {
      type: Number,
      default: 0,
    },
  },
  analytics: {
    views: {
      type: Number,
      default: 0,
    },
    uniqueViews: {
      type: Number,
      default: 0,
    },
    averageReadTime: {
      type: Number,
      default: 0,
    },
    bounceRate: {
      type: Number,
      default: 0,
    },
  },
  comments: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'BlogComment',
  }],
  likes: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  }],
  likeCount: {
    type: Number,
    default: 0,
  },
  bookmarks: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  }],
  bookmarkCount: {
    type: Number,
    default: 0,
  },
  commentCount: {
    type: Number,
    default: 0,
  },
  featured: {
    type: Boolean,
    default: false,
    index: true,
  },
  pinned: {
    type: Boolean,
    default: false,
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

// Text search index
blogSchema.index({
  title: 'text',
  excerpt: 'text',
  content: 'text',
  tags: 'text',
});

// Compound index for published posts
blogSchema.index({ status: 1, publishedAt: -1 });

// Index for category and status
blogSchema.index({ category: 1, status: 1 });

// Update the updatedAt field before saving
blogSchema.pre('save', function (next) {
  this.updatedAt = Date.now();
  this.likeCount = Array.isArray(this.likes) ? this.likes.length : 0;
  this.bookmarkCount = Array.isArray(this.bookmarks) ? this.bookmarks.length : 0;
  this.commentCount = Array.isArray(this.comments) ? this.comments.length : 0;

  // Set publishedAt when status changes to published
  if (this.isModified('status') && this.status === 'published' && !this.publishedAt) {
    this.publishedAt = new Date();
  }

  // Generate slug from title if not provided
  if (this.isModified('title') && !this.slug) {
    this.slug = this.title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '')
      + '-' + Date.now();
  }

  next();
});

// Static method to find published posts
blogSchema.statics.findPublished = function (limit = 10, skip = 0) {
  return this.find({ status: 'published', isActive: true })
    .sort({ publishedAt: -1 })
    .skip(skip)
    .limit(limit)
    .populate('author', 'displayName photoURL')
    .populate('relatedHerbs', 'name scientificName')
    .populate('relatedSymptoms', 'name');
};

// Static method to find featured posts
blogSchema.statics.findFeatured = function (limit = 5) {
  return this.find({
    featured: true,
    status: 'published',
    isActive: true
  })
    .sort({ publishedAt: -1 })
    .limit(limit)
    .populate('author', 'displayName photoURL')
    .populate('relatedHerbs', 'name scientificName');
};

// Static method to search blog posts
blogSchema.statics.searchPosts = function (query, limit = 10) {
  return this.find({
    $text: { $search: query },
    status: 'published',
    isActive: true,
  })
    .sort({ score: { $meta: 'textScore' } })
    .limit(limit)
    .populate('author', 'displayName photoURL')
    .populate('relatedHerbs', 'name scientificName');
};

// Static method to find posts by category
blogSchema.statics.findByCategory = function (category, limit = 10) {
  return this.find({
    category,
    status: 'published',
    isActive: true
  })
    .sort({ publishedAt: -1 })
    .limit(limit)
    .populate('author', 'displayName photoURL');
};

// Static method to find posts by author
blogSchema.statics.findByAuthor = function (authorId, limit = 10) {
  return this.find({
    author: authorId,
    isActive: true
  })
    .sort({ createdAt: -1 })
    .limit(limit)
    .populate('author', 'displayName photoURL');
};

// Method to increment view count
blogSchema.methods.incrementView = function () {
  this.analytics.views += 1;
  return this.save();
};

blogSchema.methods.toggleLike = function (userId) {
  const existingIndex = this.likes.findIndex((likeUserId) => String(likeUserId) === String(userId));

  if (existingIndex > -1) {
    this.likes.splice(existingIndex, 1);
  } else {
    this.likes.push(userId);
  }

  return this.save();
};

blogSchema.methods.toggleBookmark = function (userId) {
  const existingIndex = this.bookmarks.findIndex(
    (bookmarkUserId) => String(bookmarkUserId) === String(userId)
  );

  if (existingIndex > -1) {
    this.bookmarks.splice(existingIndex, 1);
  } else {
    this.bookmarks.push(userId);
  }

  return this.save();
};

blogSchema.methods.isLikedBy = function (userId) {
  return this.likes.some((likeUserId) => String(likeUserId) === String(userId));
};

blogSchema.methods.isBookmarkedBy = function (userId) {
  return this.bookmarks.some((bookmarkUserId) => String(bookmarkUserId) === String(userId));
};

// Method to get related posts
blogSchema.methods.getRelatedPosts = function (limit = 3) {
  return this.constructor
    .find({
      _id: { $ne: this._id },
      status: 'published',
      isActive: true,
      $or: [
        { category: this.category },
        { tags: { $in: this.tags } },
        { relatedHerbs: { $in: this.relatedHerbs } },
      ],
    })
    .sort({ publishedAt: -1 })
    .limit(limit)
    .populate('author', 'displayName photoURL');
};

// Method to calculate estimated reading time
blogSchema.methods.calculateReadingTime = function () {
  const wordsPerMinute = 200;
  const wordCount = this.content.split(/\s+/).length;
  this.readingTime = Math.ceil(wordCount / wordsPerMinute);
  return this.readingTime;
};

module.exports = mongoose.model('Blog', blogSchema);
