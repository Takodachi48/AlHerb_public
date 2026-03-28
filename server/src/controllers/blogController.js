const mongoose = require('mongoose');
const Blog = require('../models/Blog');
const BlogVersion = require('../models/BlogVersion');
const { validationResult } = require('express-validator');
const { formatSuccess, formatError, formatPaginatedResponse } = require('../utils/responseFormatter');
const notificationService = require('../services/notificationService');
const SearchService = require('../services/searchService');

const isReviewerRole = (role) => role === 'admin' || role === 'moderator';

const BLOG_STATUSES = ['draft', 'review', 'published', 'archived'];
const isValidObjectId = (id) => mongoose.Types.ObjectId.isValid(id);

const buildModerationEntry = ({
  previousStatus,
  nextStatus,
  reviewerId,
  moderationReason,
  moderationReasonType,
  moderationReasonPreset,
}) => {
  const trimmedReason = typeof moderationReason === 'string' ? moderationReason.trim() : '';
  const trimmedPreset = typeof moderationReasonPreset === 'string' ? moderationReasonPreset.trim() : '';
  const explicitType = moderationReasonType === 'preset' || moderationReasonType === 'custom'
    ? moderationReasonType
    : null;

  let reasonType = explicitType;
  if (!reasonType) {
    reasonType = trimmedReason ? 'custom' : (trimmedPreset ? 'preset' : 'system');
  }

  const reason = trimmedReason || (trimmedPreset ? trimmedPreset : `Status changed from ${previousStatus} to ${nextStatus}`);

  return {
    reason,
    reasonType,
    presetKey: reasonType === 'preset' ? trimmedPreset : '',
    previousStatus,
    nextStatus,
    actedBy: reviewerId,
    actedAt: new Date(),
  };
};

const serializeBlogForClient = (blogDoc, userId = null) => {
  const raw = typeof blogDoc?.toObject === 'function' ? blogDoc.toObject() : blogDoc;
  if (!raw) return null;

  const likes = Array.isArray(raw.likes) ? raw.likes : [];
  const bookmarks = Array.isArray(raw.bookmarks) ? raw.bookmarks : [];
  const comments = Array.isArray(raw.comments) ? raw.comments : [];
  const normalizedUserId = userId ? String(userId) : null;

  return {
    ...raw,
    likeCount: typeof raw.likeCount === 'number' ? raw.likeCount : likes.length,
    bookmarkCount: typeof raw.bookmarkCount === 'number' ? raw.bookmarkCount : bookmarks.length,
    commentCount: typeof raw.commentCount === 'number' ? raw.commentCount : comments.length,
    isLiked: normalizedUserId ? likes.some((id) => String(id) === normalizedUserId) : false,
    isBookmarked: normalizedUserId ? bookmarks.some((id) => String(id) === normalizedUserId) : false,
  };
};

const toSnapshot = (source = {}) => {
  const title = String(source.title || '').trim();
  const excerpt = String(source.excerpt || '').trim();
  const content = String(source.content || '').trim();
  const slug = String(source.slug || '').trim().toLowerCase();
  const category = String(source.category || 'general').trim();
  const tags = Array.isArray(source.tags)
    ? source.tags.map((tag) => String(tag).trim()).filter(Boolean)
    : [];

  const snapshot = {
    title,
    excerpt,
    content,
    slug,
    category,
    tags,
    featuredImage: source.featuredImage || null,
    seo: source.seo || null,
    readingTime: source.readingTime || null,
  };

  if (!snapshot.slug) {
    snapshot.slug = title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '')
      + '-' + Date.now();
  }

  return snapshot;
};

const findLatestPendingVersion = async (blogId) => {
  return BlogVersion.findOne({
    blog: blogId,
    status: { $in: ['draft', 'review'] },
  }).sort({ versionNumber: -1, updatedAt: -1 });
};

const getNextVersionNumber = async (blogId) => {
  const latest = await BlogVersion.findOne({ blog: blogId }).sort({ versionNumber: -1 });
  return (latest?.versionNumber || 0) + 1;
};

const createOrUpdateDraftVersion = async ({ blog, payload, actorId }) => {
  const snapshot = toSnapshot({
    title: payload.title || blog.title,
    excerpt: payload.excerpt || blog.excerpt,
    content: payload.content || blog.content,
    slug: payload.slug || blog.slug,
    category: payload.category || blog.category,
    tags: payload.tags || blog.tags,
    featuredImage: payload.featuredImage || blog.featuredImage,
    seo: payload.seo || blog.seo,
    readingTime: payload.readingTime || blog.readingTime,
  });

  const existingDraft = await BlogVersion.findOne({ blog: blog._id, status: 'draft' }).sort({ versionNumber: -1 });
  if (existingDraft) {
    existingDraft.snapshot = snapshot;
    existingDraft.createdBy = actorId;
    await existingDraft.save();
    return existingDraft;
  }

  const versionNumber = await getNextVersionNumber(blog._id);
  const created = await BlogVersion.create({
    blog: blog._id,
    versionNumber,
    status: 'draft',
    snapshot,
    createdBy: actorId,
  });
  return created;
};

const archiveSupersededPublishedBlog = async (revisionBlog, reviewerId) => {
  if (!revisionBlog?.revisionOf) return;

  const originalBlog = await Blog.findById(revisionBlog.revisionOf);
  if (!originalBlog) return;
  if (String(originalBlog._id) === String(revisionBlog._id)) return;
  if (originalBlog.status !== 'published') return;

  const moderationEntry = buildModerationEntry({
    previousStatus: originalBlog.status,
    nextStatus: 'archived',
    reviewerId,
    moderationReason: 'Automatically archived because a revision was approved and published',
    moderationReasonType: 'system',
    moderationReasonPreset: 'revision_superseded',
  });

  originalBlog.status = 'archived';
  originalBlog.supersededBy = revisionBlog._id;
  originalBlog.moderation = moderationEntry;
  originalBlog.moderationHistory = [...(originalBlog.moderationHistory || []), moderationEntry].slice(-50);
  await originalBlog.save();
};

// Get all published blogs (public endpoint)
const getPublishedBlogs = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;
    const category = req.query.category;

    let query = { status: 'published', isActive: true };
    if (category) {
      query.category = category;
    }

    const blogs = await Blog.find(query)
      .sort({ publishedAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate('author', 'displayName photoURL')
      .select('title excerpt author category featuredImage publishedAt slug readingTime likeCount bookmarkCount commentCount likes bookmarks comments analytics');

    const total = await Blog.countDocuments(query);

    console.log('Found blogs:', blogs.length, 'Total:', total);

    // If no blogs exist, return a sample blog for testing
    if (blogs.length === 0) {
      const sampleBlog = {
        _id: 'sample-123',
        title: 'Getting Started with Herbal Medicine',
        excerpt: 'A comprehensive guide to beginning your journey into herbal remedies and natural healing.',
        author: {
          displayName: 'Herb Expert',
          photoURL: null
        },
        category: 'general',
        featuredImage: {
          url: 'https://picsum.photos/400/200?random=1',
          caption: 'Fresh herbs and medicinal plants',
          alt: 'Collection of medicinal herbs and plants'
        },
        publishedAt: new Date(),
        slug: 'getting-started-with-herbal-medicine',
        readingTime: 5
      };

      const result = {
        blogs: [sampleBlog],
        pagination: {
          page,
          limit,
          total: 1,
          pages: 1
        }
      };

      res.json(formatSuccess(result, 'Sample blog retrieved successfully'));
      return;
    }

    const currentUserId = req.user?._id || null;
    const serializedBlogs = blogs.map((blog) => serializeBlogForClient(blog, currentUserId));

    // Return consistent response format
    const result = {
      blogs: serializedBlogs,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    };

    res.json(formatSuccess(result, 'Blogs retrieved successfully'));
  } catch (error) {
    console.error('Error fetching blogs:', error);
    res.status(500).json(formatError('Failed to fetch blogs', error.message));
  }
};

const getFeaturedBlogs = async (req, res) => {
  try {
    const limit = Math.max(1, Math.min(25, parseInt(req.query.limit, 10) || 8));
    const currentUserId = req.user?._id || null;

    const blogs = await Blog.find({ status: 'published', isActive: true, featured: true })
      .sort({ pinned: -1, publishedAt: -1, createdAt: -1 })
      .limit(limit)
      .populate('author', 'displayName photoURL')
      .select('title excerpt author category featuredImage publishedAt slug readingTime likeCount bookmarkCount commentCount likes bookmarks featured analytics comments');

    const serializedBlogs = blogs.map((blog) => serializeBlogForClient(blog, currentUserId));
    return res.json(formatSuccess(serializedBlogs, 'Featured blogs retrieved successfully'));
  } catch (error) {
    console.error('Error fetching featured blogs:', error);
    return res.status(500).json(formatError('Failed to fetch featured blogs', error.message));
  }
};

const getTrendingBlogs = async (req, res) => {
  try {
    const limit = Math.max(1, Math.min(25, parseInt(req.query.limit, 10) || 10));

    const rows = await Blog.aggregate([
      { $match: { status: 'published', isActive: true } },
      {
        $addFields: {
          computedViews: { $ifNull: ['$analytics.views', 0] },
          trendScore: {
            $add: [
              { $multiply: [{ $ifNull: ['$likeCount', 0] }, 4] },
              { $multiply: [{ $ifNull: ['$bookmarkCount', 0] }, 2] },
              { $ifNull: ['$analytics.views', 0] },
            ],
          },
        },
      },
      { $sort: { trendScore: -1, computedViews: -1, publishedAt: -1, createdAt: -1 } },
      { $limit: limit },
      {
        $lookup: {
          from: 'users',
          localField: 'author',
          foreignField: '_id',
          as: 'author',
        },
      },
      {
        $unwind: {
          path: '$author',
          preserveNullAndEmptyArrays: true,
        },
      },
      {
        $project: {
          title: 1,
          excerpt: 1,
          category: 1,
          featuredImage: 1,
          publishedAt: 1,
          slug: 1,
          readingTime: 1,
          likeCount: 1,
          bookmarkCount: 1,
          likes: 1,
          bookmarks: 1,
          featured: 1,
          analytics: 1,
          trendScore: 1,
          commentCount: 1,
          author: {
            _id: '$author._id',
            displayName: '$author.displayName',
            photoURL: '$author.photoURL',
          },
        },
      },
    ]);

    const currentUserId = req.user?._id || null;
    const serialized = rows.map((row) => serializeBlogForClient(row, currentUserId));
    return res.json(formatSuccess(serialized, 'Trending blogs retrieved successfully'));
  } catch (error) {
    console.error('Error fetching trending blogs:', error);
    return res.status(500).json(formatError('Failed to fetch trending blogs', error.message));
  }
};

const getBlogMetrics = async (req, res) => {
  try {
    const { id } = req.params;
    if (!isValidObjectId(id)) {
      return res.status(400).json(formatError('Invalid blog id', 400));
    }

    const blog = await Blog.findOne({ _id: id, isActive: true })
      .select('title slug status analytics likeCount bookmarkCount commentCount comments')
      .lean();

    if (!blog) {
      return res.status(404).json(formatError('Blog not found', 404));
    }

    const views = Number(blog.analytics?.views || 0);
    const uniqueViews = Number(blog.analytics?.uniqueViews || 0);
    const likes = Number(blog.likeCount || 0);
    const bookmarks = Number(blog.bookmarkCount || 0);
    const comments = typeof blog.commentCount === 'number' ? blog.commentCount : (Array.isArray(blog.comments) ? blog.comments.length : 0);
    const engagementRate = views > 0
      ? Number((((likes + bookmarks + comments) / views) * 100).toFixed(2))
      : 0;

    return res.json(formatSuccess({
      blogId: blog._id,
      title: blog.title,
      slug: blog.slug,
      status: blog.status,
      views,
      uniqueViews,
      likes,
      bookmarks,
      comments,
      engagementRate,
    }, 'Blog metrics retrieved successfully'));
  } catch (error) {
    console.error('Error fetching blog metrics:', error);
    return res.status(500).json(formatError('Failed to fetch blog metrics', error.message));
  }
};

// Get blog by slug (public endpoint)
const getBlogBySlug = async (req, res) => {
  try {
    const { slug } = req.params;

    const blog = await Blog.findOne({
      slug,
      status: 'published',
      isActive: true
    })
      .populate('author', 'displayName photoURL')
    // .populate('relatedHerbs', 'name scientificName')
    // .populate('relatedSymptoms', 'name'); // Commented out - Symptom model not registered

    if (!blog) {
      return res.status(404).json({
        success: false,
        message: 'Blog not found'
      });
    }

    // Increment view count for functional analytics.
    await Blog.updateOne(
      { _id: blog._id },
      { $inc: { 'analytics.views': 1 } }
    );

    const serializedBlog = serializeBlogForClient(blog, req.user?._id || null);
    serializedBlog.analytics = {
      ...(serializedBlog.analytics || {}),
      views: Number(serializedBlog.analytics?.views || 0) + 1,
    };
    res.json(serializedBlog);
  } catch (error) {
    console.error('Error fetching blog:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch blog',
      error: error.message
    });
  }
};

// Get blog by ID (protected endpoint for editing)
const getBlogById = async (req, res) => {
  try {
    const { id } = req.params;

    const blog = await Blog.findById(id)
      .populate('author', 'displayName photoURL');

    if (!blog) {
      return res.status(404).json({
        success: false,
        message: 'Blog not found'
      });
    }

    // Check if user is the author or admin
    if (blog.author._id.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    const pendingVersion = await findLatestPendingVersion(blog._id);
    if (pendingVersion) {
      const merged = {
        ...blog.toObject(),
        ...pendingVersion.snapshot,
        status: pendingVersion.status,
        baseStatus: blog.status,
        versionId: pendingVersion._id,
        versionNumber: pendingVersion.versionNumber,
      };
      return res.json(merged);
    }

    res.json(blog);
  } catch (error) {
    console.error('Error fetching blog:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch blog',
      error: error.message
    });
  }
};

// Create new blog (protected endpoint)
const createBlog = async (req, res) => {
  try {
    console.log('Create blog request body:', req.body);
    console.log('User from request:', req.user);

    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      console.log('Validation errors:', errors.array());
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'User not authenticated'
      });
    }

    const revisionOf = String(req.body?.revisionOf || '').trim();
    if (revisionOf) {
      if (!isValidObjectId(revisionOf)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid revisionOf blog id'
        });
      }

      const parentBlog = await Blog.findById(revisionOf);
      if (!parentBlog) {
        return res.status(404).json({
          success: false,
          message: 'Parent blog not found'
        });
      }

      if (parentBlog.author.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
        return res.status(403).json({
          success: false,
          message: 'Not authorized to create a revision for this blog'
        });
      }

      const version = await createOrUpdateDraftVersion({
        blog: parentBlog,
        payload: req.body,
        actorId: req.user._id,
      });

      return res.status(201).json({
        ...serializeBlogForClient(parentBlog, req.user._id),
        status: version.status,
        versionId: version._id,
        versionNumber: version.versionNumber,
        revisionOf: parentBlog._id,
      });
    }

    const requestedStatus = req.body.status || 'draft';
    if (requestedStatus === 'published' && !isReviewerRole(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: 'Only admin or moderator can publish blogs. Request approval first.'
      });
    }

    const blogData = {
      ...req.body,
      status: requestedStatus,
      author: req.user._id, // Use _id for MongoDB ObjectId
      slug: req.body.title.toLowerCase().replace(/[^a-z0-9]+/g, '-') + '-' + Date.now()
    };

    console.log('Blog data to save:', blogData);

    const blog = new Blog(blogData);
    await blog.save();

    await BlogVersion.create({
      blog: blog._id,
      versionNumber: 1,
      status: blog.status,
      snapshot: toSnapshot(blogData),
      createdBy: req.user._id,
      approvedBy: blog.status === 'published' ? req.user._id : null,
      approvedAt: blog.status === 'published' ? new Date() : null,
    });

    const populatedBlog = await Blog.findById(blog._id)
      .populate('author', 'displayName photoURL');

    if (blog.status === 'published') {
      notificationService
        .queueBlogStatusNotifications({ blog: populatedBlog, eventType: 'published' })
        .catch((error) => console.error('Failed to queue blog published notifications:', error.message));
    }

    console.log('Blog created successfully:', populatedBlog);

    // Return consistent format - just the data
    res.status(201).json(populatedBlog);
  } catch (error) {
    console.error('Error creating blog:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create blog',
      error: error.message
    });
  }
};

// Update blog (protected endpoint)
const updateBlog = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const { id } = req.params;
    const blog = await Blog.findById(id);
    const previousStatus = blog?.status;

    if (!blog) {
      return res.status(404).json({
        success: false,
        message: 'Blog not found'
      });
    }

    // Check if user is the author or admin
    if (blog.author.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to update this blog'
      });
    }

    const requestedStatus = req.body.status;
    if (requestedStatus === 'published' && !isReviewerRole(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: 'Only admin or moderator can publish blogs. Request approval first.'
      });
    }

    if (blog.status === 'published' && requestedStatus !== 'archived') {
      const version = await createOrUpdateDraftVersion({
        blog,
        payload: req.body,
        actorId: req.user._id,
      });

      return res.json({
        ...serializeBlogForClient(blog, req.user._id),
        ...version.snapshot,
        status: version.status,
        baseStatus: blog.status,
        versionId: version._id,
        versionNumber: version.versionNumber,
      });
    }

    const nextStatus = requestedStatus || blog.status;

    Object.assign(blog, {
      ...req.body,
      status: nextStatus,
    });
    await blog.save();

    const updatedBlog = await Blog.findById(blog._id)
      .populate('author', 'displayName photoURL');

    const snapshot = toSnapshot({
      title: updatedBlog.title,
      excerpt: updatedBlog.excerpt,
      content: updatedBlog.content,
      slug: updatedBlog.slug,
      category: updatedBlog.category,
      tags: updatedBlog.tags,
      featuredImage: updatedBlog.featuredImage,
      seo: updatedBlog.seo,
      readingTime: updatedBlog.readingTime,
    });

    const existingCurrentVersion = await BlogVersion.findOne({
      blog: updatedBlog._id,
      status: { $in: ['draft', 'review'] },
    }).sort({ versionNumber: -1 });
    if (existingCurrentVersion) {
      existingCurrentVersion.snapshot = snapshot;
      existingCurrentVersion.status = updatedBlog.status;
      await existingCurrentVersion.save();
    } else {
      const versionNumber = await getNextVersionNumber(updatedBlog._id);
      await BlogVersion.create({
        blog: updatedBlog._id,
        versionNumber,
        status: updatedBlog.status,
        snapshot,
        createdBy: req.user._id,
      });
    }

    if (previousStatus !== updatedBlog.status && updatedBlog.status === 'published') {
      notificationService
        .queueBlogStatusNotifications({ blog: updatedBlog, eventType: 'published' })
        .catch((error) => console.error('Failed to queue blog published notifications:', error.message));
    }

    // Return consistent format - just the data
    res.json(updatedBlog);
  } catch (error) {
    console.error('Error updating blog:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update blog',
      error: error.message
    });
  }
};

const requestBlogApproval = async (req, res) => {
  try {
    const { id } = req.params;
    const blog = await Blog.findById(id);

    if (!blog) {
      return res.status(404).json({
        success: false,
        message: 'Blog not found'
      });
    }

    if (blog.author.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Only the author can request approval'
      });
    }

    const draftVersion = await BlogVersion.findOne({ blog: blog._id, status: 'draft' }).sort({ versionNumber: -1 });
    if (draftVersion) {
      draftVersion.status = 'review';
      await draftVersion.save();

      const updated = await Blog.findById(blog._id).populate('author', 'displayName photoURL');
      return res.json(formatSuccess({
        ...serializeBlogForClient(updated, req.user._id),
        ...draftVersion.snapshot,
        status: 'review',
        baseStatus: updated.status,
        versionId: draftVersion._id,
        versionNumber: draftVersion.versionNumber,
      }, 'Blog revision submitted for approval'));
    }

    if (blog.status === 'published') {
      return res.status(400).json({
        success: false,
        message: 'Blog is already published'
      });
    }

    blog.status = 'review';
    await blog.save();

    const updated = await Blog.findById(blog._id).populate('author', 'displayName photoURL');
    return res.json(formatSuccess(updated, 'Blog submitted for approval'));
  } catch (error) {
    console.error('Error requesting blog approval:', error);
    return res.status(500).json(formatError('Failed to request blog approval', error.message));
  }
};

const approveAndPublishBlog = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json(formatError('Validation failed', errors.array()));
    }

    if (!isReviewerRole(req.user.role)) {
      return res.status(403).json(formatError('Admin or moderator access required', 403));
    }

    const { id } = req.params;
    const blog = await Blog.findById(id);
    if (!blog) {
      return res.status(404).json(formatError('Blog not found', 404));
    }

    const reviewVersion = await BlogVersion.findOne({ blog: blog._id, status: 'review' }).sort({ versionNumber: -1 });
    if (reviewVersion) {
      blog.title = reviewVersion.snapshot.title;
      blog.excerpt = reviewVersion.snapshot.excerpt;
      blog.content = reviewVersion.snapshot.content;
      blog.slug = reviewVersion.snapshot.slug || blog.slug;
      blog.category = reviewVersion.snapshot.category;
      blog.tags = reviewVersion.snapshot.tags || [];
      blog.featuredImage = reviewVersion.snapshot.featuredImage || blog.featuredImage;
      blog.seo = reviewVersion.snapshot.seo || blog.seo;
      blog.readingTime = reviewVersion.snapshot.readingTime || blog.readingTime;
    }

    const previousStatus = blog.status;
    const moderationEntry = buildModerationEntry({
      previousStatus,
      nextStatus: 'published',
      reviewerId: req.user._id,
      moderationReason: req.body?.moderationReason,
      moderationReasonType: req.body?.moderationReasonType,
      moderationReasonPreset: req.body?.moderationReasonPreset,
    });

    blog.status = 'published';
    blog.moderation = moderationEntry;
    blog.moderationHistory = [...(blog.moderationHistory || []), moderationEntry].slice(-50);
    await blog.save();
    await archiveSupersededPublishedBlog(blog, req.user._id);

    if (reviewVersion) {
      await BlogVersion.updateMany(
        { blog: blog._id, status: 'published', _id: { $ne: reviewVersion._id } },
        { $set: { status: 'archived', archivedAt: new Date() } }
      );
      reviewVersion.status = 'published';
      reviewVersion.approvedBy = req.user._id;
      reviewVersion.approvedAt = new Date();
      await reviewVersion.save();
    }

    const updated = await Blog.findById(blog._id)
      .populate('author', 'displayName photoURL')
      .populate('moderation.actedBy', 'displayName email')
      .populate('moderationHistory.actedBy', 'displayName email');
    notificationService
      .queueBlogStatusNotifications({ blog: updated, eventType: 'published' })
      .catch((error) => console.error('Failed to queue blog published notifications:', error.message));

    return res.json(formatSuccess(updated, 'Blog approved and published successfully'));
  } catch (error) {
    console.error('Error approving blog:', error);
    return res.status(500).json(formatError('Failed to approve and publish blog', error.message));
  }
};

const getAdminBlogs = async (req, res) => {
  try {
    if (!isReviewerRole(req.user.role)) {
      return res.status(403).json(formatError('Admin or moderator access required', 403));
    }

    const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 10, 1), 100);
    const status = req.query.status || 'all';
    const search = (req.query.search || '').trim();

    const query = { isActive: true };
    if (status !== 'all' && status !== 'review' && BLOG_STATUSES.includes(status)) {
      query.status = status;
    }

    const shouldApplyDbSearch = Boolean(search) && status !== 'all' && status !== 'review';
    if (shouldApplyDbSearch) {
      const regex = new RegExp(search, 'i');
      query.$or = [
        { title: regex },
        { excerpt: regex },
        { category: regex },
        { tags: { $in: [regex] } },
      ];
    }

    const blogs = await Blog.find(query)
      .sort({ createdAt: -1 })
      .populate('author', 'displayName photoURL email')
      .populate('moderation.actedBy', 'displayName email')
      .populate('moderationHistory.actedBy', 'displayName email')
      .select('title excerpt author category status moderation moderationHistory featuredImage createdAt updatedAt publishedAt slug readingTime likeCount bookmarkCount commentCount comments analytics');

    // Include latest review versions in admin queue so revision requests appear for moderation.
    const candidateBlogIds = blogs.map((blog) => blog._id);
    const reviewVersions = await BlogVersion.find({
      blog: { $in: candidateBlogIds },
      status: 'review',
    }).sort({ versionNumber: -1, updatedAt: -1 });

    const latestReviewVersionByBlog = new Map();
    for (const version of reviewVersions) {
      const key = String(version.blog);
      if (!latestReviewVersionByBlog.has(key)) {
        latestReviewVersionByBlog.set(key, version);
      }
    }

    let effectiveBlogs = blogs.map((blogDoc) => {
      const blog = blogDoc.toObject();
      const pendingReview = latestReviewVersionByBlog.get(String(blog._id));
      if (!pendingReview) return blog;

      return {
        ...blog,
        title: pendingReview.snapshot?.title || blog.title,
        excerpt: pendingReview.snapshot?.excerpt || blog.excerpt,
        content: pendingReview.snapshot?.content || blog.content,
        slug: pendingReview.snapshot?.slug || blog.slug,
        category: pendingReview.snapshot?.category || blog.category,
        tags: pendingReview.snapshot?.tags || blog.tags,
        featuredImage: pendingReview.snapshot?.featuredImage || blog.featuredImage,
        seo: pendingReview.snapshot?.seo || blog.seo,
        readingTime: pendingReview.snapshot?.readingTime || blog.readingTime,
        status: 'review',
        baseStatus: blog.status,
        versionId: pendingReview._id,
        versionNumber: pendingReview.versionNumber,
        updatedAt: pendingReview.updatedAt || blog.updatedAt,
      };
    });

    if (search) {
      const regex = new RegExp(search, 'i');
      effectiveBlogs = effectiveBlogs.filter((blog) => (
        regex.test(blog.title || '')
        || regex.test(blog.excerpt || '')
        || regex.test(blog.category || '')
        || (Array.isArray(blog.tags) && blog.tags.some((tag) => regex.test(String(tag || ''))))
      ));
    }

    if (status !== 'all') {
      effectiveBlogs = effectiveBlogs.filter((blog) => blog.status === status);
    }

    effectiveBlogs.sort((a, b) => {
      const aTime = new Date(a.updatedAt || a.createdAt || 0).getTime();
      const bTime = new Date(b.updatedAt || b.createdAt || 0).getTime();
      return bTime - aTime;
    });

    const total = effectiveBlogs.length;
    const totalPages = Math.max(1, Math.ceil(total / limit));
    const safePage = Math.min(page, totalPages);
    const skip = (safePage - 1) * limit;
    const pagedBlogs = effectiveBlogs.slice(skip, skip + limit);

    // Status counts should also reflect effective (version-aware) workflow status.
    const allActiveBlogs = await Blog.find({ isActive: true }).select('_id status');
    const allBlogIds = allActiveBlogs.map((entry) => entry._id);
    const allPendingVersions = await BlogVersion.find({
      blog: { $in: allBlogIds },
      status: { $in: ['draft', 'review'] },
    }).sort({ versionNumber: -1, updatedAt: -1 }).select('blog status');

    const latestPendingByBlog = new Map();
    for (const version of allPendingVersions) {
      const key = String(version.blog);
      if (!latestPendingByBlog.has(key)) {
        latestPendingByBlog.set(key, version);
      }
    }

    const stats = { all: 0, draft: 0, review: 0, published: 0, archived: 0 };
    for (const blog of allActiveBlogs) {
      const effectiveStatus = latestPendingByBlog.get(String(blog._id))?.status || blog.status;
      if (Object.prototype.hasOwnProperty.call(stats, effectiveStatus)) {
        stats[effectiveStatus] += 1;
      }
    }
    stats.all = stats.draft + stats.review + stats.published + stats.archived;

    return res.json({
      blogs: pagedBlogs,
      pagination: {
        page: safePage,
        limit,
        total,
        totalPages,
      },
      stats,
    });
  } catch (error) {
    console.error('Error fetching admin blogs:', error);
    return res.status(500).json(formatError('Failed to fetch admin blogs', error.message));
  }
};

const moderateBlog = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json(formatError('Validation failed', errors.array()));
    }

    if (!isReviewerRole(req.user.role)) {
      return res.status(403).json(formatError('Admin or moderator access required', 403));
    }

    const { id } = req.params;
    const { status } = req.body;

    if (!BLOG_STATUSES.includes(status)) {
      return res.status(400).json(formatError('Invalid moderation status', 400));
    }

    const blog = await Blog.findById(id);
    if (!blog) {
      return res.status(404).json(formatError('Blog not found', 404));
    }

    const reviewVersion = await BlogVersion.findOne({ blog: blog._id, status: 'review' }).sort({ versionNumber: -1 });
    // If a published blog has a pending review revision, "reject to draft" should demote
    // the revision only and keep the live published blog unchanged.
    if (reviewVersion && blog.status === 'published' && status === 'draft') {
      reviewVersion.status = 'draft';
      await reviewVersion.save();

      const updated = await Blog.findById(blog._id)
        .populate('author', 'displayName photoURL')
        .populate('moderation.actedBy', 'displayName email')
        .populate('moderationHistory.actedBy', 'displayName email');

      return res.json(formatSuccess(
        {
          ...updated.toObject(),
          status: 'draft',
          baseStatus: updated.status,
          versionId: reviewVersion._id,
          versionNumber: reviewVersion.versionNumber,
        },
        'Revision moved back to draft successfully'
      ));
    }
    if (reviewVersion && status === 'published') {
      blog.title = reviewVersion.snapshot.title;
      blog.excerpt = reviewVersion.snapshot.excerpt;
      blog.content = reviewVersion.snapshot.content;
      blog.slug = reviewVersion.snapshot.slug || blog.slug;
      blog.category = reviewVersion.snapshot.category;
      blog.tags = reviewVersion.snapshot.tags || [];
      blog.featuredImage = reviewVersion.snapshot.featuredImage || blog.featuredImage;
      blog.seo = reviewVersion.snapshot.seo || blog.seo;
      blog.readingTime = reviewVersion.snapshot.readingTime || blog.readingTime;
    }

    const previousStatus = blog.status;
    const moderationEntry = buildModerationEntry({
      previousStatus,
      nextStatus: status,
      reviewerId: req.user._id,
      moderationReason: req.body?.moderationReason,
      moderationReasonType: req.body?.moderationReasonType,
      moderationReasonPreset: req.body?.moderationReasonPreset,
    });
    blog.status = status;
    blog.moderation = moderationEntry;
    blog.moderationHistory = [...(blog.moderationHistory || []), moderationEntry].slice(-50);
    await blog.save();

    if (status === 'published') {
      await archiveSupersededPublishedBlog(blog, req.user._id);
      if (reviewVersion) {
        await BlogVersion.updateMany(
          { blog: blog._id, status: 'published', _id: { $ne: reviewVersion._id } },
          { $set: { status: 'archived', archivedAt: new Date() } }
        );
        reviewVersion.status = 'published';
        reviewVersion.approvedBy = req.user._id;
        reviewVersion.approvedAt = new Date();
        await reviewVersion.save();
      }
    }

    const updated = await Blog.findById(blog._id)
      .populate('author', 'displayName photoURL')
      .populate('moderation.actedBy', 'displayName email')
      .populate('moderationHistory.actedBy', 'displayName email');

    if (previousStatus !== updated.status && updated.status === 'published') {
      notificationService
        .queueBlogStatusNotifications({ blog: updated, eventType: 'published' })
        .catch((error) => console.error('Failed to queue blog published notifications:', error.message));
    }

    return res.json(formatSuccess(updated, `Blog moved to ${status} successfully`));
  } catch (error) {
    console.error('Error moderating blog:', error);
    return res.status(500).json(formatError('Failed to moderate blog', error.message));
  }
};

const updateBlogStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const nextStatus = String(req.body?.status || '').trim();

    if (!['draft', 'archived'].includes(nextStatus)) {
      return res.status(400).json(formatError('Status must be draft or archived', 400));
    }

    const blog = await Blog.findById(id);
    if (!blog) {
      return res.status(404).json(formatError('Blog not found', 404));
    }

    if (String(blog.author) !== String(req.user._id) && req.user.role !== 'admin') {
      return res.status(403).json(formatError('Not authorized to update this blog status', 403));
    }

    blog.status = nextStatus;
    await blog.save();

    if (nextStatus === 'archived') {
      await BlogVersion.updateMany(
        { blog: blog._id, status: { $in: ['draft', 'review'] } },
        { $set: { status: 'archived', archivedAt: new Date() } }
      );
    }

    if (nextStatus === 'draft') {
      const latestArchivedPending = await BlogVersion.findOne({
        blog: blog._id,
        status: 'archived',
      }).sort({ versionNumber: -1 });

      if (latestArchivedPending) {
        latestArchivedPending.status = 'draft';
        latestArchivedPending.archivedAt = null;
        await latestArchivedPending.save();
      }
    }

    const updated = await Blog.findById(blog._id).populate('author', 'displayName photoURL');
    return res.json(formatSuccess(updated, `Blog status changed to ${nextStatus}`));
  } catch (error) {
    console.error('Error updating blog status:', error);
    return res.status(500).json(formatError('Failed to update blog status', error.message));
  }
};

const toggleBlogLike = async (req, res) => {
  try {
    const { id } = req.params;
    if (!isValidObjectId(id)) {
      return res.status(400).json(formatError('Invalid blog id', 400));
    }

    const blog = await Blog.findOne({ _id: id, isActive: true });
    if (!blog) {
      return res.status(404).json(formatError('Blog not found', 404));
    }

    await blog.toggleLike(req.user._id);

    // Trigger notification if liked (not unliked)
    if (blog.isLikedBy(req.user._id)) {
      notificationService.sendLikeNotification({ blog, liker: req.user })
        .catch(err => console.error('Failed to send like notification:', err.message));
    }

    return res.json(
      formatSuccess(
        {
          blogId: blog._id,
          liked: blog.isLikedBy(req.user._id),
          likesCount: blog.likeCount,
          bookmarkCount: blog.bookmarkCount,
          isBookmarked: blog.isBookmarkedBy(req.user._id),
        },
        'Blog like status updated successfully'
      )
    );
  } catch (error) {
    console.error('Error toggling blog like:', error);
    return res.status(500).json(formatError('Failed to toggle blog like', error.message));
  }
};

const toggleBlogBookmark = async (req, res) => {
  try {
    const { id } = req.params;
    if (!isValidObjectId(id)) {
      return res.status(400).json(formatError('Invalid blog id', 400));
    }

    const blog = await Blog.findOne({ _id: id, isActive: true });
    if (!blog) {
      return res.status(404).json(formatError('Blog not found', 404));
    }

    await blog.toggleBookmark(req.user._id);

    return res.json(
      formatSuccess(
        {
          blogId: blog._id,
          bookmarked: blog.isBookmarkedBy(req.user._id),
          bookmarkCount: blog.bookmarkCount,
          likesCount: blog.likeCount,
          isLiked: blog.isLikedBy(req.user._id),
        },
        'Blog bookmark status updated successfully'
      )
    );
  } catch (error) {
    console.error('Error toggling blog bookmark:', error);
    return res.status(500).json(formatError('Failed to toggle blog bookmark', error.message));
  }
};

const getBlogLikes = async (req, res) => {
  try {
    const { id } = req.params;
    if (!isValidObjectId(id)) {
      return res.status(400).json(formatError('Invalid blog id', 400));
    }

    const blog = await Blog.findOne({ _id: id, isActive: true })
      .populate({
        path: 'likes',
        select: 'displayName photoURL email role'
      });

    if (!blog) {
      return res.status(404).json(formatError('Blog not found', 404));
    }

    // Sort by most recently liked if possible, else just return the array
    const users = Array.isArray(blog.likes) ? blog.likes : [];

    return res.json(formatSuccess({ users }, 'Blog likes retrieved successfully'));
  } catch (error) {
    console.error('Error fetching blog likes:', error);
    return res.status(500).json(formatError('Failed to fetch blog likes', error.message));
  }
};

const getSavedBlogs = async (req, res) => {
  try {
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 10;
    const skip = (page - 1) * limit;

    const query = {
      status: 'published',
      isActive: true,
      bookmarks: req.user._id,
    };

    const [blogs, total] = await Promise.all([
      Blog.find(query)
        .sort({ updatedAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate('author', 'displayName photoURL')
        .select('title excerpt author category featuredImage publishedAt slug readingTime likeCount bookmarkCount likes bookmarks comments'),
      Blog.countDocuments(query),
    ]);

    const serializedBlogs = blogs.map((blog) => serializeBlogForClient(blog, req.user._id));

    return res.json(
      formatSuccess(
        {
          blogs: serializedBlogs,
          pagination: {
            page,
            limit,
            total,
            totalPages: Math.ceil(total / limit) || 1,
          },
        },
        'Saved blogs retrieved successfully'
      )
    );
  } catch (error) {
    console.error('Error fetching saved blogs:', error);
    return res.status(500).json(formatError('Failed to retrieve saved blogs', error.message));
  }
};

const setBlogFeatured = async (req, res) => {
  try {
    if (req.user?.role !== 'admin') {
      return res.status(403).json(formatError('Admin access required', 403));
    }

    const { id } = req.params;
    if (!isValidObjectId(id)) {
      return res.status(400).json(formatError('Invalid blog id', 400));
    }

    const featured = Boolean(req.body?.featured);
    const blog = await Blog.findOne({ _id: id, isActive: true });
    if (!blog) {
      return res.status(404).json(formatError('Blog not found', 404));
    }

    blog.featured = featured;
    await blog.save();

    const updated = await Blog.findById(blog._id).populate('author', 'displayName photoURL');
    return res.json(formatSuccess(serializeBlogForClient(updated, req.user._id), `Blog ${featured ? 'featured' : 'unfeatured'} successfully`));
  } catch (error) {
    console.error('Error updating blog featured flag:', error);
    return res.status(500).json(formatError('Failed to update featured status', error.message));
  }
};

// Delete blog (protected endpoint)
const deleteBlog = async (req, res) => {
  try {
    const { id } = req.params;
    const blog = await Blog.findById(id);

    if (!blog) {
      return res.status(404).json({
        success: false,
        message: 'Blog not found'
      });
    }

    // Check if user is the author or admin
    if (blog.author.toString() !== req.user._id && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to delete this blog'
      });
    }

    await Blog.findByIdAndDelete(id);

    res.json({
      success: true,
      message: 'Blog deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting blog:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete blog',
      error: error.message
    });
  }
};

// Get user's blogs (protected endpoint)
const getUserBlogs = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;
    const status = req.query.status || 'all';

    let query = { author: req.user._id, isActive: true }; // Use _id instead of id
    if (status !== 'all') {
      query.status = status;
    }

    const blogs = await Blog.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate('author', 'displayName photoURL')
      .select('title excerpt author category status featuredImage createdAt publishedAt slug readingTime likeCount bookmarkCount commentCount comments analytics');

    const total = await Blog.countDocuments(query);

    const blogIds = blogs.map((entry) => entry._id);
    const versions = await BlogVersion.find({
      blog: { $in: blogIds },
      status: { $in: ['draft', 'review'] },
    }).sort({ versionNumber: -1, updatedAt: -1 });

    const latestPendingMap = new Map();
    for (const version of versions) {
      const key = String(version.blog);
      if (!latestPendingMap.has(key)) {
        latestPendingMap.set(key, version);
      }
    }

    const blogsWithWorkflowStatus = blogs.map((blog) => {
      const pending = latestPendingMap.get(String(blog._id));
      if (!pending) return blog;
      const raw = blog.toObject();
      return {
        ...raw,
        title: pending.snapshot?.title || raw.title,
        excerpt: pending.snapshot?.excerpt || raw.excerpt,
        content: pending.snapshot?.content || raw.content,
        slug: pending.snapshot?.slug || raw.slug,
        category: pending.snapshot?.category || raw.category,
        tags: pending.snapshot?.tags || raw.tags,
        featuredImage: pending.snapshot?.featuredImage || raw.featuredImage,
        seo: pending.snapshot?.seo || raw.seo,
        readingTime: pending.snapshot?.readingTime || raw.readingTime,
        status: pending.status,
        baseStatus: raw.status,
        versionId: pending._id,
        versionNumber: pending.versionNumber,
        updatedAt: pending.updatedAt || raw.updatedAt,
      };
    });

    // Return consistent format - just the data
    const result = {
      blogs: blogsWithWorkflowStatus,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    };

    res.json(result);
  } catch (error) {
    console.error('Error fetching user blogs:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch user blogs',
      error: error.message
    });
  }
};

// Search blogs (public endpoint)
const searchBlogs = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;
    const query = req.query.q;

    if (!query || !query.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Search query is required'
      });
    }

    const meili = await SearchService.searchBlogIds(query.trim(), {
      page,
      limit,
      status: 'published',
    }).catch(() => null);

    let searchQuery = { status: 'published', isActive: true };
    if (meili) {
      searchQuery._id = { $in: meili.ids };
    } else {
      const searchRegex = new RegExp(query.trim(), 'i');
      searchQuery.$or = [
        { title: searchRegex },
        { excerpt: searchRegex },
        { content: searchRegex },
        { tags: { $in: [searchRegex] } },
        { category: searchRegex }
      ];
    }

    const blogs = await Blog.find(searchQuery)
      .sort({ publishedAt: -1 })
      .skip(meili ? 0 : skip)
      .limit(limit)
      .populate('author', 'displayName photoURL')
      .select('title excerpt author category featuredImage publishedAt slug readingTime likeCount bookmarkCount likes bookmarks comments');

    if (meili) {
      const order = new Map(meili.ids.map((id, idx) => [String(id), idx]));
      blogs.sort((a, b) => (order.get(String(a._id)) ?? Number.MAX_SAFE_INTEGER) - (order.get(String(b._id)) ?? Number.MAX_SAFE_INTEGER));
    }

    const total = meili ? meili.total : await Blog.countDocuments(searchQuery);

    // Return consistent format
    const currentUserId = req.user?._id || null;
    const serializedBlogs = blogs.map((blog) => serializeBlogForClient(blog, currentUserId));

    const result = {
      blogs: serializedBlogs,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    };

    res.json(formatPaginatedResponse(
      result.blogs,
      result.pagination.page,
      result.pagination.limit,
      result.pagination.total,
      'Blog search completed successfully'
    ));
  } catch (error) {
    console.error('Error searching blogs:', error);
    res.status(500).json(formatError('Failed to search blogs', error.message));
  }
};

// Get blog categories
const getCategories = async (req, res) => {
  try {
    const categories = [
      'herb_profiles',
      'remedies',
      'research',
      'safety',
      'gardening',
      'foraging',
      'recipes',
      'news',
      'interviews',
      'general'
    ];

    res.json({
      success: true,
      data: categories
    });
  } catch (error) {
    console.error('Error fetching categories:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch categories',
      error: error.message
    });
  }
};

module.exports = {
  getPublishedBlogs,
  getFeaturedBlogs,
  getTrendingBlogs,
  getBlogMetrics,
  getBlogBySlug,
  getBlogById,
  createBlog,
  updateBlog,
  deleteBlog,
  getUserBlogs,
  searchBlogs,
  getCategories,
  requestBlogApproval,
  approveAndPublishBlog,
  getAdminBlogs,
  moderateBlog,
  toggleBlogLike,
  getBlogLikes,
  toggleBlogBookmark,
  getSavedBlogs,
  setBlogFeatured,
  updateBlogStatus,
};
