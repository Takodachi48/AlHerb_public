/**
 * Summary:
 * - Removed reset-link leakage from API responses to avoid exposing sensitive recovery URLs.
 * - Consolidated Firebase->Mongo user sync logic to reduce duplicated queries and branch complexity.
 */
const { auth, verifyToken } = require('../config/firebase');
const User = require('../models/User');
const { formatError, formatSuccess } = require('../utils/responseFormatter');
const { logger } = require('../utils/logger');
const { verifyTurnstile } = require('../utils/captcha');
const { getTurnstileEnabled } = require('../services/featureFlagService');

const resolveAuthProvider = (decodedToken) => {
  const provider = decodedToken?.firebase?.sign_in_provider;
  if (provider === 'password') return 'local';
  if (provider === 'google.com') return 'google';
  if (provider === 'facebook.com') return 'facebook';
  if (provider === 'apple.com') return 'apple';
  return provider ? 'unknown' : 'unknown';
};

// Keep helper outside class to avoid `this` binding issues in route handlers.
const syncUserFromFirebase = async (decodedToken, profile = {}) => {
  const {
    uid,
    email,
    email_verified: emailVerified,
    name,
    picture,
  } = decodedToken;

  let user = await User.findOne({ uid });
  if (!user) {
    user = await User.findOne({ email });
    if (user) {
      user.uid = uid;
      user.isActive = true;
    }
  }

  if (!user) {
    user = new User({
      uid,
      email,
      displayName: profile.displayName || name || email.split('@')[0],
      photoURL: picture || null,
      dateOfBirth: profile.dateOfBirth,
      gender: profile.gender,
      medicalInfo: profile.medicalInfo || {},
      role: 'user',
      isActive: true,
      authProvider: resolveAuthProvider(decodedToken),
    });
  }

  if (!user.isActive) {
    return null;
  }

  user.email = email;
  user.displayName = name || user.displayName;
  if (!user.authProvider || user.authProvider === 'unknown') {
    user.authProvider = resolveAuthProvider(decodedToken);
  }
  if (!(user.photoURL && user.photoURL.startsWith('https://res.cloudinary.com'))) {
    user.photoURL = picture || user.photoURL;
  }
  user.emailVerified = emailVerified;
  user.lastLoginAt = new Date();

  await user.save();
  return user;
};

const verifyCaptchaOrReject = async (captchaToken, req, res) => {
  const turnstileEnabled = await getTurnstileEnabled();
  if (!turnstileEnabled) {
    return true;
  }

  if (!captchaToken) {
    res.status(400).json(formatError('Captcha token is required', 400));
    return false;
  }

  if (!process.env.TURNSTILE_SECRET) {
    logger.error('TURNSTILE_SECRET is missing; captcha verification cannot run');
    res.status(500).json(formatError('Captcha verification is not configured', 500));
    return false;
  }

  const isCaptchaValid = await verifyTurnstile(
    captchaToken,
    process.env.TURNSTILE_SECRET,
    req.ip
  );
  if (!isCaptchaValid) {
    res.status(400).json(formatError('Captcha verification failed', 400));
    return false;
  }

  return true;
};

class AuthController {

  // Login with Firebase token
  async login(req, res) {
    try {
      const { token, captchaToken } = req.body;

      if (!token) {
        return res.status(400).json(
          formatError('Firebase ID token is required', 400)
        );
      }

      const isCaptchaValid = await verifyCaptchaOrReject(captchaToken, req, res);
      if (!isCaptchaValid) {
        return;
      }

      // Verify Firebase token
      const decodedToken = await verifyToken(token);
      const { email_verified: emailVerified } = decodedToken;

      // Check if email is verified
      if (!emailVerified) {
        return res.status(403).json(
          formatError('Please verify your email before signing in', 403)
        );
      }

      const user = await syncUserFromFirebase(decodedToken);
      if (!user) {
        return res.status(403).json(
          formatError('Account has been deactivated', 403)
        );
      }

      res.json(
        formatSuccess({
          user: {
            uid: user.uid,
            email: user.email,
            displayName: user.displayName,
            photoURL: user.photoURL,
            bannerURL: user.bannerURL,
            location: user.location,
            profile: user.profile,
            emailVerified: emailVerified, // Use Firebase's email verification status
            role: user.role,
          },
        }, 'Login successful')
      );
    } catch (error) {
      logger.error('Login error:', error);
      res.status(401).json(
        formatError('Invalid authentication token', 401)
      );
    }
  }

  // Register new user
  async register(req, res) {
    try {
      const { token, profile, captchaToken } = req.body;

      if (!token) {
        return res.status(400).json(
          formatError('Firebase ID token is required', 400)
        );
      }

      const isCaptchaValid = await verifyCaptchaOrReject(captchaToken, req, res);
      if (!isCaptchaValid) {
        return;
      }

      // Verify Firebase token
      const decodedToken = await verifyToken(token);
      const { uid, email_verified: emailVerified } = decodedToken;

      const existingByUid = await User.findOne({ uid });
      if (existingByUid) {
        return res.status(409).json(formatError('User already exists', 409));
      }
      const user = await syncUserFromFirebase(decodedToken, profile || {});
      if (!user) {
        return res.status(403).json(
          formatError('Account has been deactivated', 403)
        );
      }

      res.status(201).json(
        formatSuccess({
          user: {
            uid: user.uid,
            email: user.email,
            displayName: user.displayName,
            photoURL: user.photoURL,
            bannerURL: user.bannerURL,
            location: user.location,
            profile: user.profile,
            emailVerified: emailVerified, // Use Firebase's email verification status
            role: user.role,
          },
        }, 'Registration successful')
      );
    } catch (error) {
      logger.error('Registration error:', error);
      res.status(500).json(
        formatError('Registration failed', 500)
      );
    }
  }

  // Logout user
  async logout(req, res) {
    try {
      const { uid } = req.user || {};

      if (uid) {
        // Update last login time only if user is authenticated
        await User.findOneAndUpdate(
          { uid },
          { lastLoginAt: new Date() }
        );
        logger.info(`User logged out: ${uid}`);
      } else {
        logger.warn('Logout request without valid token');
      }

      res.json(
        formatSuccess(null, 'Logout successful')
      );
    } catch (error) {
      logger.error('Logout error:', error);
      res.status(500).json(
        formatError('Logout failed', 500)
      );
    }
  }

  // Refresh token
  async refreshToken(req, res) {
    try {
      const { idToken } = req.body;

      if (!idToken) {
        return res.status(400).json(
          formatError('ID token is required', 400)
        );
      }

      // Verify and refresh token
      const decodedToken = await verifyToken(idToken);

      res.json(
        formatSuccess({
          token: idToken,
          user: {
            uid: decodedToken.uid,
            email: decodedToken.email,
            emailVerified: decodedToken.email_verified,
          },
        }, 'Token refreshed successfully')
      );
    } catch (error) {
      logger.error('Token refresh error:', error);
      res.status(401).json(
        formatError('Invalid token', 401)
      );
    }
  }

  // Send email verification
  async sendEmailVerification(req, res) {
    try {
      const { uid } = req.user;

      // Get user from Firebase
      const userRecord = await auth.getUser(uid);

      if (userRecord.emailVerified) {
        return res.status(400).json(
          formatError('Email already verified', 400)
        );
      }

      // Send verification email
      await auth.generateEmailVerificationLink(userRecord.email);

      logger.info(`Email verification sent to: ${userRecord.email}`);

      res.json(
        formatSuccess(null, 'Email verification sent')
      );
    } catch (error) {
      logger.error('Email verification error:', error);
      res.status(500).json(
        formatError('Failed to send email verification', 500)
      );
    }
  }

  // Reset password
  async resetPassword(req, res) {
    try {
      const { email } = req.body;

      if (!email) {
        return res.status(400).json(
          formatError('Email is required', 400)
        );
      }

      // Generate password reset link server-side; never return it to clients.
      await auth.generatePasswordResetLink(email);

      logger.info(`Password reset link generated for: ${email}`);

      res.json(
        formatSuccess(null, 'Password reset link sent')
      );
    } catch (error) {
      logger.error('Password reset error:', error);
      res.status(500).json(
        formatError('Failed to generate password reset link', 500)
      );
    }
  }

  // Google Sign In
  async googleSignIn(req, res) {
    try {
      const { token, captchaToken } = req.body;

      if (!token) {
        return res.status(400).json(
          formatError('Firebase ID token is required', 400)
        );
      }

      const isCaptchaValid = await verifyCaptchaOrReject(captchaToken, req, res);
      if (!isCaptchaValid) {
        return;
      }

      // Verify Firebase token first to prevent spoofing
      const decodedToken = await verifyToken(token);
      const { uid, email, email_verified: emailVerified } = decodedToken;

      // Validate that the token contains required fields
      if (!uid || !email) {
        return res.status(400).json(
          formatError('Invalid token: missing UID or email', 400)
        );
      }

      // Check if email is verified
      if (!emailVerified) {
        return res.status(403).json(
          formatError('Please verify your email before signing in', 403)
        );
      }


      const user = await syncUserFromFirebase(decodedToken);
      if (!user) {
        return res.status(403).json(
          formatError('Account has been deactivated', 403)
        );
      }

      logger.info(`User signed in via Google: ${email}`);

      res.json(
        formatSuccess({
          user: {
            _id: user._id,
            uid: user.uid,
            email: user.email,
            displayName: user.displayName,
            photoURL: user.photoURL,
            bannerURL: user.bannerURL,
            location: user.location,
            profile: user.profile,
            role: user.role,
            emailVerified: user.emailVerified,
            createdAt: user.createdAt
          },
          // Return the verified token for client use
          token: token
        }, 'Google sign in successful')
      );
    } catch (error) {
      logger.error('Google sign in error:', error);
      res.status(401).json(
        formatError('Invalid authentication token', 401)
      );
    }
  }

  // Change password
  async changePassword(req, res) {
    try {
      const { newPassword } = req.body;
      const { uid } = req.user;

      if (!newPassword) {
        return res.status(400).json(
          formatError('New password is required', 400)
        );
      }

      // Update user password in Firebase
      await auth.updateUser(uid, { password: newPassword });

      logger.info(`Password changed for user: ${uid}`);

      res.json(
        formatSuccess(null, 'Password changed successfully')
      );
    } catch (error) {
      logger.error('Change password error:', error);
      res.status(500).json(
        formatError('Failed to change password', 500)
      );
    }
  }

  // Update user profile
  async updateProfile(req, res) {
    try {
      const { profile } = req.body;
      const { uid } = req.user; // User info comes from middleware

      if (!uid) {
        return res.status(401).json(
          formatError('User not authenticated', 401)
        );
      }

      // Find user
      const user = await User.findOne({ uid });
      if (!user) {
        return res.status(404).json(
          formatError('User not found', 404)
        );
      }

      // Update user profile
      if (profile.displayName) {
        user.displayName = profile.displayName;
      }
      if (profile.photoURL) {
        user.photoURL = profile.photoURL;
      }
      if (profile.bannerURL) {
        user.bannerURL = profile.bannerURL;
      }
      if (profile.location) {
        user.location = profile.location;
      }
      if (profile.profile && profile.profile.bio !== undefined) {
        if (!user.profile) user.profile = {};
        user.profile.bio = profile.profile.bio;
      }

      await user.save();
      logger.info(`Profile updated for user: ${uid}`);

      res.json(
        formatSuccess({
          user: {
            uid: user.uid,
            email: user.email,
            displayName: user.displayName,
            photoURL: user.photoURL,
            bannerURL: user.bannerURL,
            location: user.location,
            profile: user.profile,
            role: user.role,
            emailVerified: user.emailVerified,
          },
        }, 'Profile updated successfully')
      );
    } catch (error) {
      logger.error('Profile update error:', error);
      res.status(500).json(
        formatError('Failed to update profile', 500)
      );
    }
  }
}

module.exports = new AuthController();
