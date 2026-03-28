import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';

/* ── Inline icons — no lucide dependency needed ── */
const SuccessIcon = () => (
  <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
    <path d="M2 7.5l3 3 6.5-6" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);
const ErrorIcon = () => (
  <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
    <path d="M2.5 2.5l9 9M11.5 2.5l-9 9" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round"/>
  </svg>
);
const WarningIcon = () => (
  <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
    <path d="M7 1.5L13 12.5H1L7 1.5z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/>
    <line x1="7" y1="5.5" x2="7" y2="8.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
    <circle cx="7" cy="10.5" r="0.6" fill="currentColor"/>
  </svg>
);
const InfoIcon = () => (
  <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
    <circle cx="7" cy="7" r="5.5" stroke="currentColor" strokeWidth="1.5"/>
    <line x1="7" y1="6" x2="7" y2="10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
    <circle cx="7" cy="4.2" r="0.65" fill="currentColor"/>
  </svg>
);
const CloseIcon = () => (
  <svg width="10" height="10" viewBox="0 0 10 10" fill="none" aria-hidden="true">
    <path d="M1.5 1.5l7 7M8.5 1.5l-7 7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
  </svg>
);

const ICONS = {
  success: <SuccessIcon />,
  error:   <ErrorIcon />,
  warning: <WarningIcon />,
  info:    <InfoIcon />,
};

const TYPE_LABEL = {
  success: 'Success',
  error:   'Error',
  warning: 'Warning',
  info:    'Info',
};

/**
 * Toast
 *
 * Props:
 *   type       'success' | 'error' | 'warning' | 'info'
 *   message    string
 *   duration   ms — drives the CSS progress-bar animation (default 3000)
 *   onClose    () => void
 *   isVisible  boolean — controls AnimatePresence (default true)
 */
const Toast = ({
  type = 'info',
  message,
  duration = 3000,
  onClose,
  isVisible = true,
}) => (
  <AnimatePresence>
    {isVisible && (
      <motion.div
        initial={{ opacity: 0, x: 28, scale: 0.97 }}
        animate={{ opacity: 1, x: 0,  scale: 1 }}
        exit={  { opacity: 0, x: 28,  scale: 0.97 }}
        transition={{ duration: 0.18, ease: [0.4, 0, 0.2, 1] }}
        className={`toast toast--${type}`}
        style={{ '--toast-duration': `${duration}ms` }}
        role="alert"
        aria-live="polite"
        aria-atomic="true"
      >
        {/* Intent icon */}
        <span className={`toast__icon toast__icon--${type}`}>
          {ICONS[type] ?? ICONS.info}
        </span>

        {/* Copy */}
        <div className="toast__body">
          <span className="toast__type">{TYPE_LABEL[type] ?? type}</span>
          <span className="toast__message">{message}</span>
        </div>

        {/* Dismiss */}
        <button
          type="button"
          className="toast__close"
          onClick={() => onClose?.()}
          aria-label="Dismiss notification"
        >
          <CloseIcon />
        </button>
      </motion.div>
    )}
  </AnimatePresence>
);

export default Toast;