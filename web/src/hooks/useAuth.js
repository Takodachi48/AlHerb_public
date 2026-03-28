import { useContext, useEffect } from 'react';
import { AuthContext } from '../context/AuthContext';

export const useAuth = () => {
  const context = useContext(AuthContext);
  
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }

  const { user, loading, login, logout, register, updateProfile, signInWithGoogle, signInWithGoogleIdToken } = context;

  // Auto-logout on token expiration
  useEffect(() => {
    if (user) {
      const tokenExpiry = localStorage.getItem('tokenExpiry');
      if (tokenExpiry && new Date(tokenExpiry) <= new Date()) {
        logout();
      }
    }
  }, [user, logout]);

  return {
    user,
    loading,
    isAuthenticated: !!user,
    login,
    logout,
    register,
    updateProfile,
    signInWithGoogle,
    signInWithGoogleIdToken,
  };
};
