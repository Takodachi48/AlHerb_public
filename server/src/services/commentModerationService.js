const sanitizeHtml = require('sanitize-html');
const ModerationLog = require('../models/ModerationLog');

let profanityFilterPromise = null;

const getProfanityFilter = async () => {
  if (!profanityFilterPromise) {
    profanityFilterPromise = import('bad-words').then((mod) => {
      const Filter = mod.Filter || mod.default || mod;
      return new Filter();
    });
  }
  return profanityFilterPromise;
};

const sanitizeCommentText = (text) => {
  const stripped = sanitizeHtml(text, {
    allowedTags: [],
    allowedAttributes: {},
  });

  return stripped.replace(/\s+/g, ' ').trim();
};

const moderateCommentContent = async (content) => {
  const profanityFilter = await getProfanityFilter();
  const sanitized = sanitizeCommentText(content);
  const cleaned = profanityFilter.clean(sanitized);
  const flagged = cleaned !== sanitized;

  return {
    sanitizedContent: cleaned,
    flagged,
  };
};

const logFlaggedCommentAttempt = async ({
  userId,
  blogId,
  originalContent,
  sanitizedContent,
  req,
}) => {
  await ModerationLog.create({
    type: 'comment_profanity',
    user: userId,
    blog: blogId,
    originalContent,
    sanitizedContent,
    metadata: {
      sourceIp: req.ip,
      userAgent: req.get('user-agent') || '',
    },
  });
};

module.exports = {
  moderateCommentContent,
  logFlaggedCommentAttempt,
};
