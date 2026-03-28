/**
 * Summary:
 * - Added Joi-based request validation for all payload-bearing auth routes.
 * - Keeps route handlers unchanged while reducing malformed-input and injection risk at the edge.
 */
const express = require('express');
const authController = require('../controllers/authController');
const { verifyToken, optionalAuth } = require('../middleware/auth');
const { validateRequest } = require('../middleware/validateRequest');
const {
  changePasswordSchema,
  googleSignInSchema,
  loginSchema,
  refreshTokenSchema,
  registerSchema,
  resetPasswordSchema,
  updateProfileSchema,
} = require('../schemas/authRequestSchemas');

const router = express.Router();

router.post('/login', validateRequest(loginSchema), authController.login);
router.post('/register', validateRequest(registerSchema), authController.register);
router.post('/google-signin', validateRequest(googleSignInSchema), authController.googleSignIn);
router.post('/refresh', validateRequest(refreshTokenSchema), authController.refreshToken);
router.post('/reset-password', validateRequest(resetPasswordSchema), authController.resetPassword);

router.post('/logout', optionalAuth, authController.logout);
router.post('/verify-email', verifyToken, authController.sendEmailVerification);
router.post('/change-password', verifyToken, validateRequest(changePasswordSchema), authController.changePassword);
router.put('/profile', verifyToken, validateRequest(updateProfileSchema), authController.updateProfile);

module.exports = router;
