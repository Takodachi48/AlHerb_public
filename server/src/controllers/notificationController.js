const Notification = require('../models/Notification');
const { logger } = require('../utils/logger');

const getNotifications = async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 20;
        const skip = (page - 1) * limit;

        const query = {
            recipient: req.user._id,
            isActive: true,
        };

        const notifications = await Notification.find(query)
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit)
            .populate('sender', 'displayName photoURL');

        const total = await Notification.countDocuments(query);
        const unreadCount = await Notification.countDocuments({ ...query, isRead: false });

        res.json({
            success: true,
            data: {
                items: notifications,
                pagination: {
                    page,
                    limit,
                    total,
                    pages: Math.ceil(total / limit),
                },
                unreadCount,
            },
            message: 'Notifications fetched successfully',
        });
    } catch (error) {
        logger.error(`Failed to get notifications: ${error.message}`);
        res.status(500).json({ success: false, message: 'Failed to fetch notifications', error: error.message });
    }
};

const markAsRead = async (req, res) => {
    try {
        const { id } = req.params;

        const notification = await Notification.findOneAndUpdate(
            { _id: id, recipient: req.user._id },
            { isRead: true },
            { new: true }
        );

        if (!notification) {
            return res.status(404).json({ success: false, message: 'Notification not found' });
        }

        res.json({ success: true, data: notification, message: 'Notification marked as read' });
    } catch (error) {
        logger.error(`Failed to mark notification as read: ${error.message}`);
        res.status(500).json({ success: false, message: 'Failed to update notification', error: error.message });
    }
};

const markAllAsRead = async (req, res) => {
    try {
        await Notification.updateMany(
            { recipient: req.user._id, isRead: false },
            { isRead: true }
        );

        res.json({ success: true, message: 'All notifications marked as read' });
    } catch (error) {
        logger.error(`Failed to mark all as read: ${error.message}`);
        res.status(500).json({ success: false, message: 'Failed to update notifications', error: error.message });
    }
};

const getUnreadCount = async (req, res) => {
    try {
        const unreadCount = await Notification.countDocuments({
            recipient: req.user._id,
            isRead: false,
            isActive: true,
        });

        res.json({ success: true, data: { unreadCount } });
    } catch (error) {
        logger.error(`Failed to get unread count: ${error.message}`);
        res.status(500).json({ success: false, message: 'Failed to get unread count', error: error.message });
    }
};

module.exports = {
    getNotifications,
    markAsRead,
    markAllAsRead,
    getUnreadCount,
};
