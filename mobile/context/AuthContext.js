import React, { createContext, useContext, useReducer, useEffect, useRef, useState } from 'react';
import authService from '../services/authService';
import { auth } from '../services/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import apiClient from '../services/apiClient';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { debugLog } from '../utils/logger';
import { API_ENDPOINTS } from '../shared/constants/api-endpoints';
import Constants from 'expo-constants';
import TurnstileModal from '../components/auth/TurnstileModal';

// Initial state
const initialState = {
  user: null,
  loading: true,
  error: null,
  hasSeenOnboarding: false,
};

// Action types
const AUTH_ACTIONS = {
  LOGIN_START: 'LOGIN_START',
  LOGIN_SUCCESS: 'LOGIN_SUCCESS',
  LOGIN_FAILURE: 'LOGIN_FAILURE',
  LOGOUT: 'LOGOUT',
  REGISTER_START: 'REGISTER_START',
  REGISTER_SUCCESS: 'REGISTER_SUCCESS',
  REGISTER_FAILURE: 'REGISTER_FAILURE',
  CLEAR_ERROR: 'CLEAR_ERROR',
  SET_LOADING: 'SET_LOADING',
  SET_ONBOARDING_SEEN: 'SET_ONBOARDING_SEEN',
};

// Reducer
const authReducer = (state, action) => {
  switch (action.type) {
    case AUTH_ACTIONS.SET_ONBOARDING_SEEN:
      return {
        ...state,
        hasSeenOnboarding: action.payload,
      };
    case AUTH_ACTIONS.LOGIN_START:
    case AUTH_ACTIONS.REGISTER_START:
      return {
        ...state,
        loading: true,
        error: null,
      };

    case AUTH_ACTIONS.LOGIN_SUCCESS:
    case AUTH_ACTIONS.REGISTER_SUCCESS:
      return {
        ...state,
        user: action.payload.user,
        loading: false,
        error: null,
      };

    case AUTH_ACTIONS.LOGIN_FAILURE:
    case AUTH_ACTIONS.REGISTER_FAILURE:
      return {
        ...state,
        loading: false,
        error: action.payload,
      };

    case AUTH_ACTIONS.LOGOUT:
      return {
        ...state,
        user: null,
        loading: false,
        error: null,
      };

    case AUTH_ACTIONS.CLEAR_ERROR:
      return {
        ...state,
        error: null,
      };

    case AUTH_ACTIONS.SET_LOADING:
      return {
        ...state,
        loading: action.payload,
      };

    default:
      return state;
  }
};

// Create context
const AuthContext = createContext();

// AuthProvider component
export const AuthProvider = ({ children }) => {
  const [state, dispatch] = useReducer(authReducer, initialState);
  const mountedRef = useRef(true);
  const initRef = useRef(true);
  const [captchaVisible, setCaptchaVisible] = useState(false);
  const captchaResolverRef = useRef(null);
  const captchaTokenRef = useRef(null);

  useEffect(() => {
    return () => {
      mountedRef.current = false;
      initRef.current = false;
    };
  }, []);

  const getTurnstileSiteKey = () => {
    const extraKey = String(Constants.expoConfig?.extra?.env?.EXPO_PUBLIC_TURNSTILE_SITE_KEY || '').trim();
    return extraKey || String(process.env.EXPO_PUBLIC_TURNSTILE_SITE_KEY || '').trim();
  };

  const getTurnstileBaseUrl = () => {
    const extraUrl = String(Constants.expoConfig?.extra?.env?.EXPO_PUBLIC_TURNSTILE_BASE_URL || '').trim();
    return extraUrl || String(process.env.EXPO_PUBLIC_TURNSTILE_BASE_URL || '').trim();
  };
  const ensureCaptchaToken = async () => {
    if (captchaTokenRef.current) {
      return captchaTokenRef.current;
    }

    const siteKey = getTurnstileSiteKey();
    if (!siteKey) {
      throw new Error('Turnstile site key is missing. Set EXPO_PUBLIC_TURNSTILE_SITE_KEY.');
    }

    return new Promise((resolve, reject) => {
      captchaResolverRef.current = { resolve, reject };
      setCaptchaVisible(true);
    });
  };

  const handleCaptchaSuccess = (token) => {
    captchaTokenRef.current = token;
    setCaptchaVisible(false);
    if (captchaResolverRef.current?.resolve) {
      captchaResolverRef.current.resolve(token);
      captchaResolverRef.current = null;
    }
  };

  const handleCaptchaCancel = () => {
    setCaptchaVisible(false);
    if (captchaResolverRef.current?.reject) {
      captchaResolverRef.current.reject(new Error('Captcha cancelled'));
      captchaResolverRef.current = null;
    }
  };

  // Listen to Firebase auth state as the single source of truth
  useEffect(() => {
    const loadOnboardingStatus = async () => {
      try {
        const value = await AsyncStorage.getItem('@has_seen_onboarding');
        if (value !== null) {
          dispatch({ type: AUTH_ACTIONS.SET_ONBOARDING_SEEN, payload: JSON.parse(value) });
        }
      } catch (e) {
        console.error('Failed to load onboarding status:', e);
      }
    };
    loadOnboardingStatus();

    let timeoutId;

    // Safety timeout: If auth check takes too long (e.g., 5s), stop loading
    timeoutId = setTimeout(() => {
      if (mountedRef.current && state.loading) {
        console.warn('⚠️ Auth check timed out - forcing loading: false');
        dispatch({ type: AUTH_ACTIONS.SET_LOADING, payload: false });
      }
    }, 5000);

    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (!mountedRef.current) return;

      try {
        if (firebaseUser) {
          // Firebase says user is signed in — check AsyncStorage for cached profile
          try {
            const cachedUser = await authService.getCurrentUser();
            if (cachedUser && mountedRef.current) {
              dispatch({
                type: AUTH_ACTIONS.LOGIN_SUCCESS,
                payload: { user: cachedUser },
              });
              
              // Refresh profile from server in background
              refreshUser();
            } else if (mountedRef.current) {
              // Firebase user exists but no cached data — sign out to force fresh login
              debugLog('⚠️ Firebase user but no cached data — forcing re-login');
              dispatch({ type: AUTH_ACTIONS.LOGOUT });
            }
          } catch (error) {
            console.error('Error checking cached user:', error);
            if (mountedRef.current) {
              dispatch({ type: AUTH_ACTIONS.LOGOUT });
            }
          }
        } else {
          // Firebase says no user — clear everything and show login
          debugLog('🔒 Firebase: no user — showing login screen');
          if (mountedRef.current) {
            dispatch({ type: AUTH_ACTIONS.LOGOUT });
          }
        }
      } catch (err) {
        console.error('Unexpected auth check error:', err);
        if (mountedRef.current) {
          dispatch({ type: AUTH_ACTIONS.LOGOUT });
        }
      } finally {
        if (mountedRef.current) {
          // Clear timeout since we finished
          clearTimeout(timeoutId);
        }
      }
    });

    return () => {
      unsubscribe();
      clearTimeout(timeoutId);
    };
  }, []);

  // Refresh user profile from backend
  const refreshUser = async () => {
    try {
      const response = await apiClient.get(API_ENDPOINTS.USERS.PROFILE);
      const payload = response?.data?.data || response?.data || null;
      if (payload && typeof payload === 'object') {
        await updateUser(payload);
        debugLog('🔄 User profile refreshed from server');
      }
    } catch (error) {
      debugLog('Failed to refresh user profile:', error.message);
    }
  };

  // Login function
  const login = async (email, password, rememberMe = false) => {
    dispatch({ type: AUTH_ACTIONS.LOGIN_START });

    try {
      const captchaToken = await ensureCaptchaToken();
      const result = await authService.login(email, password, rememberMe, captchaToken);

      if (result.success) {
        dispatch({
          type: AUTH_ACTIONS.LOGIN_SUCCESS,
          payload: { user: result.user },
        });

        return { success: true, role: result.role };
      }

      throw new Error('Login failed');
    } catch (error) {
      const errorMessage = error.message || 'Login failed';
      dispatch({
        type: AUTH_ACTIONS.LOGIN_FAILURE,
        payload: errorMessage,
      });
      throw error;
    }
  };

  // Register function
  const register = async (email, password, displayName) => {
    dispatch({ type: AUTH_ACTIONS.REGISTER_START });

    try {
      const captchaToken = await ensureCaptchaToken();
      const result = await authService.register(email, password, displayName, captchaToken);

      if (result.success) {
        dispatch({
          type: AUTH_ACTIONS.REGISTER_SUCCESS,
          payload: { user: result.user },
        });
        return { success: true, role: result.role };
      }

      throw new Error('Registration failed');
    } catch (error) {
      const errorMessage = error.message || 'Registration failed';
      dispatch({
        type: AUTH_ACTIONS.REGISTER_FAILURE,
        payload: errorMessage,
      });
      throw error;
    }
  };

  // Google Login function
  const googleLogin = async (idToken) => {
    dispatch({ type: AUTH_ACTIONS.LOGIN_START });

    try {
      const captchaToken = await ensureCaptchaToken();
      const result = await authService.googleSignIn(idToken, captchaToken);

      if (result.success) {
        dispatch({
          type: AUTH_ACTIONS.LOGIN_SUCCESS,
          payload: { user: result.user },
        });

        return { success: true, role: result.role };
      }

      throw new Error('Google sign-in failed');
    } catch (error) {
      const errorMessage = error.message || 'Google sign-in failed';
      dispatch({
        type: AUTH_ACTIONS.LOGIN_FAILURE,
        payload: errorMessage,
      });
      throw error;
    }
  };

  // Logout function
  const logout = async () => {
    try {
      await authService.logout();
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      dispatch({ type: AUTH_ACTIONS.LOGOUT });
    }
  };

  // Set authenticated user directly (used after email verification)
  const setAuthenticated = (userData) => {
    dispatch({
      type: AUTH_ACTIONS.LOGIN_SUCCESS,
      payload: { user: userData },
    });
  };

  // Clear error
  const clearError = () => {
    dispatch({ type: AUTH_ACTIONS.CLEAR_ERROR });
  };

  const setOnboardingSeen = async (value) => {
    try {
      await AsyncStorage.setItem('@has_seen_onboarding', JSON.stringify(value));
      dispatch({ type: AUTH_ACTIONS.SET_ONBOARDING_SEEN, payload: value });
    } catch (e) {
      console.error('Failed to save onboarding status:', e);
    }
  };

  // Update user profile
  const updateUser = async (updatedData) => {
    try {
      // 1. Update AsyncStorage
      await authService.updateUserData(updatedData);

      // 2. Update Context state
      dispatch({
        type: AUTH_ACTIONS.LOGIN_SUCCESS,
        payload: { user: { ...state.user, ...updatedData } },
      });
      debugLog('✅ User context updated');
    } catch (error) {
      console.error('Error in updateUser context:', error);
    }
  };

  const value = {
    ...state,
    login,
    googleLogin,
    register,
    logout,
    setAuthenticated,
    clearError,
    updateUser,
    refreshUser,
    setOnboardingSeen,
    ensureCaptchaToken,
  };

  return (
    <AuthContext.Provider value={value}>
      <TurnstileModal
        visible={captchaVisible}
        siteKey={getTurnstileSiteKey()}
        baseUrl={getTurnstileBaseUrl()}
        onSuccess={handleCaptchaSuccess}
        onCancel={handleCaptchaCancel}
      />
      {children}
    </AuthContext.Provider>
  );
};

// Custom hook to use auth context
export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export { AuthContext };
export default AuthContext;

