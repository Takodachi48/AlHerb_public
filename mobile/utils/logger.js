import Constants from 'expo-constants';

const getExtraEnv = (key) => {
  const value = Constants.expoConfig?.extra?.env?.[key];
  const trimmed = String(value ?? '').trim();
  return trimmed || undefined;
};

const debugFlag =
  getExtraEnv('EXPO_PUBLIC_DEBUG_LOGS') || process.env.EXPO_PUBLIC_DEBUG_LOGS;
const isDebugLoggingEnabled = __DEV__ && debugFlag === 'true';
let consoleConfigured = false;

export const debugLog = (...args) => {
  if (isDebugLoggingEnabled) {
    console.log(...args);
  }
};

export const debugWarn = (...args) => {
  if (isDebugLoggingEnabled) {
    console.warn(...args);
  }
};

export const configureConsoleLogging = () => {
  if (consoleConfigured) return;
  consoleConfigured = true;

  if (!isDebugLoggingEnabled) {
    console.log = () => {};
    console.info = () => {};
    console.debug = () => {};
  }
};

export { isDebugLoggingEnabled };
