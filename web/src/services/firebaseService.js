import { initializeApp } from 'firebase/app';
import { 
  getAuth, 
  signInWithPopup, 
  signInWithCredential,
  GoogleAuthProvider,
  signOut,
  onAuthStateChanged,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  updateProfile,
  sendEmailVerification,
  setPersistence,
  browserLocalPersistence,
  browserSessionPersistence
} from 'firebase/auth';
import { firebaseConfig } from '../config/firebaseConfig';
import api from './api';

// Initialize Firebase
const firebaseApp = initializeApp(firebaseConfig);
const auth = getAuth(firebaseApp);
const googleProvider = new GoogleAuthProvider();

// Configure Google Provider
googleProvider.setCustomParameters({
  prompt: 'select_account',
  login_hint: ''
});

export const firebaseService = {
  storeAuthSession(idToken, user, rememberMe) {
    if (rememberMe) {
      localStorage.setItem('authToken', idToken);
      localStorage.setItem('userData', JSON.stringify(user));
      localStorage.setItem('tokenExpiry', Date.now() + (3600 * 1000));
      return;
    }
    sessionStorage.setItem('authToken', idToken);
    sessionStorage.setItem('userData', JSON.stringify(user));
    sessionStorage.setItem('tokenExpiry', Date.now() + (3600 * 1000));
  },

  // Google Sign In
  async signInWithGoogle(rememberMe = false, captchaToken = '') {
    try {
      // Set persistence based on remember me
      const persistence = rememberMe ? browserLocalPersistence : browserSessionPersistence;
      await setPersistence(auth, persistence);
      
      const result = await signInWithPopup(auth, googleProvider);
      const user = result.user;
      
      // Get Firebase ID token
      const idToken = await user.getIdToken();
      
      // Send user data to backend
      const response = await api.post('/auth/google-signin', {
        token: idToken,
        captchaToken,
      });
      
      if (response.success) {
        this.storeAuthSession(idToken, response.data.user, rememberMe);
        
        return {
          success: true,
          user: response.data.user,
          role: response.data.user.role
        };
      }
      
      throw new Error(response.data.message || 'Authentication failed');
    } catch (error) {
      console.error('Google sign in error:', error);
      throw error;
    }
  },

  // Google One Tap Sign In (GIS id_token -> Firebase credential)
  async signInWithGoogleIdToken(googleIdToken, rememberMe = false, captchaToken = '') {
    try {
      if (!googleIdToken) {
        throw new Error('Missing Google ID token');
      }

      const persistence = rememberMe ? browserLocalPersistence : browserSessionPersistence;
      await setPersistence(auth, persistence);

      const credential = GoogleAuthProvider.credential(googleIdToken);
      const result = await signInWithCredential(auth, credential);
      const user = result.user;
      const idToken = await user.getIdToken();

      const response = await api.post('/auth/google-signin', {
        token: idToken,
        captchaToken,
      });

      if (response.success) {
        this.storeAuthSession(idToken, response.data.user, rememberMe);
        return {
          success: true,
          user: response.data.user,
          role: response.data.user.role,
        };
      }

      throw new Error(response.data.message || 'Authentication failed');
    } catch (error) {
      console.error('Google One Tap sign in error:', error);
      throw error;
    }
  },

  // Email Sign Up
  async signUp(email, password, displayName, captchaToken = '') {
    try {
      const result = await createUserWithEmailAndPassword(auth, email, password);
      const user = result.user;
      
      // Update profile with display name
      await updateProfile(user, { displayName });
      
      // Send email verification
      await sendEmailVerification(user);
      
      // Get Firebase ID token for backend registration
      const idToken = await user.getIdToken();
      
      // Send user data to backend
      const response = await api.post('/auth/register', {
        token: idToken,
        captchaToken,
        profile: { displayName }
      });
      
      if (response.success) {
        // Sign out the user since they need to verify email first
        await auth.signOut();
        
        return {
          success: true,
          requiresVerification: true,
          message: 'Registration successful! Please check your email to verify your account.',
          email: user.email
        };
      }
      
      throw new Error(response.data.message || 'Registration failed');
    } catch (error) {
      console.error('Sign up error:', error);
      throw error;
    }
  },

  // Email Sign In
  async signIn(email, password, rememberMe = false, captchaToken = '') {
    try {
      // Set persistence based on remember me
      const persistence = rememberMe ? browserLocalPersistence : browserSessionPersistence;
      await setPersistence(auth, persistence);
      
      const result = await signInWithEmailAndPassword(auth, email, password);
      const user = result.user;
      
      // Get Firebase ID token
      const idToken = await user.getIdToken();
      
      // Verify token with backend
      const response = await api.post('/auth/login', {
        token: idToken,
        captchaToken,
      });
      
      if (response.success) {
        // Store Firebase ID token and user data
        if (rememberMe) {
          localStorage.setItem('authToken', idToken);
          localStorage.setItem('userData', JSON.stringify(response.data.user));
          localStorage.setItem('tokenExpiry', Date.now() + (3600 * 1000)); // 1 hour
        } else {
          sessionStorage.setItem('authToken', idToken);
          sessionStorage.setItem('userData', JSON.stringify(response.data.user));
          sessionStorage.setItem('tokenExpiry', Date.now() + (3600 * 1000)); // 1 hour
        }
        
        return {
          success: true,
          user: response.data.user,
          role: response.data.user.role
        };
      }
      
      throw new Error(response.data.message || 'Login failed');
    } catch (error) {
      console.error('Sign in error:', error);
      
      // Handle specific error cases
      if (error.response?.status === 403) {
        throw new Error('Please verify your email before signing in. Check your inbox for the verification email.');
      } else if (error.response?.status === 401) {
        throw new Error('Invalid email or password.');
      } else if (error.code === 'auth/invalid-credential') {
        throw new Error('Invalid email or password. Please check your credentials and try again.');
      } else if (error.code === 'auth/user-not-found') {
        throw new Error('No account found with this email address. Please sign up first.');
      } else if (error.code === 'auth/wrong-password') {
        throw new Error('Incorrect password. Please try again.');
      } else if (error.code === 'auth/user-disabled') {
        throw new Error('This account has been disabled.');
      } else if (error.code === 'auth/too-many-requests') {
        throw new Error('Too many failed attempts. Please try again later.');
      } else {
        throw error;
      }
    }
  },

  // Sign Out
  async signOut() {
    try {
      await auth.signOut();
      
      // Clear both localStorage and sessionStorage
      localStorage.removeItem('authToken');
      localStorage.removeItem('userData');
      localStorage.removeItem('tokenExpiry');
      sessionStorage.removeItem('authToken');
      sessionStorage.removeItem('userData');
      sessionStorage.removeItem('tokenExpiry');
      
      // Notify backend
      await api.post('/auth/logout');
      
      return { success: true };
    } catch (error) {
      console.error('Sign out error:', error);
      // Still clear storage even if backend call fails
      localStorage.removeItem('authToken');
      localStorage.removeItem('userData');
      localStorage.removeItem('tokenExpiry');
      sessionStorage.removeItem('authToken');
      sessionStorage.removeItem('userData');
      sessionStorage.removeItem('tokenExpiry');
      throw error;
    }
  },

  // Get current user
  getCurrentUser() {
    return auth.currentUser;
  },

  // Listen to auth state changes
  onAuthStateChanged(callback) {
    return onAuthStateChanged(auth, callback);
  },

  // Check if user is authenticated
  isAuthenticated() {
    const localToken = localStorage.getItem('authToken');
    const sessionToken = sessionStorage.getItem('authToken');
    const localUserData = localStorage.getItem('userData');
    const sessionUserData = sessionStorage.getItem('userData');
    const localExpiry = localStorage.getItem('tokenExpiry');
    const sessionExpiry = sessionStorage.getItem('tokenExpiry');
    
    // Check if either localStorage or sessionStorage has valid tokens
    const hasLocalAuth = localToken && localUserData && localExpiry && Date.now() < parseInt(localExpiry);
    const hasSessionAuth = sessionToken && sessionUserData && sessionExpiry && Date.now() < parseInt(sessionExpiry);
    
    return hasLocalAuth || hasSessionAuth;
  },

  // Get stored user data
  getStoredUser() {
    // Check localStorage first, then sessionStorage
    const localUserData = localStorage.getItem('userData');
    const localExpiry = localStorage.getItem('tokenExpiry');
    const sessionUserData = sessionStorage.getItem('userData');
    const sessionExpiry = sessionStorage.getItem('tokenExpiry');
    
    // Check localStorage validity
    if (localUserData && localExpiry && Date.now() < parseInt(localExpiry)) {
      return JSON.parse(localUserData);
    }
    
    // Check sessionStorage validity
    if (sessionUserData && sessionExpiry && Date.now() < parseInt(sessionExpiry)) {
      return JSON.parse(sessionUserData);
    }
    
    return null;
  },

  // Check email verification status
  async checkEmailVerification(email) {
    try {
      // This is a workaround - we can't directly check email verification without signing in
      // For now, we'll throw an error to indicate the user needs to verify their email
      throw new Error('Please verify your email by clicking the link in your inbox.');
    } catch (error) {
      throw error;
    }
  },

  // Resend email verification using Firebase's oobCode method
  async resendVerificationEmail(email) {
    try {
      // Firebase doesn't have a direct resend API for unauthenticated users
      // We need to use the auth endpoint directly
      const response = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:sendOobCode?key=${firebaseConfig.apiKey}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          requestType: 'VERIFY_EMAIL',
          email: email,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error?.message || 'Failed to send verification email');
      }

      return {
        success: true,
        message: 'Verification email has been resent. Please check your inbox (and spam folder).'
      };
    } catch (error) {
      console.error('Resend verification error:', error);
      
      // Handle specific Firebase errors
      if (error.message?.includes('too-many-requests')) {
        throw new Error('Too many requests. Please wait a few minutes before trying again. Check your spam folder for the previous email.');
      } else if (error.message?.includes('email-not-found')) {
        throw new Error('No account found with this email address.');
      } else if (error.message?.includes('invalid-email')) {
        throw new Error('Invalid email address.');
      } else {
        throw new Error('Failed to resend verification email. Please try again later.');
      }
    }
  },

  // Update user profile
  async updateProfile(profileData) {
    try {
      const user = auth.currentUser;
      if (!user) {
        throw new Error('No authenticated user found');
      }

      // Update Firebase Auth profile if displayName is provided
      if (profileData.displayName) {
        await updateProfile(user, { displayName: profileData.displayName });
      }

      // Get fresh ID token after profile update
      const idToken = await user.getIdToken();

      // Update profile in backend database
      const response = await api.put('/auth/profile', {
        profile: profileData
      }, {
        headers: {
          'Authorization': `Bearer ${idToken}`
        }
      });

      if (response.success) {
        // Update the correct storage location with new user data
        const localUserData = localStorage.getItem('userData');
        const sessionUserData = sessionStorage.getItem('userData');
        
        if (localUserData) {
          // User was using localStorage, update there
          localStorage.setItem('userData', JSON.stringify(response.data.user));
        } else if (sessionUserData) {
          // User was using sessionStorage, update there
          sessionStorage.setItem('userData', JSON.stringify(response.data.user));
        } else {
          // Fallback to localStorage
          localStorage.setItem('userData', JSON.stringify(response.data.user));
        }
        
        return {
          success: true,
          data: response.data.user
        };
      }
      
      throw new Error(response.data.message || 'Profile update failed');
    } catch (error) {
      console.error('Profile update error:', error.response?.data || error.message);
      throw error;
    }
  },

  // Get auth token
  async getAuthToken() {
    const user = auth.currentUser;
    if (user) {
      return await user.getIdToken();
    }
    
    // Check localStorage first, then sessionStorage
    const localToken = localStorage.getItem('authToken');
    const localExpiry = localStorage.getItem('tokenExpiry');
    const sessionToken = sessionStorage.getItem('authToken');
    const sessionExpiry = sessionStorage.getItem('tokenExpiry');
    
    // Return valid token from localStorage
    if (localToken && localExpiry && Date.now() < parseInt(localExpiry)) {
      return localToken;
    }
    
    // Return valid token from sessionStorage
    if (sessionToken && sessionExpiry && Date.now() < parseInt(sessionExpiry)) {
      return sessionToken;
    }
    
    return null;
  }
};

export default firebaseService;
