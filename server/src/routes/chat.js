const express = require('express');
const mongoose = require('mongoose');

const ChatConversation = require('../models/ChatConversation');
const { authenticateToken } = require('../middleware/auth');
const { asyncHandler } = require('../middleware/asyncHandler');
const { logger } = require('../utils/logger');
const {
  CHATBOT_MODEL,
  MAX_HISTORY_MESSAGES,
  estimateTokens,
  generateChatbotReply,
} = require('../services/chatbotService');
const { getChatbotEnabled } = require('../services/featureFlagService');

const router = express.Router();

const mapConversationSummary = (conversation) => {
  const messages = Array.isArray(conversation.messages) ? conversation.messages : [];
  const lastMessage = messages.length > 0 ? messages[messages.length - 1] : null;
  return {
    id: conversation._id?.toString?.() || String(conversation._id || ''),
    title: conversation.title || 'New chat',
    createdAt: conversation.createdAt || null,
    updatedAt: conversation.updatedAt || null,
    isActive: Boolean(conversation.isActive),
    messageCount: Number(conversation?.analytics?.messageCount || messages.length || 0),
    sessionId: conversation?.session?.sessionId || null,
    preview: lastMessage?.content ? String(lastMessage.content).slice(0, 140) : '',
    lastMessageAt: lastMessage?.timestamp || conversation.updatedAt || conversation.createdAt || null,
  };
};

const mapConversationDetail = (conversation) => ({
  ...mapConversationSummary(conversation),
  messages: (conversation.messages || []).map((message, index) => ({
    id: `${conversation._id}-${index}-${message.timestamp ? new Date(message.timestamp).getTime() : Date.now()}`,
    role: message.role === 'assistant' ? 'assistant' : 'user',
    content: message.content || '',
    timestamp: message.timestamp || null,
    metadata: message.metadata || {},
  })),
});

router.get('/conversations', authenticateToken, asyncHandler(async (req, res) => {
  try {
    const limit = Math.max(1, Math.min(100, Number(req.query.limit || 30)));
    const statusFilter = String(req.query.status || 'active').toLowerCase();

    const query = { user: req.user._id };
    if (statusFilter === 'active') query.isActive = true;
    if (statusFilter === 'archived') query.isActive = false;

    const conversations = await ChatConversation.find(query)
      .sort({ updatedAt: -1, createdAt: -1 })
      .limit(limit)
      .select('title createdAt updatedAt isActive analytics messages session')
      .lean();

    return res.status(200).json({
      conversations: conversations.map(mapConversationSummary),
    });
  } catch (error) {
    logger.error(`Failed to list conversations for user ${req.user?._id}: ${error.message}`);
    return res.status(500).json({
      success: false,
      error: 'Failed to load conversations.',
    });
  }
}));

router.get('/conversations/:conversationId', authenticateToken, asyncHandler(async (req, res) => {
  try {
    const { conversationId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(conversationId)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid conversation id.',
      });
    }

    const conversation = await ChatConversation.findOne({
      _id: conversationId,
      user: req.user._id,
    }).lean();

    if (!conversation) {
      return res.status(404).json({
        success: false,
        error: 'Conversation not found.',
      });
    }

    return res.status(200).json({
      conversation: mapConversationDetail(conversation),
    });
  } catch (error) {
    logger.error(`Failed to load conversation ${req.params?.conversationId}: ${error.message}`);
    return res.status(500).json({
      success: false,
      error: 'Failed to load conversation.',
    });
  }
}));

router.post('/conversations', authenticateToken, asyncHandler(async (req, res) => {
  try {
    const rawSessionId = typeof req.body?.sessionId === 'string' ? req.body.sessionId.trim() : '';
    const title = typeof req.body?.title === 'string' && req.body.title.trim()
      ? req.body.title.trim().slice(0, 100)
      : 'New chat';

    if (!rawSessionId) {
      return res.status(400).json({
        success: false,
        error: 'Session ID is required.',
      });
    }

    const conversation = await ChatConversation.create({
      user: req.user._id,
      title,
      session: {
        sessionId: rawSessionId,
        platform: 'web',
      },
    });

    return res.status(201).json({
      conversation: mapConversationSummary(conversation),
    });
  } catch (error) {
    logger.error(`Failed to create conversation for user ${req.user?._id}: ${error.message}`);
    return res.status(500).json({
      success: false,
      error: 'Failed to create conversation.',
    });
  }
}));

router.post('/send', authenticateToken, asyncHandler(async (req, res) => {
  const { message, sessionId, conversationId } = req.body || {};
  const chatbotEnabled = await getChatbotEnabled();
  if (!chatbotEnabled) {
    return res.status(503).json({
      success: false,
      error: 'Chatbot is currently disabled by administrators.',
    });
  }

  if (!message || typeof message !== 'string' || !message.trim()) {
    return res.status(400).json({
      success: false,
      error: 'Message is required.',
    });
  }

  if (!sessionId || typeof sessionId !== 'string' || !sessionId.trim()) {
    return res.status(400).json({
      success: false,
      error: 'Session ID is required.',
    });
  }

  const cleanedMessage = message.trim();

  try {
    let conversation;

    if (conversationId) {
      conversation = await ChatConversation.findOne({
        _id: conversationId,
        user: req.user._id,
        isActive: true,
      });

      if (!conversation) {
        return res.status(404).json({
          success: false,
          error: 'Conversation not found.',
        });
      }
    } else {
      conversation = await ChatConversation.create({
        user: req.user._id,
        title: cleanedMessage.substring(0, 50),
        session: {
          sessionId: sessionId.trim(),
          platform: 'web',
        },
      });
    }

    await conversation.addMessage('user', cleanedMessage);

    const recentMessages = conversation.messages.slice(-MAX_HISTORY_MESSAGES);
    const { reply, processingTime } = await generateChatbotReply(recentMessages);

    await conversation.addMessage('assistant', reply, {
      model: CHATBOT_MODEL,
      tokens: estimateTokens(reply),
      processingTime,
    });

    logger.info(`Chat response generated in ${processingTime}ms for conversation ${conversation._id}`);

    return res.status(200).json({
      reply,
      conversationId: conversation._id.toString(),
    });
  } catch (error) {
    logger.error(`Chat send failed for user ${req.user._id}: ${error.message}`);

    const statusCode = error.statusCode || 500;
    const userMessage = statusCode === 429
      ? 'The assistant is currently busy. Please try again in a moment.'
      : 'Unable to get a response right now. Please try again.';

    return res.status(statusCode).json({
      success: false,
      error: userMessage,
    });
  }
}));

module.exports = router;
