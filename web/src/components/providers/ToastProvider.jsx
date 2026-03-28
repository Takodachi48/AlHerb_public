import React, { createContext, useContext, useState, useCallback } from 'react';
import Toast from '../common/Toast';
import { useAuth } from '../../hooks/useAuth';

export const ToastContext = createContext();

export const useToast = () => {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
};

export const ToastProvider = ({ children }) => {
  const [toasts, setToasts] = useState([]);

  const addToast = useCallback((message, type = 'info', duration = 3000) => {
    const id = Date.now() + Math.random();
    const newToast = { id, message, type, duration, isVisible: true };
    
    setToasts(prev => [...prev, newToast]);
    
    // Auto-dismiss after duration (if duration > 0)
    if (duration > 0) {
      setTimeout(() => {
        // Start exit animation
        setToasts(prev => prev.map(toast => 
          toast.id === id ? { ...toast, isVisible: false } : toast
        ));
        
        // Remove from DOM after animation completes
        setTimeout(() => {
          removeToast(id);
        }, 300);
      }, duration);
    }
    
    return id;
  }, []);

  const removeToast = useCallback((id, delay = 0) => {
    if (delay > 0) {
      setTimeout(() => {
        setToasts(prev => prev.filter(toast => toast.id !== id));
      }, delay);
    } else {
      setToasts(prev => prev.filter(toast => toast.id !== id));
    }
  }, []);

  const success = useCallback((message, duration) => {
    return addToast(message, 'success', duration);
  }, [addToast]);

  const error = useCallback((message, duration) => {
    return addToast(message, 'error', duration);
  }, [addToast]);

  const warning = useCallback((message, duration) => {
    return addToast(message, 'warning', duration);
  }, [addToast]);

  const info = useCallback((message, duration) => {
    return addToast(message, 'info', duration);
  }, [addToast]);

  const clear = useCallback(() => {
    setToasts([]);
  }, []);

  const value = {
    addToast,
    removeToast,
    success,
    error,
    warning,
    info,
    clear,
    toasts,
    dismissToast: (id) => {
      // Start exit animation
      setToasts(prev => prev.map(t => 
        t.id === id ? { ...t, isVisible: false } : t
      ));
      // Remove after animation
      setTimeout(() => removeToast(id), 300);
    }
  };

  return (
    <ToastContext.Provider value={value}>
      {children}
      <ToastContainer />
    </ToastContext.Provider>
  );
};

const ToastContainer = () => {
  const { toasts, dismissToast } = useToast();
  const { user } = useAuth() || {};
  const isAdmin = user?.role === 'admin';

  return (
    <div className="fixed top-4 right-4 z-[70] space-y-2">
      {toasts.map((toast) => (
        <Toast
          key={toast.id}
          type={toast.type}
          message={toast.message}
          duration={toast.duration}
          isVisible={toast.isVisible}
          onClose={() => dismissToast(toast.id)}
          isAdmin={isAdmin}
        />
      ))}
    </div>
  );
};

export default ToastProvider;
