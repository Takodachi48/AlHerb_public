const Inquiry = require('../models/Inquiry');
const { verifyTurnstile } = require('../utils/captcha');
const { getTurnstileEnabled } = require('../services/featureFlagService');

const submitInquiry = async (req, res) => {
  const { name, contactType, contactValue, message, captchaToken } = req.body;

  // Basic validation
  if (!name || !contactType || !contactValue || !message) {
    return res.status(400).json({
      success: false,
      message: 'All fields are required',
    });
  }

  if (!['email', 'phone'].includes(contactType)) {
    return res.status(400).json({
      success: false,
      message: 'Invalid contact type',
    });
  }

  const turnstileEnabled = await getTurnstileEnabled();
  if (turnstileEnabled) {
    if (!captchaToken) {
      return res.status(400).json({
        success: false,
        message: 'Captcha token is required',
      });
    }

    const isCaptchaValid = await verifyTurnstile(captchaToken, process.env.TURNSTILE_SECRET, req.ip);
    if (!isCaptchaValid) {
      return res.status(400).json({
        success: false,
        message: 'Captcha verification failed',
      });
    }
  }

  try {
    const inquiry = new Inquiry({
      name: name.trim(),
      contactType,
      contactValue: contactValue.trim(),
      message: message.trim(),
    });

    await inquiry.save();

    res.status(201).json({
      success: true,
      message: 'Inquiry submitted successfully',
      data: {
        id: inquiry._id,
        createdAt: inquiry.createdAt,
      },
    });
  } catch (error) {
    console.error('Error submitting inquiry:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to submit inquiry. Please try again.',
    });
  }
};

module.exports = {
  submitInquiry,
};
