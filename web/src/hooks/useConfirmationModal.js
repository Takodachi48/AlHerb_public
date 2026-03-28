import { useState, useCallback } from 'react';

export const useConfirmationModal = () => {
  const [modalState, setModalState] = useState({
    isOpen: false,
    title: '',
    message: '',
    confirmText: 'Confirm',
    cancelText: 'Cancel',
    type: 'default',
    icon: null,
    onConfirm: null,
    loading: false,
  });

  const openModal = useCallback((config) => {
    setModalState({
      isOpen: true,
      title: config.title || 'Confirm Action',
      message: config.message || 'Are you sure you want to proceed?',
      confirmText: config.confirmText || 'Confirm',
      cancelText: config.cancelText || 'Cancel',
      type: config.type || 'default',
      icon: config.icon || null,
      onConfirm: config.onConfirm || null,
      loading: false,
    });
  }, []);

  const closeModal = useCallback(() => {
    setModalState(prev => ({ ...prev, isOpen: false }));
  }, []);

  const setLoading = useCallback((loading) => {
    setModalState(prev => ({ ...prev, loading }));
  }, []);

  const confirm = useCallback(() => {
    if (modalState.onConfirm) {
      modalState.onConfirm();
    }
  }, [modalState.onConfirm]);

  return {
    isOpen: modalState.isOpen,
    title: modalState.title,
    message: modalState.message,
    confirmText: modalState.confirmText,
    cancelText: modalState.cancelText,
    type: modalState.type,
    icon: modalState.icon,
    loading: modalState.loading,
    openModal,
    closeModal,
    setLoading,
    confirm,
  };
};
