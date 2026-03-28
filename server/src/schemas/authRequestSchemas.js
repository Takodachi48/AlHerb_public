/**
 * Summary:
 * - Added explicit body validation for auth endpoints to fail fast on malformed payloads.
 * - Applies strict bounds to token/password/profile fields to reduce abuse and invalid writes.
 */
const Joi = require('joi');

const firebaseIdToken = Joi.string().trim().min(16).max(8000).required();
const captchaToken = Joi.string().trim().min(10).max(4000).optional().allow('');

const profileSchema = Joi.object({
  displayName: Joi.string().trim().min(2).max(80),
  photoURL: Joi.string().uri(),
  bannerURL: Joi.string().uri(),
  dateOfBirth: Joi.date().iso(),
  gender: Joi.string().valid('male', 'female'),
  medicalInfo: Joi.object().unknown(true),
  location: Joi.object({
    city: Joi.string().trim().max(100),
    province: Joi.string().trim().max(100),
    region: Joi.string().trim().max(100),
    country: Joi.string().trim().max(100),
  }),
  profile: Joi.object({
    bio: Joi.string().trim().max(500).allow(''),
  }),
}).min(1);

const loginSchema = Joi.object({
  token: firebaseIdToken,
  captchaToken,
});

const registerSchema = Joi.object({
  token: firebaseIdToken,
  captchaToken,
  profile: profileSchema.optional(),
});

const googleSignInSchema = Joi.object({
  token: firebaseIdToken,
  captchaToken,
});

const refreshTokenSchema = Joi.object({
  idToken: firebaseIdToken,
});

const resetPasswordSchema = Joi.object({
  email: Joi.string().trim().email().required(),
});

const changePasswordSchema = Joi.object({
  newPassword: Joi.string().min(8).max(128).required(),
});

const updateProfileSchema = Joi.object({
  profile: profileSchema.required(),
});

module.exports = {
  loginSchema,
  registerSchema,
  googleSignInSchema,
  refreshTokenSchema,
  resetPasswordSchema,
  changePasswordSchema,
  updateProfileSchema,
};
