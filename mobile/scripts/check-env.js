const fs = require('fs');
const path = require('path');

const requiredKeys = [
  'EXPO_PUBLIC_FIREBASE_API_KEY',
  'EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN',
  'EXPO_PUBLIC_FIREBASE_PROJECT_ID',
  'EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET',
  'EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID',
  'EXPO_PUBLIC_FIREBASE_APP_ID',
  'EXPO_PUBLIC_API_BASE_URL',
];

const optionalKeys = [
  'EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID',
  'EXPO_PUBLIC_GOOGLE_EXPO_CLIENT_ID',
  'EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID',
  'EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID',
  'EXPO_PUBLIC_DEBUG_LOGS',
];

function parseDotEnvFile(envPath) {
  if (!fs.existsSync(envPath)) {
    return {};
  }

  const content = fs.readFileSync(envPath, 'utf8');
  const env = {};

  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) {
      continue;
    }
    const eqIndex = trimmed.indexOf('=');
    if (eqIndex === -1) {
      continue;
    }
    const key = trimmed.slice(0, eqIndex).trim();
    const value = trimmed.slice(eqIndex + 1).trim();
    if (key && !(key in env)) {
      env[key] = value;
    }
  }

  return env;
}

function isMissing(value) {
  return !String(value || '').trim();
}

function main() {
  const envFromProcess = { ...process.env };
  const envFromFile = parseDotEnvFile(path.join(__dirname, '..', '.env'));
  const appJsonPath = path.join(__dirname, '..', 'app.json');
  let appJsonProjectId = null;
  let envFromAppJson = {};
  if (fs.existsSync(appJsonPath)) {
    try {
      const appJson = JSON.parse(fs.readFileSync(appJsonPath, 'utf8'));
      const appExtra = appJson?.expo?.extra || appJson?.extra || {};
      const firebase = appExtra.firebase || {};
      envFromAppJson = {
        ...(appExtra.env || {}),
        EXPO_PUBLIC_FIREBASE_API_KEY: firebase.apiKey,
        EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN: firebase.authDomain,
        EXPO_PUBLIC_FIREBASE_PROJECT_ID: firebase.projectId,
        EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET: firebase.storageBucket,
        EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID: firebase.messagingSenderId,
        EXPO_PUBLIC_FIREBASE_APP_ID: firebase.appId,
      };
      appJsonProjectId =
        appJson?.expo?.extra?.eas?.projectId ||
        appJson?.extra?.eas?.projectId ||
        null;
    } catch {
      // Ignore parse errors for best-effort checks.
    }
  }
  const env = { ...envFromAppJson, ...envFromFile, ...envFromProcess };

  const missingRequired = requiredKeys.filter((key) => isMissing(env[key]));
  const missingOptional = optionalKeys.filter((key) => isMissing(env[key]));
  const missingEasProjectId = isMissing(env.EXPO_PUBLIC_EAS_PROJECT_ID) && !appJsonProjectId;

  if (missingRequired.length > 0) {
    console.error('[check-env] Missing required env vars:');
    for (const key of missingRequired) {
      console.error(`  - ${key}`);
    }
    console.error('[check-env] Provide these via EAS env vars or mobile/.env before building.');
    process.exit(1);
  }

  if (missingOptional.length > 0 || missingEasProjectId) {
    console.warn('[check-env] Missing optional env vars:');
    for (const key of missingOptional) {
      console.warn(`  - ${key}`);
    }
    if (missingEasProjectId) {
      console.warn('  - EXPO_PUBLIC_EAS_PROJECT_ID (not found in app.json extra.eas.projectId)');
    }
  }

  const googleServicesPath = env.GOOGLE_SERVICES_JSON
    ? env.GOOGLE_SERVICES_JSON
    : path.join(__dirname, '..', 'google-services.json');

  if (!fs.existsSync(googleServicesPath)) {
    console.warn(
      `[check-env] google-services.json not found at ${googleServicesPath}. ` +
        'For EAS builds, ensure GOOGLE_SERVICES_JSON is set as a secret.'
    );
  }

  console.log('[check-env] OK');
}

main();
