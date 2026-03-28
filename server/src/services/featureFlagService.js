const cache = require('../config/cache');
const AppConfig = require('../models/AppConfig');

const TURNSTILE_ENABLED_KEY = 'turnstileEnabled';
const CHATBOT_ENABLED_KEY = 'chatbotEnabled';
const getCacheKey = (key) => `feature-flag:${key}`;
const CACHE_TTL_SECONDS = 60;

const getBooleanFlag = async (key, fallbackEnabled, description) => {
  const cacheKey = getCacheKey(key);
  const cached = cache.get(cacheKey);
  if (typeof cached === 'boolean') {
    return cached;
  }

  const config = await AppConfig.findOne({ key }).lean();
  const enabled = typeof config?.value === 'boolean' ? config.value : Boolean(fallbackEnabled);
  cache.set(cacheKey, enabled, CACHE_TTL_SECONDS);
  return enabled;
};

const setBooleanFlag = async (key, enabled, description) => {
  const normalized = Boolean(enabled);
  await AppConfig.findOneAndUpdate(
    { key },
    {
      $set: {
        value: normalized,
        description,
      },
    },
    { upsert: true, new: true }
  );

  cache.set(getCacheKey(key), normalized, CACHE_TTL_SECONDS);
  return normalized;
};

const getTurnstileEnabled = async () => {
  return getBooleanFlag(
    TURNSTILE_ENABLED_KEY,
    true,
    'Enable/disable Cloudflare Turnstile verification'
  );
};

const setTurnstileEnabled = async (enabled) => {
  return setBooleanFlag(
    TURNSTILE_ENABLED_KEY,
    enabled,
    'Enable/disable Cloudflare Turnstile verification'
  );
};

const getChatbotEnabled = async () => {
  return getBooleanFlag(
    CHATBOT_ENABLED_KEY,
    true,
    'Enable/disable chatbot access'
  );
};

const setChatbotEnabled = async (enabled) => {
  return setBooleanFlag(
    CHATBOT_ENABLED_KEY,
    enabled,
    'Enable/disable chatbot access'
  );
};

module.exports = {
  getTurnstileEnabled,
  setTurnstileEnabled,
  getChatbotEnabled,
  setChatbotEnabled,
  TURNSTILE_ENABLED_KEY,
  CHATBOT_ENABLED_KEY,
};
