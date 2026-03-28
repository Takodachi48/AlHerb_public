import React, { createContext, useContext, useState, useCallback } from 'react';
import ConfirmationModal from '../modals/ConfirmationModal';

const ConfirmationContext = createContext();

export const useConfirmation = () => {
  const context = useContext(ConfirmationContext);
  if (!context) {
    throw new Error('useConfirmation must be used within a ConfirmationProvider');
  }
  return context;
};

export const ConfirmationProvider = ({ children }) => {
  const [modalState, setModalState] = useState({
    isOpen: false,
    title: '',
    message: '',
    confirmText: 'Confirm',
    cancelText: 'Cancel',
    type: 'default',
    icon: null,
    loading: false,
    resolve: null,
    reject: null,
  });

  const openModal = useCallback((config) => {
    return new Promise((resolve, reject) => {
      setModalState({
        isOpen: true,
        title: config.title || 'Confirm Action',
        message: config.message || 'Are you sure you want to proceed?',
        confirmText: config.confirmText || 'Confirm',
        cancelText: config.cancelText || 'Cancel',
        type: config.type || 'default',
        icon: config.icon || null,
        loading: false,
        resolve,
        reject,
        onConfirm: config.onConfirm,
      });
    });
  }, []);

  const closeModal = useCallback(() => {
    const { resolve, reject } = modalState;
    setModalState(prev => ({ ...prev, isOpen: false }));
    if (resolve) resolve(false);
  }, [modalState.resolve]);

  const confirm = useCallback(async () => {
    const { onConfirm, resolve, reject } = modalState;
    
    try {
      setModalState(prev => ({ ...prev, loading: true }));
      
      if (onConfirm) {
        const result = await onConfirm();
        setModalState(prev => ({ ...prev, loading: false, isOpen: false }));
        if (resolve) resolve(result);
      } else {
        setModalState(prev => ({ ...prev, loading: false, isOpen: false }));
        if (resolve) resolve(true);
      }
    } catch (error) {
      setModalState(prev => ({ ...prev, loading: false, isOpen: false }));
      if (reject) reject(error);
    }
  }, [modalState.onConfirm, modalState.resolve, modalState.reject]);

  const value = {
    openModal,
    closeModal,
    confirm,
    isOpen: modalState.isOpen,
  };

  return (
    <ConfirmationContext.Provider value={value}>
      {children}
      <ConfirmationModal
        isOpen={modalState.isOpen}
        onClose={closeModal}
        onConfirm={confirm}
        title={modalState.title}
        message={modalState.message}
        confirmText={modalState.confirmText}
        cancelText={modalState.cancelText}
        type={modalState.type}
        icon={modalState.icon}
        loading={modalState.loading}
      />
    </ConfirmationContext.Provider>
  );
};

export default ConfirmationProvider;
