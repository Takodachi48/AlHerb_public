import React, { createContext, useContext, useReducer, useEffect } from 'react';
import firebaseService from '../services/firebaseService';

// Initial state
// Helper to get initial state from storage
const getInitialAuthState = () => {
  const localUserData = localStorage.getItem('userData');
  const localExpiry = localStorage.getItem('tokenExpiry');
  const sessionUserData = sessionStorage.getItem('userData');
  const sessionExpiry = sessionStorage.getItem('tokenExpiry');

  const hasLocalAuth = localUserData && localExpiry && Date.now() < parseInt(localExpiry);
  const hasSessionAuth = sessionUserData && sessionExpiry && Date.now() < parseInt(sessionExpiry);

  if (hasLocalAuth) {
    return {
      user: JSON.parse(localUserData),
      loading: false,
      error: null,
    };
  }

  if (hasSessionAuth) {
    return {
      user: JSON.parse(sessionUserData),
      loading: false,
      error: null,
    };
  }

  return {
    user: null,
    loading: true,
    error: null,
  };
};

const initialState = getInitialAuthState();


// Action types
const AUTH_ACTIONS = {
  LOGIN_START: 'LOGIN_START',
  LOGIN_SUCCESS: 'LOGIN_SUCCESS',
  LOGIN_FAILURE: 'LOGIN_FAILURE',
  LOGOUT: 'LOGOUT',
  REGISTER_START: 'REGISTER_START',
  REGISTER_SUCCESS: 'REGISTER_SUCCESS',
  REGISTER_FAILURE: 'REGISTER_FAILURE',
  UPDATE_PROFILE_START: 'UPDATE_PROFILE_START',
  UPDATE_PROFILE_SUCCESS: 'UPDATE_PROFILE_SUCCESS',
  UPDATE_PROFILE_FAILURE: 'UPDATE_PROFILE_FAILURE',
  CLEAR_ERROR: 'CLEAR_ERROR',
  SET_LOADING: 'SET_LOADING',
};

// Reducer
const authReducer = (state, action) => {
  switch (action.type) {
    case AUTH_ACTIONS.LOGIN_START:
    case AUTH_ACTIONS.REGISTER_START:
    case AUTH_ACTIONS.UPDATE_PROFILE_START:
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

    case AUTH_ACTIONS.UPDATE_PROFILE_SUCCESS:
      return {
        ...state,
        user: { ...state.user, ...action.payload },
        loading: false,
        error: null,
      };

    case AUTH_ACTIONS.LOGIN_FAILURE:
    case AUTH_ACTIONS.REGISTER_FAILURE:
    case AUTH_ACTIONS.UPDATE_PROFILE_FAILURE:
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

  // Check for existing session on mount
  useEffect(() => {
    const initAuth = () => {
      // Check if user is already authenticated
      if (firebaseService.isAuthenticated()) {
        const userData = firebaseService.getStoredUser();
        dispatch({
          type: AUTH_ACTIONS.LOGIN_SUCCESS,
          payload: { user: userData },
        });
      }

      dispatch({ type: AUTH_ACTIONS.SET_LOADING, payload: false });
    };

    initAuth();
  }, []);

  // Login function
  const login = async (email, password, rememberMe = false, captchaToken = '') => {
    dispatch({ type: AUTH_ACTIONS.LOGIN_START });

    try {
      const result = await firebaseService.signIn(email, password, rememberMe, captchaToken);

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
      // Don't dispatch LOGIN_FAILURE as it might cause unwanted state changes
      // dispatch({
      //   type: AUTH_ACTIONS.LOGIN_FAILURE,
      //   payload: errorMessage,
      // });
      // Re-throw the error so the login page can catch it
      throw error;
    }
  };

  // Register function
  const register = async (email, password, additionalData = {}, captchaToken = '') => {
    dispatch({ type: AUTH_ACTIONS.REGISTER_START });

    try {
      const result = await firebaseService.signUp(
        email,
        password,
        additionalData.displayName,
        captchaToken
      );

      if (result.success) {
        if (result.requiresVerification) {
          // Don't log in user, return verification required
          dispatch({ type: AUTH_ACTIONS.CLEAR_ERROR });
          dispatch({ type: AUTH_ACTIONS.SET_LOADING, payload: false });
          return {
            success: true,
            requiresVerification: true,
            message: result.message,
            email: result.email
          };
        } else {
          // Normal registration flow (for cases where verification isn't required)
          dispatch({
            type: AUTH_ACTIONS.REGISTER_SUCCESS,
            payload: { user: result.user },
          });
          return { success: true, role: result.role };
        }
      }

      throw new Error('Registration failed');
    } catch (error) {
      const errorMessage = error.message || 'Registration failed';
      dispatch({
        type: AUTH_ACTIONS.REGISTER_FAILURE,
        payload: errorMessage,
      });
      return { success: false, error: errorMessage };
    }
  };

  // Google Sign In function
  const signInWithGoogle = async (rememberMe = false, captchaToken = '') => {
    try {
      const result = await firebaseService.signInWithGoogle(rememberMe, captchaToken);

      // Set loading to true only after Firebase interaction completes
      dispatch({ type: AUTH_ACTIONS.LOGIN_START });

      if (result.success) {
        dispatch({
          type: AUTH_ACTIONS.LOGIN_SUCCESS,
          payload: { user: result.user },
        });

        return { success: true, role: result.role };
      }

      throw new Error('Google sign in failed');
    } catch (error) {
      const errorMessage = error.message || 'Google sign in failed';
      dispatch({
        type: AUTH_ACTIONS.LOGIN_FAILURE,
        payload: errorMessage,
      });
      return { success: false, error: errorMessage };
    }
  };

  const signInWithGoogleIdToken = async (googleIdToken, rememberMe = false, captchaToken = '') => {
    try {
      const result = await firebaseService.signInWithGoogleIdToken(googleIdToken, rememberMe, captchaToken);

      dispatch({ type: AUTH_ACTIONS.LOGIN_START });

      if (result.success) {
        dispatch({
          type: AUTH_ACTIONS.LOGIN_SUCCESS,
          payload: { user: result.user },
        });
        return { success: true, role: result.role };
      }

      throw new Error('Google sign in failed');
    } catch (error) {
      const errorMessage = error.message || 'Google sign in failed';
      dispatch({
        type: AUTH_ACTIONS.LOGIN_FAILURE,
        payload: errorMessage,
      });
      return { success: false, error: errorMessage };
    }
  };

  // Logout function
  const logout = async () => {
    try {
      await firebaseService.signOut();
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      dispatch({ type: AUTH_ACTIONS.LOGOUT });
    }
  };

  // Update profile function
  const updateProfile = async (profileData) => {
    dispatch({ type: AUTH_ACTIONS.UPDATE_PROFILE_START });

    try {
      const response = await firebaseService.updateProfile(profileData);

      if (response.success) {
        const updatedUser = response.data;

        // Update the correct storage location with new user data
        const localUserData = localStorage.getItem('userData');
        const sessionUserData = sessionStorage.getItem('userData');

        if (localUserData) {
          // User was using localStorage, update there
          localStorage.setItem('userData', JSON.stringify(updatedUser));
        } else if (sessionUserData) {
          // User was using sessionStorage, update there
          sessionStorage.setItem('userData', JSON.stringify(updatedUser));
        } else {
          // Fallback to localStorage
          localStorage.setItem('userData', JSON.stringify(updatedUser));
        }

        dispatch({
          type: AUTH_ACTIONS.UPDATE_PROFILE_SUCCESS,
          payload: updatedUser,
        });

        return { success: true };
      } else {
        throw new Error(response.message || 'Profile update failed');
      }
    } catch (error) {
      const errorMessage = error.response?.data?.message || error.message || 'Profile update failed';
      dispatch({
        type: AUTH_ACTIONS.UPDATE_PROFILE_FAILURE,
        payload: errorMessage,
      });
      return { success: false, error: errorMessage };
    }
  };

  // Clear error
  const clearError = () => {
    dispatch({ type: AUTH_ACTIONS.CLEAR_ERROR });
  };

  const value = {
    ...state,
    login,
    register,
    signInWithGoogle,
    signInWithGoogleIdToken,
    logout,
    updateProfile,
    clearError,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

// Custom hook to use auth context
export const useAuthContext = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuthContext must be used within an AuthProvider');
  }
  return context;
};

export { AuthContext };
export default AuthContext;
