import React, { useCallback, useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { v4 as uuidv4 } from 'uuid';
import { MessageSquarePlus, Send } from 'lucide-react';
import { usePreferences } from '../../context/PreferencesContext';
import api from '../../services/api';

const SESSION_KEY = 'chatbot_session_id';
const DEFAULT_GREETING = "Hello! I'm your herbal medicine assistant. How can I help you today?";

const getOrCreateSessionId = () => {
  if (typeof window === 'undefined') return uuidv4();
  const existing = window.sessionStorage.getItem(SESSION_KEY);
  if (existing) return existing;
  const id = uuidv4();
  window.sessionStorage.setItem(SESSION_KEY, id);
  return id;
};

const toUiMessages = (messages = []) => {
  if (!Array.isArray(messages) || messages.length === 0) {
    return [{ id: 'greeting', text: DEFAULT_GREETING, sender: 'bot' }];
  }

  const mapped = messages
    .filter((message) => message && message.content)
    .map((message, index) => ({
      id: message.id || `${message.timestamp || 'msg'}-${index}`,
      text: message.content,
      sender: message.role === 'assistant' ? 'bot' : 'user',
      timestamp: message.timestamp || null,
    }));

  return mapped.length > 0 ? mapped : [{ id: 'greeting', text: DEFAULT_GREETING, sender: 'bot' }];
};

const ChatIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
  </svg>
);
const CloseIcon = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
    <path d="M6 18L18 6M6 6l12 12" />
  </svg>
);

const ChatbotWidget = () => {
  const { chatbotEnabled } = usePreferences();

  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState([{ id: 'greeting', text: DEFAULT_GREETING, sender: 'bot' }]);
  const [conversations, setConversations] = useState([]);
  const [loadingConversations, setLoadingConversations] = useState(false);
  const [loadingConversationId, setLoadingConversationId] = useState(null);
  const [inputText, setInputText] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [conversationId, setConversationId] = useState(null);
  const [sessionId] = useState(getOrCreateSessionId);
  const initializedRef = useRef(false);
  const isSendingRef = useRef(false);
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    if (isOpen) messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isTyping, isOpen]);

  useEffect(() => {
    if (isOpen) setTimeout(() => inputRef.current?.focus(), 180);
  }, [isOpen]);

  const loadConversation = useCallback(async (id) => {
    if (!id) return;
    setLoadingConversationId(id);
    try {
      const res = await api.get(`/chat/conversations/${encodeURIComponent(id)}`);
      const convo = res?.conversation || null;
      if (!convo) return;
      setConversationId(String(convo.id || id));
      setMessages(toUiMessages(convo.messages));
    } catch {
      setMessages([{ id: 'greeting', text: DEFAULT_GREETING, sender: 'bot' }]);
    } finally {
      setLoadingConversationId(null);
    }
  }, []);

  const loadConversations = useCallback(async () => {
    setLoadingConversations(true);
    try {
      const res = await api.get('/chat/conversations', { params: { limit: 30, status: 'active' } });
      const list = Array.isArray(res?.conversations) ? res.conversations : [];
      setConversations(list);

      if (!initializedRef.current) {
        initializedRef.current = true;
        if (list.length > 0) {
          await loadConversation(list[0].id);
        } else {
          setConversationId(null);
          setMessages([{ id: 'greeting', text: DEFAULT_GREETING, sender: 'bot' }]);
        }
      }
    } catch {
      if (!initializedRef.current) {
        initializedRef.current = true;
        setConversationId(null);
        setMessages([{ id: 'greeting', text: DEFAULT_GREETING, sender: 'bot' }]);
      }
    } finally {
      setLoadingConversations(false);
    }
  }, [loadConversation]);

  useEffect(() => {
    if (!isOpen) return;
    loadConversations();
  }, [isOpen, loadConversations]);

  if (!chatbotEnabled) return null;

  const handleStartNewChat = () => {
    setConversationId(null);
    setMessages([{ id: 'greeting', text: DEFAULT_GREETING, sender: 'bot' }]);
    setInputText('');
    setTimeout(() => inputRef.current?.focus(), 80);
  };

  const handleSend = async () => {
    if (!inputText.trim() || isTyping || isSendingRef.current) return;
    const text = inputText.trim();
    setMessages((prev) => [...prev, { id: Date.now(), text, sender: 'user' }]);
    setInputText('');
    setIsTyping(true);
    isSendingRef.current = true;

    try {
      const res = await api.post('/chat/send', { message: text, sessionId, conversationId });
      if (res?.conversationId) {
        const nextConversationId = String(res.conversationId);
        setConversationId(nextConversationId);
        setConversations((prev) => {
          const existing = prev.find((item) => String(item.id) === nextConversationId);
          const updated = {
            id: nextConversationId,
            title: existing?.title || text.slice(0, 50) || 'New chat',
            updatedAt: new Date().toISOString(),
            messageCount: Math.max(2, Number(existing?.messageCount || 0) + 2),
            preview: res?.reply?.trim() || text,
          };
          const others = prev.filter((item) => String(item.id) !== nextConversationId);
          return [updated, ...others];
        });
      }
      setMessages((prev) => [
        ...prev,
        {
          id: Date.now() + 1,
          text: res?.reply?.trim() || 'I can help with herbal information, but could not generate a full response.',
          sender: 'bot',
        },
      ]);
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          id: Date.now() + 1,
          text: 'Having trouble right now. Please try again shortly. For urgent symptoms, consult a healthcare professional.',
          sender: 'bot',
        },
      ]);
    } finally {
      setIsTyping(false);
      isSendingRef.current = false;
    }
  };

  return (
    <div className="fixed bottom-6 right-6 z-50">
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.98 }}
            transition={{ duration: 0.16, ease: [0.4, 0, 0.2, 1] }}
            className="chatbot-window"
          >
            <div className="chatbot-header">
              <div className="flex items-center gap-2">
                <span className="chatbot-status-dot" aria-hidden="true" />
                <span className="chatbot-title">Herbal Assistant</span>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={handleStartNewChat} className="btn-icon" aria-label="Start new chat">
                  <MessageSquarePlus size={13} />
                </button>
                <button onClick={() => setIsOpen(false)} className="btn-icon" aria-label="Close chat">
                  <CloseIcon />
                </button>
              </div>
            </div>

            <div className="chatbot-body">
              <aside className="chatbot-sidebar">
                <div className="chatbot-sidebar-head">
                  <button onClick={handleStartNewChat} className="btn btn--secondary chatbot-new-chat-btn" type="button">
                    New Chat
                  </button>
                </div>
                <div className="chatbot-conversation-list">
                  {loadingConversations ? <div className="chatbot-side-note">Loading chats...</div> : null}
                  {!loadingConversations && conversations.length === 0 ? <div className="chatbot-side-note">No previous chats.</div> : null}
                  {conversations.map((conversation) => {
                    const id = String(conversation.id);
                    const active = id === String(conversationId || '');
                    return (
                      <button
                        key={id}
                        type="button"
                        onClick={() => loadConversation(id)}
                        className={`chatbot-conversation-item ${active ? 'active' : ''}`}
                      >
                        <div className="chatbot-conversation-title">{conversation.title || 'New chat'}</div>
                        <div className="chatbot-conversation-preview">{conversation.preview || `${conversation.messageCount || 0} messages`}</div>
                      </button>
                    );
                  })}
                </div>
              </aside>

              <section className="chatbot-main">
                <div className="chatbot-messages scrollbar-thin">
                  {loadingConversationId ? <div className="chatbot-side-note">Loading conversation...</div> : null}
                  {!loadingConversationId && messages.map((msg) => (
                    <div key={msg.id} className={`chatbot-msg-row ${msg.sender}`}>
                      <div className={`chatbot-bubble ${msg.sender}`}>{msg.text}</div>
                    </div>
                  ))}

                  {isTyping && (
                    <div className="chatbot-msg-row bot">
                      <div className="chatbot-bubble bot chatbot-typing">
                        <span className="chatbot-dot" />
                        <span className="chatbot-dot" style={{ animationDelay: '0.15s' }} />
                        <span className="chatbot-dot" style={{ animationDelay: '0.3s' }} />
                        <span className="label" style={{ marginLeft: '6px', marginBottom: 0 }}>typing</span>
                      </div>
                    </div>
                  )}
                  <div ref={messagesEndRef} />
                </div>

                <div className="chatbot-input-row">
                  <input
                    ref={inputRef}
                    type="text"
                    value={inputText}
                    onChange={(e) => setInputText(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        handleSend();
                      }
                    }}
                    placeholder="Ask about herbs..."
                    disabled={isTyping || Boolean(loadingConversationId)}
                    className="input chatbot-input"
                  />
                  <button
                    onClick={handleSend}
                    disabled={!inputText.trim() || isTyping || Boolean(loadingConversationId)}
                    className="btn btn--secondary chatbot-send-btn"
                    aria-label="Send message"
                  >
                    <Send size={16} />
                  </button>
                </div>
              </section>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <motion.button
        onClick={() => setIsOpen((v) => !v)}
        whileTap={{ scale: 0.93 }}
        className="chatbot-fab"
        aria-label={isOpen ? 'Close chat' : 'Open chat'}
      >
        <AnimatePresence mode="wait" initial={false}>
          <motion.span
            key={isOpen ? 'close' : 'open'}
            initial={{ opacity: 0, rotate: -15, scale: 0.8 }}
            animate={{ opacity: 1, rotate: 0, scale: 1 }}
            exit={{ opacity: 0, rotate: 15, scale: 0.8 }}
            transition={{ duration: 0.14 }}
            style={{ display: 'flex' }}
          >
            {isOpen ? <CloseIcon /> : <ChatIcon />}
          </motion.span>
        </AnimatePresence>
      </motion.button>
    </div>
  );
};

export default ChatbotWidget;
