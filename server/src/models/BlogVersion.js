const mongoose = require('mongoose');

const blogVersionSchema = new mongoose.Schema({
  blog: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Blog',
    required: true,
    index: true,
  },
  versionNumber: {
    type: Number,
    required: true,
    min: 1,
  },
  status: {
    type: String,
    enum: ['draft', 'review', 'published', 'archived'],
    default: 'draft',
    index: true,
  },
  snapshot: {
    title: { type: String, required: true, trim: true },
    excerpt: { type: String, required: true, maxlength: 300 },
    content: { type: String, required: true },
    slug: { type: String, trim: true, lowercase: true },
    category: {
      type: String,
      enum: ['herb_profiles', 'remedies', 'research', 'safety', 'gardening', 'foraging', 'recipes', 'news', 'interviews', 'general'],
      required: true,
    },
    tags: [{ type: String, trim: true }],
    featuredImage: {
      url: String,
      caption: String,
      alt: String,
    },
    seo: {
      metaTitle: String,
      metaDescription: String,
      keywords: [String],
    },
    readingTime: Number,
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  approvedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null,
  },
  approvedAt: {
    type: Date,
    default: null,
  },
  archivedAt: {
    type: Date,
    default: null,
  },
}, {
  timestamps: true,
});

blogVersionSchema.index({ blog: 1, versionNumber: -1 }, { unique: true });
blogVersionSchema.index({ blog: 1, status: 1, updatedAt: -1 });

module.exports = mongoose.model('BlogVersion', blogVersionSchema);

