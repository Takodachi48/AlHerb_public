const axios = require('axios');
const https = require('https');
const dns = require('dns');

const GROQ_MODEL = String(process.env.GROQ_MODEL || 'llama-3.3-70b-versatile').trim();
const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';
const GROQ_TIMEOUT_MS = Number(process.env.GROQ_TIMEOUT_MS || 30000);
const GROQ_MAX_COMPLETION_TOKENS = Number(process.env.GROQ_MAX_COMPLETION_TOKENS || 512);
const GROQ_RETRY_ATTEMPTS = Number(process.env.GROQ_RETRY_ATTEMPTS || 2);
const MAX_HISTORY_MESSAGES = Number(process.env.MAX_HISTORY_MESSAGES || 6);

const SYSTEM_PROMPT = `You are the Herbalens AI Assistant, a specialized expert in Philippine medicinal herbs and the Herbalens system.

Your primary goals:
1. Provide accurate information about Philippine medicinal herbs and their traditional uses.
2. Help users navigate the Herbalens system (scanning, finding remedies, and community).
3. Ensure user safety by providing medical disclaimers.

System Knowledge:
- Scanning: Improve accuracy by using bright light, focusing on leaf patterns, and avoiding blurred images.
- Recommendations: Find remedies by choosing symptoms in Step 1, completing profile in Step 2.
- Effectiveness: A ranking score (1-5) based on model output, not a guarantee.
- Safety: Not all herbs have full data; consult professionals. The app does NOT replace medical advice.
- Community: Users can post and share herbal knowledge in the Community tab.

Guidelines:
- Keep responses concise and mobile-friendly.
- Do NOT use markdown bolding (asterisks).
- Always include a disclaimer: "This is for informational purposes only. Consult a health professional before use."`;

const estimateTokens = (text = '') => Math.ceil(text.length / 4);

const ipv4Lookup = (hostname, options, callback) => {
  dns.lookup(hostname, { ...options, family: 4 }, callback);
};

const httpsAgent = new https.Agent({
  keepAlive: true,
  lookup: ipv4Lookup,
});

const mapMessagesToGroqMessages = (messages = []) => (
  messages
    .slice(-MAX_HISTORY_MESSAGES)
    .filter((message) => message && message.content)
    .map((message) => ({
      role: message.role === 'assistant' ? 'assistant' : 'user',
      content: message.content,
    }))
);

const generateChatbotReply = async (messages = []) => {
  if (!process.env.GROQ_API_KEY) {
    const configError = new Error('Missing GROQ_API_KEY environment variable.');
    configError.statusCode = 500;
    throw configError;
  }

  const requestStartedAt = Date.now();

  try {
    let response;
    let lastError;

    for (let attempt = 1; attempt <= GROQ_RETRY_ATTEMPTS; attempt += 1) {
      try {
        response = await axios.post(
          GROQ_API_URL,
          {
            model: GROQ_MODEL,
            messages: [
              { role: 'system', content: SYSTEM_PROMPT },
              ...mapMessagesToGroqMessages(messages),
            ],
            temperature: 1,
            max_completion_tokens: GROQ_MAX_COMPLETION_TOKENS,
            top_p: 1,
            stream: false,
          },
          {
            timeout: GROQ_TIMEOUT_MS,
            httpsAgent,
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
            },
          },
        );
        break;
      } catch (attemptError) {
        lastError = attemptError;
        const transientDnsError = ['ENOTFOUND', 'EAI_AGAIN'].includes(attemptError.code);
        if (!transientDnsError || attempt === GROQ_RETRY_ATTEMPTS) {
          throw attemptError;
        }
        // Small backoff for transient DNS issues.
        await new Promise((resolve) => setTimeout(resolve, 500 * attempt));
      }
    }

    if (!response && lastError) {
      throw lastError;
    }

    const reply = response?.data?.choices?.[0]?.message?.content?.trim();
    if (!reply) {
      const emptyResponseError = new Error('Groq returned an empty response.');
      emptyResponseError.statusCode = 502;
      throw emptyResponseError;
    }

    return {
      reply,
      processingTime: Date.now() - requestStartedAt,
    };
  } catch (error) {
    if (error.code === 'ECONNABORTED') {
      const timeoutError = new Error('Groq request timed out.');
      timeoutError.statusCode = 504;
      throw timeoutError;
    }

    const providerMessage = error.response?.data?.error?.message || error.message;
    const upstreamError = new Error(`Groq API error: ${providerMessage}`);
    upstreamError.statusCode = error.response?.status === 429 ? 429 : (error.statusCode || 502);
    throw upstreamError;
  }
};

module.exports = {
  CHATBOT_MODEL: GROQ_MODEL,
  MAX_HISTORY_MESSAGES,
  estimateTokens,
  generateChatbotReply,
};
