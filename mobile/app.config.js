const appJson = require('./app.json');
const expoConfig = appJson.expo ?? appJson;

const cleanObject = (obj) =>
  Object.fromEntries(
    Object.entries(obj).filter(([, value]) => String(value ?? '').trim().length > 0)
  );

const firebaseExtra = cleanObject({
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID,
});

const envExtra = cleanObject({
  EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID: process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID,
  EXPO_PUBLIC_GOOGLE_EXPO_CLIENT_ID: process.env.EXPO_PUBLIC_GOOGLE_EXPO_CLIENT_ID,
  EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID: process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID,
  EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID,
  EXPO_PUBLIC_API_BASE_URL: process.env.EXPO_PUBLIC_API_BASE_URL,
  EXPO_PUBLIC_API_FALLBACK_URLS: process.env.EXPO_PUBLIC_API_FALLBACK_URLS,
  EXPO_PUBLIC_DEBUG_LOGS: process.env.EXPO_PUBLIC_DEBUG_LOGS,
  EXPO_PUBLIC_LATEST_APP_VERSION: process.env.EXPO_PUBLIC_LATEST_APP_VERSION,
  EXPO_PUBLIC_CLOUDINARY_CLOUD_NAME: process.env.EXPO_PUBLIC_CLOUDINARY_CLOUD_NAME,
  EXPO_PUBLIC_CLOUDINARY_UPLOAD_PRESET: process.env.EXPO_PUBLIC_CLOUDINARY_UPLOAD_PRESET,
});

module.exports = ({ config }) => ({
  ...config,
  ...expoConfig,
  extra: {
    ...(config.extra || {}),
    ...(expoConfig.extra || {}),
    firebase: {
      ...((config.extra && config.extra.firebase) || {}),
      ...((expoConfig.extra && expoConfig.extra.firebase) || {}),
      ...firebaseExtra,
    },
    env: {
      ...((config.extra && config.extra.env) || {}),
      ...((expoConfig.extra && expoConfig.extra.env) || {}),
      ...envExtra,
    },
  },
  android: {
    ...(config.android || {}),
    ...(expoConfig.android || {}),
    googleServicesFile: process.env.GOOGLE_SERVICES_JSON ?? './google-services.json',
  },
});
