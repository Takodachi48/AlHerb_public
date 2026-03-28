const express = require('express');
const { body } = require('express-validator');
const { authenticateToken } = require('../middleware/auth');
const { asyncHandler } = require('../middleware/asyncHandler');
const {
  getBlogComments,
  getCommentReplies,
  createComment,
  updateComment,
  deleteComment,
  toggleCommentLike,
} = require('../controllers/commentController');
const { commentLimiter } = require('../middleware/rateLimiter');

const router = express.Router();

router.get('/blog/:blogId', asyncHandler(getBlogComments));
router.get('/:commentId/replies', asyncHandler(getCommentReplies));

router.post(
  '/',
  authenticateToken,
  commentLimiter,
  [
    body('blogId').isString().notEmpty().withMessage('blogId is required'),
    body('content')
      .isString()
      .trim()
      .isLength({ min: 1, max: 2000 })
      .withMessage('content must be between 1 and 2000 characters'),
    body('parentId').optional().isString().notEmpty().withMessage('parentId must be a valid id'),
  ],
  asyncHandler(createComment)
);

router.put(
  '/:id',
  authenticateToken,
  commentLimiter,
  [
    body('content')
      .isString()
      .trim()
      .isLength({ min: 1, max: 2000 })
      .withMessage('content must be between 1 and 2000 characters'),
  ],
  asyncHandler(updateComment)
);

router.delete('/:id', authenticateToken, commentLimiter, asyncHandler(deleteComment));
router.post('/:id/like', authenticateToken, commentLimiter, asyncHandler(toggleCommentLike));

module.exports = router;
