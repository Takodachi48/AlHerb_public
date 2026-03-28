const mongoose = require('mongoose');
const { validationResult } = require('express-validator');
const Blog = require('../models/Blog');
const BlogComment = require('../models/BlogComment');
const { formatSuccess, formatError } = require('../utils/responseFormatter');
const {
  moderateCommentContent,
  logFlaggedCommentAttempt,
} = require('../services/commentModerationService');
const notificationService = require('../services/notificationService');
const { logger } = require('../utils/logger');

const isValidObjectId = (id) => mongoose.Types.ObjectId.isValid(id);

const COMMENT_CACHE_TTL_MS = 60 * 1000;
const commentCache = new Map();

const getCommentCacheKey = ({ blogId, page, limit, includeReplies, repliesLimit }) =>
  `${blogId}|${page}|${limit}|${includeReplies ? '1' : '0'}|${repliesLimit}`;

const readCommentCache = (key) => {
  const entry = commentCache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.timestamp > COMMENT_CACHE_TTL_MS) {
    commentCache.delete(key);
    return null;
  }
  return entry.data;
};

const writeCommentCache = (key, data) => {
  commentCache.set(key, { timestamp: Date.now(), data });
};

const clearCommentCache = (blogId = null) => {
  if (!blogId) {
    commentCache.clear();
    return;
  }
  const prefix = `${blogId}|`;
  for (const key of commentCache.keys()) {
    if (key.startsWith(prefix)) {
      commentCache.delete(key);
    }
  }
};

const getBlogComments = async (req, res) => {
  try {
    const { blogId } = req.params;
    if (!isValidObjectId(blogId)) {
      return res.status(400).json(formatError('Invalid blog id', 400));
    }

    const page = Math.max(1, Number(req.query.page || 1));
    const limit = Math.min(50, Math.max(1, Number(req.query.limit || 10)));
    const includeReplies = String(req.query.includeReplies || 'false').toLowerCase() === 'true';
    const repliesLimit = Math.min(20, Math.max(1, Number(req.query.repliesLimit || 5)));
    const skip = (page - 1) * limit;

    const cacheKey = getCommentCacheKey({ blogId, page, limit, includeReplies, repliesLimit });
    const cached = readCommentCache(cacheKey);
    if (cached) {
      return res.json(formatSuccess(cached, 'Comments retrieved successfully'));
    }

    const total = await BlogComment.countDocuments({
      blog: blogId,
      parent: null,
      isActive: true,
      isDeleted: false,
    });

    const comments = await BlogComment.find({
      blog: blogId,
      parent: null,
      isActive: true,
      isDeleted: false,
    })
      .select('blog author content parent replies likeCount isEdited editedAt isDeleted isRemoved removedBy removedAt createdAt updatedAt')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate('author', 'displayName photoURL role')
      .populate(includeReplies ? {
        path: 'replies',
        match: { isActive: true, isDeleted: false },
        options: { sort: { createdAt: 1 }, limit: repliesLimit },
        select: 'blog author content parent replies likeCount isEdited editedAt isDeleted isRemoved removedBy removedAt createdAt updatedAt',
        populate: [
          { path: 'author', select: 'displayName photoURL role' },
          {
            path: 'replies',
            match: { isActive: true, isDeleted: false },
            options: { sort: { createdAt: 1 } },
            select: 'blog author content parent replies likeCount isEdited editedAt isDeleted isRemoved removedBy removedAt createdAt updatedAt',
            populate: { path: 'author', select: 'displayName photoURL role' },
          },
        ],
      } : null)
      .lean();

    const commentIds = comments.map((comment) => comment._id).filter(Boolean);
    let replyCountByParent = {};
    if (commentIds.length > 0) {
      const replyCounts = await BlogComment.aggregate([
        {
          $match: {
            parent: { $in: commentIds },
            isActive: true,
            isDeleted: false,
          },
        },
        {
          $group: {
            _id: '$parent',
            count: { $sum: 1 },
          },
        },
      ]);
      replyCountByParent = replyCounts.reduce((acc, row) => {
        acc[String(row._id)] = row.count || 0;
        return acc;
      }, {});
    }

    const entries = comments.map((comment) => ({
      ...comment,
      replyCount: replyCountByParent[String(comment._id)] || 0,
      replies: includeReplies ? (comment.replies || []) : [],
    }));

    const payload = {
      entries,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.max(1, Math.ceil(total / limit)),
        hasNextPage: skip + entries.length < total,
        hasPrevPage: page > 1,
      },
    };

    writeCommentCache(cacheKey, payload);

    return res.json(formatSuccess(payload, 'Comments retrieved successfully'));
  } catch (error) {
    logger.error(`Failed to get comments: ${error.message}`);
    return res.status(500).json(formatError('Failed to retrieve comments', 500, error.message));
  }
};

const getCommentReplies = async (req, res) => {
  try {
    const { commentId } = req.params;
    if (!isValidObjectId(commentId)) {
      return res.status(400).json(formatError('Invalid comment id', 400));
    }

    const limit = Math.min(50, Math.max(1, Number(req.query.limit || 10)));
    const includeNested = String(req.query.includeNested || 'true').toLowerCase() !== 'false';

    const replies = await BlogComment.find({
      parent: commentId,
      isActive: true,
      isDeleted: false,
    })
      .select('blog author content parent replies likeCount isEdited editedAt isDeleted isRemoved removedBy removedAt createdAt updatedAt')
      .sort({ createdAt: 1 })
      .limit(limit)
      .populate('author', 'displayName photoURL role')
      .populate(includeNested ? {
        path: 'replies',
        match: { isActive: true, isDeleted: false },
        options: { sort: { createdAt: 1 } },
        select: 'blog author content parent replies likeCount isEdited editedAt isDeleted isRemoved removedBy removedAt createdAt updatedAt',
        populate: { path: 'author', select: 'displayName photoURL role' },
      } : null)
      .lean();

    return res.json(formatSuccess(replies, 'Replies retrieved successfully'));
  } catch (error) {
    logger.error(`Failed to get replies: ${error.message}`);
    return res.status(500).json(formatError('Failed to retrieve replies', 500, error.message));
  }
};

const createComment = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json(formatError('Validation failed', 400, errors.array()));
    }

    const { blogId, content, parentId } = req.body;
    if (!isValidObjectId(blogId)) {
      return res.status(400).json(formatError('Invalid blog id', 400));
    }

    if (!content || typeof content !== 'string') {
      return res.status(400).json(formatError('Comment content is required', 400));
    }

    const blog = await Blog.findById(blogId).select('_id status isActive author title commentCount');
    if (!blog || !blog.isActive || blog.status !== 'published') {
      return res.status(404).json(formatError('Blog not found', 404));
    }

    let parentComment = null;
    if (parentId) {
      if (!isValidObjectId(parentId)) {
        return res.status(400).json(formatError('Invalid parent comment id', 400));
      }

      parentComment = await BlogComment.findOne({
        _id: parentId,
        blog: blogId,
        isDeleted: false,
        isActive: true,
      }).select('author content');

      if (!parentComment) {
        return res.status(404).json(formatError('Parent comment not found', 404));
      }
    }

    const moderated = await moderateCommentContent(content);
    if (!moderated.sanitizedContent) {
      return res.status(400).json(formatError('Comment content cannot be empty', 400));
    }

    const comment = await BlogComment.create({
      blog: blogId,
      author: req.user._id,
      content: moderated.sanitizedContent,
      parent: parentComment ? parentComment._id : null,
      moderation: {
        isApproved: true,
        isFlagged: moderated.flagged,
        flagReason: moderated.flagged ? 'profanity_sanitized' : '',
      },
    });

    if (parentComment) {
      await BlogComment.updateOne(
        { _id: parentComment._id },
        { $addToSet: { replies: comment._id } }
      );
      // Trigger reply notification
      notificationService.sendCommentReplyNotification({ blog, parentComment, reply: comment, replier: req.user })
        .catch(err => console.error('Failed to send reply notification:', err.message));
    } else {
      await Blog.updateOne({ _id: blogId }, {
        $addToSet: { comments: comment._id },
        $inc: { commentCount: 1 }
      });
      // Trigger top-level comment notification
      notificationService.sendCommentNotification({ blog, comment, commenter: req.user })
        .catch(err => console.error('Failed to send comment notification:', err.message));
    }

    if (moderated.flagged) {
      await logFlaggedCommentAttempt({
        userId: req.user._id,
        blogId,
        originalContent: content,
        sanitizedContent: moderated.sanitizedContent,
        req,
      });
    }

    const populated = await BlogComment.findById(comment._id).populate(
      'author',
      'displayName photoURL role'
    );

    clearCommentCache(blogId);

    return res.status(201).json(formatSuccess(populated, 'Comment created successfully'));
  } catch (error) {
    logger.error(`Failed to create comment: ${error.message}`);
    return res.status(500).json(formatError('Failed to create comment', 500, error.message));
  }
};

const updateComment = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json(formatError('Validation failed', 400, errors.array()));
    }

    const { id } = req.params;
    const { content } = req.body;

    if (!isValidObjectId(id)) {
      return res.status(400).json(formatError('Invalid comment id', 400));
    }

    if (!content || typeof content !== 'string') {
      return res.status(400).json(formatError('Comment content is required', 400));
    }

    const comment = await BlogComment.findOne({
      _id: id,
      isDeleted: false,
      isActive: true,
    });

    if (!comment) {
      return res.status(404).json(formatError('Comment not found', 404));
    }

    if (comment.author.toString() !== req.user._id.toString()) {
      return res.status(403).json(formatError('You can only edit your own comments', 403));
    }

    const moderated = await moderateCommentContent(content);
    if (!moderated.sanitizedContent) {
      return res.status(400).json(formatError('Comment content cannot be empty', 400));
    }

    comment.content = moderated.sanitizedContent;
    comment.moderation.isFlagged = moderated.flagged;
    comment.moderation.flagReason = moderated.flagged ? 'profanity_sanitized' : '';
    await comment.save();

    if (moderated.flagged) {
      await logFlaggedCommentAttempt({
        userId: req.user._id,
        blogId: comment.blog,
        originalContent: content,
        sanitizedContent: moderated.sanitizedContent,
        req,
      });
    }

    const populated = await BlogComment.findById(comment._id).populate(
      'author',
      'displayName photoURL role'
    );
    clearCommentCache(String(comment.blog));
    return res.json(formatSuccess(populated, 'Comment updated successfully'));
  } catch (error) {
    logger.error(`Failed to update comment: ${error.message}`);
    return res.status(500).json(formatError('Failed to update comment', 500, error.message));
  }
};

const deleteComment = async (req, res) => {
  try {
    const { id } = req.params;
    if (!isValidObjectId(id)) {
      return res.status(400).json(formatError('Invalid comment id', 400));
    }

    const comment = await BlogComment.findById(id);
    if (!comment || !comment.isActive) {
      return res.status(404).json(formatError('Comment not found', 404));
    }

    const isOwner = comment.author.toString() === req.user._id.toString();
    const isModerator = req.user.role === 'admin' || req.user.role === 'moderator';
    if (!isOwner && !isModerator) {
      return res.status(403).json(formatError('Not allowed to remove this comment', 403));
    }

    await comment.softDelete(req.user._id, isModerator ? req.user.role : 'user');

    if (!comment.parent) {
      await Blog.updateOne({ _id: comment.blog }, { $inc: { commentCount: -1 } });
    }

    clearCommentCache(String(comment.blog));
    return res.json(formatSuccess(null, 'Comment removed successfully'));
  } catch (error) {
    logger.error(`Failed to delete comment: ${error.message}`);
    return res.status(500).json(formatError('Failed to delete comment', 500, error.message));
  }
};

const toggleCommentLike = async (req, res) => {
  try {
    const { id } = req.params;

    if (!isValidObjectId(id)) {
      return res.status(400).json(formatError('Invalid comment id', 400));
    }

    const comment = await BlogComment.findOne({
      _id: id,
      isDeleted: false,
      isActive: true,
    });

    if (!comment) {
      return res.status(404).json(formatError('Comment not found', 404));
    }

    await comment.toggleLike(req.user._id);

    const isNowLiked = comment.isLikedBy(req.user._id);

    if (isNowLiked) {
      if (Blog && notificationService) {
        const blog = await Blog.findById(comment.blog).select('_id title author');
        if (blog) {
          notificationService.sendCommentLikeNotification({
            blog,
            comment,
            liker: req.user,
          }).catch(err => console.error('Failed to send comment like notification:', err.message));
        }
      }
    }

    return res.json(
      formatSuccess(
        {
          commentId: comment._id,
          liked: isNowLiked,
          likeCount: comment.likeCount,
        },
        'Comment like status updated successfully'
      )
    );
  } catch (error) {
    logger.error(`Failed to toggle comment like: ${error.message}`);
    return res.status(500).json(formatError('Failed to toggle comment like', 500, error.message));
  }
};

module.exports = {
  getBlogComments,
  getCommentReplies,
  createComment,
  updateComment,
  deleteComment,
  toggleCommentLike,
};
