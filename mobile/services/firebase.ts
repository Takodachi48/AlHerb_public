import { initializeApp, FirebaseApp } from 'firebase/app';
import { initializeAuth, GoogleAuthProvider, signInWithCredential, getAuth, Auth, User } from 'firebase/auth';
// @ts-ignore - Some Firebase version typings omit this export, but it exists at runtime
import { getReactNativePersistence } from 'firebase/auth';
import ReactNativeAsyncStorage from '@react-native-async-storage/async-storage';
import * as Google from 'expo-auth-session/providers/google';
import * as WebBrowser from 'expo-web-browser';
import Constants from 'expo-constants';

const getRequiredEnv = (value: string | undefined, key: string): string => {
  const trimmed = String(value || '').trim();
  if (!trimmed) {
    throw new Error(`Missing required Firebase env var: ${key}`);
  }
  return trimmed;
};

const extraFirebase =
  (Constants.expoConfig?.extra as { firebase?: Record<string, string> } | undefined)?.firebase ||
  {};

const firebaseConfig = {
  apiKey: getRequiredEnv(
    extraFirebase.apiKey || process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
    'EXPO_PUBLIC_FIREBASE_API_KEY'
  ),
  authDomain: getRequiredEnv(
    extraFirebase.authDomain || process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
    'EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN'
  ),
  projectId: getRequiredEnv(
    extraFirebase.projectId || process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
    'EXPO_PUBLIC_FIREBASE_PROJECT_ID'
  ),
  storageBucket: getRequiredEnv(
    extraFirebase.storageBucket || process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET,
    'EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET'
  ),
  messagingSenderId: getRequiredEnv(
    extraFirebase.messagingSenderId || process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
    'EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID'
  ),
  appId: getRequiredEnv(
    extraFirebase.appId || process.env.EXPO_PUBLIC_FIREBASE_APP_ID,
    'EXPO_PUBLIC_FIREBASE_APP_ID'
  ),
};

WebBrowser.maybeCompleteAuthSession();

const app: FirebaseApp = initializeApp(firebaseConfig);

let auth: Auth;
try {
  auth = initializeAuth(app, {
    persistence: getReactNativePersistence(ReactNativeAsyncStorage)
  });
} catch (error) {
  // If auth is already initialized (hot reload), get the existing instance
  auth = getAuth(app);
}

export { auth };
export const googleProvider = new GoogleAuthProvider();

export function useGoogleAuthRequestWithProxy(options: any) {
  return Google.useAuthRequest({
    ...options,
  });
}

export async function signInWithGoogleAsync(promptAsyncResult: any): Promise<{ user: User; token: string }> {
  if (!promptAsyncResult?.type || promptAsyncResult.type !== 'success') {
    throw new Error('Google sign-in was cancelled or failed');
  }

  const id_token =
    promptAsyncResult?.params?.id_token ||
    promptAsyncResult?.authentication?.idToken;

  if (!id_token) {
    throw new Error(
      'Google sign-in did not return an ID token. Check Google client IDs and OAuth configuration.'
    );
  }

  const credential = GoogleAuthProvider.credential(id_token);
  const { user } = await signInWithCredential(auth, credential);
  const token = await user.getIdToken();

  return { user, token };
}

export default app;
