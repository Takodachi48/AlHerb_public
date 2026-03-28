import api from './api';
import {
  EmailAuthProvider,
  getAuth,
  reauthenticateWithCredential,
  updatePassword as updateFirebasePassword,
} from 'firebase/auth';

const extractErrorMessage = (error, fallback = 'Request failed') => {
  const payload = error?.response?.data || error;

  const humanizeValidationMessage = (message = '') => {
    const raw = String(message || '').trim();
    if (!raw) return '';

    const normalized = raw
      .replace(/^newPassword\s+/i, 'New password ')
      .replace(/^currentPassword\s+/i, 'Current password ')
      .replace(/\s+length must be at least\s+/i, ' must be at least ')
      .replace(/\s+characters long$/i, ' characters.');

    if (normalized !== raw) return normalized;

    return raw.charAt(0).toUpperCase() + raw.slice(1);
  };

  if (typeof payload?.details === 'object' && payload.details !== null) {
    const firstDetail = Object.values(payload.details).find(Boolean);
    if (firstDetail) return humanizeValidationMessage(firstDetail);
  }
  return humanizeValidationMessage(payload?.message || payload?.error || error?.message || fallback);
};

export const authService = {
  // Login with Firebase token
  async login(idToken) {
    const response = await api.post('/auth/login', { idToken });
    return response.data;
  },

  // Register new user
  async register(userData) {
    const response = await api.post('/auth/register', userData);
    return response.data;
  },

  // Logout user
  async logout() {
    const response = await api.post('/auth/logout');
    return response.data;
  },

  // Refresh token
  async refreshToken(idToken) {
    const response = await api.post('/auth/refresh', { idToken });
    return response.data;
  },

  // Send email verification
  async sendEmailVerification() {
    const response = await api.post('/auth/verify-email');
    return response.data;
  },

  // Reset password
  async resetPassword(email) {
    const response = await api.post('/auth/reset-password', { email });
    return response.data;
  },

  // Change password
  async changePassword(currentPassword, newPassword) {
    const auth = getAuth();
    const firebaseUser = auth.currentUser;

    if (firebaseUser?.email) {
      try {
        const credential = EmailAuthProvider.credential(firebaseUser.email, currentPassword);
        await reauthenticateWithCredential(firebaseUser, credential);
        await updateFirebasePassword(firebaseUser, newPassword);
        return { success: true };
      } catch (error) {
        const code = error?.code;
        if (code === 'auth/wrong-password' || code === 'auth/invalid-credential') {
          throw new Error('Current password is incorrect.');
        }
        if (code === 'auth/weak-password') {
          throw new Error('New password is too weak.');
        }
        if (code === 'auth/requires-recent-login') {
          throw new Error('Please sign in again and retry the password change.');
        }
        // Fall through to server flow for any unexpected Firebase error.
      }
    }

    try {
      const response = await api.patch('/users/change-password', { currentPassword, newPassword });
      return response?.data || response;
    } catch (error) {
      const firstMessage = extractErrorMessage(error, 'Failed to change password');
      throw new Error(firstMessage);
    }
  },

  // Verify token
  async verifyToken(token) {
    const response = await api.post('/auth/verify', { token });
    return response.data;
  },
};
