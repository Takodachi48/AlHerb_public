const { Expo } = require('expo-server-sdk');
const User = require('../models/User');
const { logger } = require('../utils/logger');

const expo = new Expo({ useFcmV1: true });

/**
 * Send a push notification to one or more users by userId.
 * Automatically handles batching, invalid token cleanup, and errors.
 *
 * @param {string[]} userIds  - MongoDB user IDs to notify
 * @param {{ title: string, body: string, data?: object }} payload
 */
async function sendToUsers(userIds, { title, body, data = {} }) {
    if (!userIds || userIds.length === 0) return;

    // Fetch push tokens for all target users who have push enabled
    const users = await User.find({
        _id: { $in: userIds },
        isActive: true,
        'preferences.notifications.push': { $ne: false },
        pushTokens: { $exists: true, $not: { $size: 0 } },
    }).select('pushTokens');

    const allTokens = users.flatMap((u) => u.pushTokens || []);
    if (allTokens.length === 0) return;

    // Build messages, skipping invalid tokens
    const messages = [];
    const validTokens = [];

    for (const token of allTokens) {
        if (!Expo.isExpoPushToken(token)) {
            logger.warn(`[Push] Invalid Expo push token skipped: ${token}`);
            continue;
        }
        validTokens.push(token);
        messages.push({
            to: token,
            sound: 'default',
            title,
            body,
            data,
        });
    }

    if (messages.length === 0) return;

    // Send in Expo-recommended chunks
    const chunks = expo.chunkPushNotifications(messages);
    const ticketChunks = [];

    for (const chunk of chunks) {
        try {
            const tickets = await expo.sendPushNotificationsAsync(chunk);
            ticketChunks.push(tickets);
        } catch (error) {
            logger.error('[Push] Error sending push chunk:', error.message);
        }
    }

    // Check receipts and clean up invalid tokens
    const receiptIds = ticketChunks
        .flat()
        .filter((t) => t.status === 'ok' && t.id)
        .map((t) => t.id);

    if (receiptIds.length === 0) return;

    const receiptChunks = expo.chunkPushNotificationReceiptIds(receiptIds);
    for (const chunk of receiptChunks) {
        try {
            const receipts = await expo.getPushNotificationReceiptsAsync(chunk);
            for (const [, receipt] of Object.entries(receipts)) {
                if (receipt.status === 'error') {
                    logger.warn(`[Push] Delivery error: ${receipt.message}`);
                    // DeviceNotRegistered means the token is stale — remove it
                    if (receipt.details?.error === 'DeviceNotRegistered') {
                        const staleToken = validTokens.find((t) =>
                            messages.find((m) => m.to === t)
                        );
                        if (staleToken) {
                            await User.updateMany(
                                { pushTokens: staleToken },
                                { $pull: { pushTokens: staleToken } }
                            );
                            logger.info(`[Push] Removed stale token: ${staleToken}`);
                        }
                    }
                }
            }
        } catch (error) {
            logger.warn('[Push] Could not fetch receipts:', error.message);
        }
    }

    logger.info(`[Push] Sent ${messages.length} push notification(s): "${title}"`);
}

/**
 * Broadcast a push notification to ALL active users with push enabled.
 */
async function broadcast({ title, body, data = {} }) {
    const users = await User.find({
        isActive: true,
        'preferences.notifications.push': { $ne: false },
        pushTokens: { $exists: true, $not: { $size: 0 } },
    }).select('_id');

    const ids = users.map((u) => String(u._id));
    await sendToUsers(ids, { title, body, data });
}

module.exports = { sendToUsers, broadcast };
