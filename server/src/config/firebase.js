/**
 * Summary:
 * - Removed insecure JWT secret fallback and now requires `JWT_SECRET` explicitly.
 * - Removed `process.exit` side effects; missing Firebase config now fails at call time with clear errors.
 * - Added guarded Firebase initialization so tests/migrations can load config without crashing.
 */
const admin = require('firebase-admin');
const jwt = require('jsonwebtoken');
const { logger } = require('../utils/logger');

const REQUIRED_FIREBASE_ENV_KEYS = [
  'FIREBASE_PROJECT_ID',
  'FIREBASE_PRIVATE_KEY',
  'FIREBASE_CLIENT_EMAIL',
];

const JWT_SECRET = process.env.JWT_SECRET;

const getMissingFirebaseEnvKeys = () =>
  REQUIRED_FIREBASE_ENV_KEYS.filter((key) => !process.env[key]);

const hasFirebaseCredentials = () => getMissingFirebaseEnvKeys().length === 0;

const initializeFirebase = () => {
  if (admin.apps.length > 0) {
    return;
  }

  if (!hasFirebaseCredentials()) {
    const missing = getMissingFirebaseEnvKeys().join(', ');
    logger.warn(`Firebase Admin SDK not initialized. Missing env keys: ${missing}`);
    return;
  }

  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
    }),
  });

  logger.info('Firebase Admin SDK initialized');
};

initializeFirebase();

const assertFirebaseInitialized = () => {
  if (admin.apps.length === 0) {
    throw new Error(
      'Firebase Admin SDK is not initialized. Configure FIREBASE_PROJECT_ID, FIREBASE_PRIVATE_KEY, and FIREBASE_CLIENT_EMAIL.'
    );
  }
};

const getAuth = () => {
  assertFirebaseInitialized();
  return admin.auth();
};

const verifyToken = async (idToken) => {
  if (!idToken || typeof idToken !== 'string') {
    throw new Error('Invalid token format');
  }

  const tokenSegments = idToken.split('.');
  if (tokenSegments.length !== 3) {
    throw new Error('Token does not appear to be a Firebase ID token');
  }

  try {
    return await getAuth().verifyIdToken(idToken);
  } catch (error) {
    logger.warn(`Firebase token verification failed: ${error.message}`);
    throw new Error('Invalid or expired token');
  }
};

const getUserByUID = async (uid) => {
  try {
    return await getAuth().getUser(uid);
  } catch (error) {
    throw new Error('User not found');
  }
};

const isEmailVerified = async (uid) => {
  const userRecord = await getUserByUID(uid);
  return Boolean(userRecord.emailVerified);
};

const assertJwtSecret = () => {
  if (!JWT_SECRET) {
    throw new Error('JWT_SECRET is required for JWT operations');
  }
};

const generateToken = (user) => {
  assertJwtSecret();

  const payload = {
    uid: user.uid,
    email: user.email,
    role: user.role || 'user',
  };

  return jwt.sign(payload, JWT_SECRET, {
    expiresIn: '1h',
  });
};

const verifyJWTToken = (token) => {
  assertJwtSecret();
  return jwt.verify(token, JWT_SECRET);
};

const setCustomClaim = async (uid, claims) => {
  await getAuth().setCustomUserClaims(uid, claims);
};

const auth = {
  getUser: (...args) => getAuth().getUser(...args),
  generateEmailVerificationLink: (...args) => getAuth().generateEmailVerificationLink(...args),
  generatePasswordResetLink: (...args) => getAuth().generatePasswordResetLink(...args),
  updateUser: (...args) => getAuth().updateUser(...args),
  setCustomUserClaims: (...args) => getAuth().setCustomUserClaims(...args),
};

const firestore = {
  collection: (...args) => {
    assertFirebaseInitialized();
    return admin.firestore().collection(...args);
  },
};

module.exports = {
  auth,
  firestore,
  verifyToken,
  getUserByUID,
  isEmailVerified,
  generateToken,
  verifyJWTToken,
  setCustomClaim,
};
