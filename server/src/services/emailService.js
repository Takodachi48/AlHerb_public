const nodemailer = require('nodemailer');
const { logger } = require('../utils/logger');

class EmailService {
  constructor() {
    this.transporter = null;
    this.isConfigured = false;
    this.minIntervalMs = Number(process.env.EMAIL_SEND_INTERVAL_MS || 350);
    this.maxIntervalMs = Number(process.env.EMAIL_SEND_MAX_INTERVAL_MS || 5000);
    this.rateLimitCooldownMs = Number(process.env.EMAIL_RATE_LIMIT_COOLDOWN_MS || 3000);
    this.maxRetries = Number(process.env.EMAIL_SEND_MAX_RETRIES || 4);
    this.retryBaseDelayMs = Number(process.env.EMAIL_SEND_RETRY_BASE_MS || 1000);
    this.currentIntervalMs = this.minIntervalMs;
    this.nextAllowedAt = 0;
    this.sendChain = Promise.resolve();
    this._initializeTransport();
  }

  _initializeTransport() {
    const {
      SMTP_HOST,
      SMTP_PORT,
      SMTP_SECURE,
      SMTP_USER,
      SMTP_PASS,
      SMTP_FROM,
    } = process.env;

    if (!SMTP_HOST || !SMTP_PORT || !SMTP_USER || !SMTP_PASS || !SMTP_FROM) {
      logger.warn('SMTP is not fully configured. Emails will be skipped.');
      return;
    }

    this.transporter = nodemailer.createTransport({
      host: SMTP_HOST,
      port: Number(SMTP_PORT),
      secure: SMTP_SECURE === 'true',
      auth: {
        user: SMTP_USER,
        pass: SMTP_PASS,
      },
    });

    this.isConfigured = true;
  }

  async sendEmail({ to, subject, text, html }) {
    if (!this.isConfigured || !this.transporter) {
      logger.warn(`Email skipped (SMTP not configured). Recipient=${to}, Subject=${subject}`);
      return { skipped: true };
    }

    const sendTask = async () => {
      const waitMs = Math.max(0, this.nextAllowedAt - Date.now());
      if (waitMs > 0) {
        await new Promise((resolve) => setTimeout(resolve, waitMs));
      }

      let attempt = 0;
      while (attempt <= this.maxRetries) {
        try {
          await this.transporter.sendMail({
            from: process.env.SMTP_FROM,
            to,
            subject,
            text,
            html,
          });

          const now = Date.now();
          // Gradually recover to baseline after successful sends.
          this.currentIntervalMs = Math.max(
            this.minIntervalMs,
            Math.floor(this.currentIntervalMs * 0.9)
          );
          this.nextAllowedAt = now + this.currentIntervalMs;
          return { skipped: false };
        } catch (error) {
          const isRateLimit =
            error?.responseCode === 550 ||
            /too many emails per second/i.test(String(error?.message || ''));

          if (!isRateLimit || attempt === this.maxRetries) {
            throw error;
          }

          const retryDelay = this.retryBaseDelayMs * (2 ** attempt);
          // Adaptively slow future sends to reduce repeated provider throttling.
          this.currentIntervalMs = Math.min(
            this.maxIntervalMs,
            Math.floor(this.currentIntervalMs * 1.6) + 200
          );
          this.nextAllowedAt = Date.now() + Math.max(retryDelay, this.rateLimitCooldownMs);
          logger.warn(
            `Email rate-limited. Retrying in ${retryDelay}ms (attempt ${attempt + 1}/${this.maxRetries}), interval=${this.currentIntervalMs}ms`
          );
          await new Promise((resolve) => setTimeout(resolve, retryDelay));
          attempt += 1;
        }
      }

      return { skipped: false };
    };

    const queued = this.sendChain.then(sendTask, sendTask);
    this.sendChain = queued.catch(() => null);
    return queued;
  }
}

module.exports = new EmailService();
