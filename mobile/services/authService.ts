import AsyncStorage from '@react-native-async-storage/async-storage';
import apiClient, { setTokenRefreshHandler } from './apiClient';
import { API_ENDPOINTS } from '../shared/constants/api-endpoints';
import { auth } from './firebase';
import { debugLog } from '../utils/logger';
import {
  createUserWithEmailAndPassword,
  updateProfile,
  getIdToken,
  signInWithEmailAndPassword,
  sendEmailVerification,
  signOut,
  UserCredential,
  User as FirebaseUser,
  fetchSignInMethodsForEmail,
} from 'firebase/auth';
import { User } from '../shared/types/user.types';

// Inject refresh handler to avoid circular dependency
try {
  setTokenRefreshHandler(async () => {
    if (auth.currentUser) {
      debugLog('Refreshing token via Firebase SDK...');
      return await auth.currentUser.getIdToken(true);
    }
    return null;
  });
  debugLog('✅ Token refresh handler registered successfully');
} catch (e) {
  console.error('❌ Failed to register token refresh handler:', e);
}

export interface AuthResult {
  success: boolean;
  user?: User;
  role?: string;
  token?: string;
  message?: string;
}

class AuthService {
  async login(
    email: string,
    password: string,
    rememberMe = false,
    captchaToken?: string
  ): Promise<AuthResult> {
    try {
      const normalizedEmail = String(email || '').trim().toLowerCase();

      // Sign in with Firebase
      const userCredential: UserCredential = await signInWithEmailAndPassword(auth, normalizedEmail, password);
      const user: FirebaseUser = userCredential.user;

      // Get Firebase ID token
      const idToken = await getIdToken(user);

      // Send token to backend
      const response = await apiClient.post(API_ENDPOINTS.AUTH.LOGIN, {
        token: idToken,
        rememberMe,
        captchaToken,
      });

      if (response.data && response.data.success && response.data.data) {
        const { user: userData, token } = response.data.data;
        await AsyncStorage.setItem('authToken', token || idToken);
        if (response.data.refreshToken) {
          await AsyncStorage.setItem('refreshToken', response.data.refreshToken);
        }

        // Cache the full user data from backend
        const data: User = {
          ...userData,
        };
        await AsyncStorage.setItem('userData', JSON.stringify(data));

        return {
          success: true,
          user: data,
          role: userData.role,
          token: token,
        };
      }

      throw new Error('Invalid response from server');
    } catch (error: any) {
      console.error('Login error:', error);
      if (error?.code === 'auth/invalid-credential') {
        try {
          const normalizedEmail = String(email || '').trim().toLowerCase();
          const methods = await fetchSignInMethodsForEmail(auth, normalizedEmail);
          if (methods.includes('google.com') && !methods.includes('password')) {
            throw new Error('This account uses Google sign-in. Please use the Google button.');
          }
        } catch {
          // Ignore lookup errors and fall back to generic invalid credential message.
        }
        throw new Error('Invalid email or password.');
      }
      throw new Error(error.response?.data?.error || error.message || 'Login failed');
    }
  }

  async register(
    email: string,
    password: string,
    displayName: string,
    captchaToken?: string
  ): Promise<AuthResult> {
    try {
      // Create user in Firebase first
      const userCredential: UserCredential = await createUserWithEmailAndPassword(auth, email, password);
      const user: FirebaseUser = userCredential.user;

      // Update profile with display name
      await updateProfile(user, { displayName });

      // Send verification email
      await sendEmailVerification(user);
      debugLog('✅ Verification email sent to:', email);

      // Get Firebase ID token
      const idToken = await getIdToken(user);

      // Send token to backend to create/sync user
      const response = await apiClient.post(API_ENDPOINTS.AUTH.REGISTER, {
        token: idToken,
        profile: {
          displayName,
        },
        captchaToken,
      });

      if (response.data && response.data.success) {
        await AsyncStorage.setItem('authToken', idToken);
        return {
          success: true,
          message: 'Registration successful. Please verify your email.',
        };
      }

      throw new Error('Invalid response from server');
    } catch (error: any) {
      console.error('Register error:', error);
      throw new Error(error.response?.data?.error || error.message || 'Registration failed');
    }
  }

  async googleSignIn(idToken: string, captchaToken?: string): Promise<AuthResult> {
    try {
      // Send the Firebase ID token to backend for Google sign-in
      const response = await apiClient.post(API_ENDPOINTS.AUTH.GOOGLE_SIGNIN, {
        token: idToken,
        captchaToken,
      });

      if (response.data && response.data.success && response.data.data) {
        const { user: userData, token } = response.data.data;
        await AsyncStorage.setItem('authToken', token || idToken);

        // Cache the full user data from backend
        const data: User = {
          ...userData,
        };
        await AsyncStorage.setItem('userData', JSON.stringify(data));

        return {
          success: true,
          user: data,
          role: userData.role,
          token: token,
        };
      }

      throw new Error('Invalid response from server');
    } catch (error: any) {
      console.error('Google sign-in error:', error);
      if (error?.code === 'auth/invalid-credential') {
        throw new Error('Google credential rejected. Check mobile Google client IDs and Firebase Auth provider setup.');
      }
      throw new Error(error.response?.data?.error || error.message || 'Google sign-in failed');
    }
  }

  async logout(): Promise<void> {
    try {
      await apiClient.post(API_ENDPOINTS.AUTH.LOGOUT);
    } catch (error) {
      console.error('Logout API error:', error);
    }
    try {
      // Sign out of Firebase to clear the in-memory session
      await signOut(auth);
    } catch (error) {
      console.error('Firebase signOut error:', error);
    }
    // Clear ALL cached data
    try {
      await AsyncStorage.clear();
      debugLog('✅ All cached data cleared on logout');
    } catch (error) {
      console.error('AsyncStorage clear error:', error);
    }
  }

  async getCurrentUser(): Promise<User | null> {
    try {
      const token = await AsyncStorage.getItem('authToken');
      const userDataStr = await AsyncStorage.getItem('userData');

      if (token && userDataStr) {
        return JSON.parse(userDataStr);
      }
      return null;
    } catch (error) {
      console.error('Error getting user:', error);
      return null;
    }
  }

  async updateUserData(updatedData: Partial<User>): Promise<User | null> {
    try {
      const currentUser = await this.getCurrentUser();
      if (currentUser) {
        const newData = { ...currentUser, ...updatedData };
        await AsyncStorage.setItem('userData', JSON.stringify(newData));
        debugLog('✅ Cached user data updated');
        return newData;
      }
      return null;
    } catch (error) {
      console.error('Error updating cached user:', error);
      return null;
    }
  }

  async isAuthenticated(): Promise<boolean> {
    const user = await this.getCurrentUser();
    return !!user;
  }
}

export default new AuthService();

