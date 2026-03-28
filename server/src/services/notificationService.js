const User = require('../models/User');
const Notification = require('../models/Notification');
const backgroundQueueService = require('./backgroundQueueService');
const emailService = require('./emailService');
const expoPushService = require('./expoPushService');
const {
  BLOG_TEMPLATES,
  getUserStatusTemplate,
  USER_REACTIVATION_TEMPLATE,
} = require('../constants/emailTemplates');
const { logger } = require('../utils/logger');

const dedupeUsersByEmail = (users) => {
  const map = new Map();

  users.forEach((user) => {
    if (!user?.email) return;
    if (!map.has(user.email)) {
      map.set(user.email, user);
    }
  });

  return Array.from(map.values());
};

const canReceiveSystemEmail = (user) =>
  user.preferences?.notifications?.email !== false &&
  user.preferences?.notifications?.system !== false;

const canReceiveBlogEmail = (user) =>
  user.isActive &&
  canReceiveSystemEmail(user) &&
  user.preferences?.notifications?.blog !== false;

class NotificationService {
  async queueUserDeactivationEmails(users, reasonTemplateKey) {
    const template = getUserStatusTemplate(reasonTemplateKey);
    if (!template) {
      throw new Error('Invalid deactivation reason template');
    }

    const dedupedUsers = dedupeUsersByEmail(users).filter((user) => user.email);

    dedupedUsers.forEach((user) => {
      backgroundQueueService.add(`user-deactivation-${user._id}`, async () => {
        const text = `Hi ${user.displayName || 'User'},\n\n${template.body}\n\nIf you believe this is a mistake, contact support.`;
        await emailService.sendEmail({
          to: user.email,
          subject: template.subject,
          text,
          html: `<p>Hi ${user.displayName || 'User'},</p><p>${template.body}</p><p>If you believe this is a mistake, contact support.</p>`,
        });
      });
    });
  }

  async queueBlogStatusNotifications({ blog, eventType }) {
    const blogTemplate = BLOG_TEMPLATES[eventType];
    if (!blogTemplate) return;

    const users = await User.find({
      isActive: true,
      'preferences.notifications.email': { $ne: false },
      'preferences.notifications.system': { $ne: false },
      'preferences.notifications.blog': { $ne: false },
    }).select('email displayName preferences isActive');

    const recipients = dedupeUsersByEmail(users).filter(canReceiveBlogEmail);

    recipients.forEach((user) => {
      backgroundQueueService.add(`blog-${eventType}-${blog._id}-${user._id}`, async () => {
        const safeTitle = blog.title || 'New blog post';
        const safeSlug = blog.slug || '';
        const blogUrl = `${process.env.WEB_APP_URL || 'http://localhost:5173'}/blog/${safeSlug}`;

        await emailService.sendEmail({
          to: user.email,
          subject: blogTemplate.subject,
          text: `${blogTemplate.heading}\n\n${safeTitle}\n${blogUrl}`,
          html: `<p>${blogTemplate.heading}</p><p><strong>${safeTitle}</strong></p><p><a href="${blogUrl}">Read blog</a></p>`,
        });
      });
    });

    logger.info(`Queued blog ${eventType} notifications for ${recipients.length} users.`);

    // Send push notification broadcast to all users with push enabled
    const pushTitle = blogTemplate.subject || 'New post on HerbAssist';
    const pushBody = blog.title || 'A new post is available';
    expoPushService.broadcast({ title: pushTitle, body: pushBody, data: { type: 'blog', blogId: String(blog._id) } })
      .catch((err) => logger.warn('[Push] Blog broadcast failed:', err.message));
  }

  async queueUserReactivationEmails(users) {
    const dedupedUsers = dedupeUsersByEmail(users).filter((user) => user.email);

    dedupedUsers.forEach((user) => {
      backgroundQueueService.add(`user-reactivation-${user._id}`, async () => {
        const text = `Hi ${user.displayName || 'User'},\n\n${USER_REACTIVATION_TEMPLATE.body}`;
        await emailService.sendEmail({
          to: user.email,
          subject: USER_REACTIVATION_TEMPLATE.subject,
          text,
          html: `<p>Hi ${user.displayName || 'User'},</p><p>${USER_REACTIVATION_TEMPLATE.body}</p>`,
        });
      });
    });
  }

  /**
   * Send a push notification to the blog author when someone likes their post.
   */
  async sendLikeNotification({ blog, liker }) {
    if (!blog || !liker) return;
    // if (String(blog.author) === String(liker._id)) return; // Commented out for testing

    const author = await User.findById(blog.author).select('pushTokens preferences isActive');
    if (!author || !author.isActive || author.preferences?.notifications?.push === false) return;

    const title = 'New Like! ❤️';
    const body = `${liker.displayName || 'Someone'} liked your post: "${blog.title}"`;

    // Save persistent notification
    await Notification.create({
      recipient: author._id,
      sender: liker._id,
      type: 'blog_like',
      title,
      message: body,
      data: { blogId: String(blog._id) },
    }).catch(err => logger.error('[Notification] Failed to save like notification:', err.message));

    await expoPushService.sendToUsers([author._id], {
      title,
      body,
      data: { type: 'blog', blogId: String(blog._id) },
    }).catch((err) => logger.warn('[Push] Like notification failed:', err.message));
  }

  /**
   * Send a push notification to the comment author when someone likes their comment.
   */
  async sendCommentLikeNotification({ blog, comment, liker }) {
    if (!blog || !comment || !liker) return;
    // if (String(comment.author) === String(liker._id)) return; // Commented out for testing

    const author = await User.findById(comment.author).select('pushTokens preferences isActive');
    if (!author || !author.isActive || author.preferences?.notifications?.push === false) return;

    const title = 'New Comment Like! 👍';
    const body = `${liker.displayName || 'Someone'} liked your comment on: "${blog.title}"`;

    // Save persistent notification
    await Notification.create({
      recipient: author._id,
      sender: liker._id,
      type: 'comment_like',
      title,
      message: body,
      data: { blogId: String(blog._id), commentId: String(comment._id) },
    }).catch(err => logger.error('[Notification] Failed to save comment like notification:', err.message));

    await expoPushService.sendToUsers([author._id], {
      title,
      body,
      data: { type: 'blog', blogId: String(blog._id), commentId: String(comment._id) },
    }).catch((err) => logger.warn('[Push] Comment like notification failed:', err.message));
  }

  /**
   * Send a push notification to the blog author when someone comments on their post.
   */
  async sendCommentNotification({ blog, comment, commenter }) {
    if (!blog || !comment || !commenter) return;
    // if (String(blog.author) === String(commenter._id)) return; // Commented out for testing

    const author = await User.findById(blog.author).select('pushTokens preferences isActive');
    if (!author || !author.isActive || author.preferences?.notifications?.push === false) return;

    const title = 'New Comment! 💬';
    const body = `${commenter.displayName || 'Someone'} commented on: "${blog.title}"`;

    // Save persistent notification
    await Notification.create({
      recipient: author._id,
      sender: commenter._id,
      type: 'blog_comment',
      title,
      message: body,
      data: { blogId: String(blog._id), commentId: String(comment._id) },
    }).catch(err => logger.error('[Notification] Failed to save comment notification:', err.message));

    await expoPushService.sendToUsers([author._id], {
      title,
      body,
      data: { type: 'blog', blogId: String(blog._id), commentId: String(comment._id) },
    }).catch((err) => logger.warn('[Push] Comment notification failed:', err.message));
  }

  /**
   * Send a push notification to the original commenter when someone replies to them.
   */
  async sendCommentReplyNotification({ blog, parentComment, reply, replier }) {
    if (!blog || !parentComment || !reply || !replier) return;
    // if (String(parentComment.author) === String(replier._id)) return; // Commented out for testing

    const author = await User.findById(parentComment.author).select('pushTokens preferences isActive');
    if (!author || !author.isActive || author.preferences?.notifications?.push === false) return;

    const title = 'New Reply! 💬';
    const body = `${replier.displayName || 'Someone'} replied to your comment on: "${blog.title}"`;

    // Save persistent notification
    await Notification.create({
      recipient: author._id,
      sender: replier._id,
      type: 'comment_reply',
      title,
      message: body,
      data: { blogId: String(blog._id), commentId: String(reply._id) },
    }).catch(err => logger.error('[Notification] Failed to save reply notification:', err.message));

    await expoPushService.sendToUsers([author._id], {
      title,
      body,
      data: { type: 'blog', blogId: String(blog._id), commentId: String(reply._id) },
    }).catch((err) => logger.warn('[Push] Reply notification failed:', err.message));
  }

  async queueDeactivationEmailsByUserIds(userIds, reasonTemplateKey) {
    const users = await User.find({ _id: { $in: userIds } }).select(
      'email displayName preferences isActive'
    );

    const recipients = dedupeUsersByEmail(users).filter(canReceiveSystemEmail);
    await this.queueUserDeactivationEmails(recipients, reasonTemplateKey);

    return recipients.length;
  }

  async queueReactivationEmailsByUserIds(userIds) {
    const users = await User.find({ _id: { $in: userIds } }).select(
      'email displayName preferences isActive'
    );

    const recipients = dedupeUsersByEmail(users).filter(canReceiveSystemEmail);
    await this.queueUserReactivationEmails(recipients);

    return recipients.length;
  }
}

module.exports = new NotificationService();
