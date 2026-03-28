import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';

/* ── Intent icons ── */
const DefaultIcon = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <circle cx="12" cy="12" r="9" />
    <line x1="12" y1="8" x2="12" y2="12" />
    <circle cx="12" cy="16" r="0.7" fill="currentColor" />
  </svg>
);
const DangerIcon = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
    <line x1="12" y1="9" x2="12" y2="13" />
    <circle cx="12" cy="17" r="0.7" fill="currentColor" />
  </svg>
);
const WarningIcon = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <circle cx="12" cy="12" r="9" />
    <line x1="12" y1="8" x2="12" y2="13" />
    <circle cx="12" cy="16.5" r="0.7" fill="currentColor" />
  </svg>
);
const SuccessIcon = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <circle cx="12" cy="12" r="9" />
    <path d="M8.5 12.5l2.5 2.5 4.5-5" />
  </svg>
);
const SpinnerIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true" className="spinner" style={{ display: 'inline-block' }}>
    <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeOpacity="0.25" />
    <path d="M12 2a10 10 0 0110 10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
  </svg>
);
const CloseIcon = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
    <path d="M6 18L18 6M6 6l12 12" />
  </svg>
);

const ICONS = {
  default: <DefaultIcon />,
  danger: <DangerIcon />,
  warning: <WarningIcon />,
  success: <SuccessIcon />,
};

/* Confirm button variant per intent */
const CONFIRM_VARIANT = {
  default: 'btn--secondary',
  danger: 'btn--danger',
  warning: 'btn--warning',
  success: 'btn--success',
};

/**
 * ConfirmationModal
 *
 * Props:
 *   isOpen       boolean
 *   onClose      () => void
 *   onConfirm    () => void
 *   title        string
 *   message      string
 *   confirmText  string
 *   cancelText   string
 *   type         'default' | 'danger' | 'warning' | 'success'
 *   icon         ReactNode (override default intent icon)
 *   loading      boolean
 *   children     ReactNode (extra content between message and actions)
 */
const ConfirmationModal = ({
  isOpen,
  onClose,
  onConfirm,
  title = 'Confirm Action',
  message = 'Are you sure you want to proceed?',
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  type = 'default',
  icon = null,
  loading = false,
  children = null,
}) => {
  const handleConfirm = () => { if (!loading) onConfirm(); };
  const handleClose = () => { if (!loading) onClose(); };

  const intent = ['default', 'danger', 'warning', 'success'].includes(type) ? type : 'default';

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* ── Backdrop ── */}
          <motion.div
            key="conf-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            className="modal-backdrop"
            onClick={handleClose}
            aria-hidden="true"
          />

          {/* ── Panel ── */}
          <motion.div
            key="conf-panel"
            initial={{ opacity: 0, scale: 0.96, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 12 }}
            transition={{ duration: 0.2, ease: [0.23, 1, 0.32, 1] }}
            style={{
              position: 'fixed', inset: 0, zIndex: 10000,
              display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              className={`modal-panel confirm-modal confirm-modal--${intent}`}
              role="dialog"
              aria-modal="true"
              aria-labelledby="confirm-title"
            >
              <div className="modal-body">

                {/* Icon */}
                <div className={`confirm-modal__icon-wrap`}>
                  {icon ?? ICONS[intent]}
                </div>

                {/* Eyebrow + Title */}
                <p className="modal-eyebrow">{intent === 'default' ? 'Action' : intent}</p>
                <h2 id="confirm-title" className="confirm-modal__title">{title}</h2>

                {/* Message */}
                <p className="confirm-modal__message">{message}</p>

                {/* Optional extra content */}
                {children && (
                  <div style={{ marginBottom: '20px' }}>
                    {children}
                  </div>
                )}

                {/* Actions */}
                <div className="modal-footer" style={{ padding: 0 }}>
                  <button
                    type="button"
                    className="btn btn--neutral"
                    onClick={handleClose}
                    disabled={loading}
                  >
                    {cancelText}
                  </button>
                  <button
                    type="button"
                    className={`btn ${CONFIRM_VARIANT[intent]}`}
                    onClick={handleConfirm}
                    disabled={loading}
                    style={{ gap: '8px' }}
                  >
                    {loading && <span className="spinner" style={{ width: 13, height: 13 }} aria-hidden="true" />}
                    {confirmText}
                  </button>
                </div>

              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};

export default ConfirmationModal;