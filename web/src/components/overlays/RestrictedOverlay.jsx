import React from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';

const LockIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
    <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
  </svg>
);

/**
 * RestrictedOverlay
 *
 * Renders nothing when the user is authenticated.
 * When unauthenticated, overlays its parent (parent must be position:relative)
 * with a frosted-glass panel linking to /login and /register.
 *
 * All styles from .restricted-overlay* in Components.css.
 */
const RestrictedOverlay = () => {
  const { user } = useAuth();

  if (user) return null;

  return (
    <div className="restricted-overlay" role="dialog" aria-modal="true" aria-label="Login required">

      <div className="restricted-overlay__panel">

        {/* Icon badge */}
        <div className="restricted-overlay__icon-wrap" aria-hidden="true">
          <LockIcon />
        </div>

        {/* Copy */}
        <p className="restricted-overlay__eyebrow">Authentication required</p>

        <h2 className="restricted-overlay__title">Login Required</h2>

        <p className="restricted-overlay__body">
          You need an account to access this feature. Login or create a free account to continue.
        </p>

        {/* CTA buttons — reuse .btn classes from Components.css */}
        <div className="restricted-overlay__actions">
          <Link to="/login">
            <button type="button" className="btn btn--secondary">
              Login
            </button>
          </Link>

          <Link to="/register">
            <button type="button" className="btn btn--neutral">
              Register
            </button>
          </Link>
        </div>

      </div>

    </div>
  );
};

export default RestrictedOverlay;