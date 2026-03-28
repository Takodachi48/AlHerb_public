import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import Button from '../../components/common/Button';
import firebaseService from '../../services/firebaseService';
import { useAuth } from '../../hooks/useAuth';

const VerifyEmailPage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [resendLoading, setResendLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState('');
  const [statusType, setStatusType] = useState('info');

  useEffect(() => {
    // If user is authenticated and email is verified, redirect to home
    if (user && user.emailVerified) {
      navigate('/home');
      return;
    }

    // If user is authenticated but email not verified, show success message
    if (user && !user.emailVerified) {
      if (location.state?.message) {
        setStatusMessage(location.state.message);
      } else {
        setStatusMessage('Registration successful! Please check your email to verify your account.');
      }
      setStatusType('success');
    }
  }, [user, navigate, location.state?.message]);

  const handleTrySignIn = async () => {
    setLoading(true);
    setStatusMessage('');

    try {
      // Navigate to login page with a message
      navigate('/auth?mode=login', {
        state: {
          message: 'Your email has been verified! Please sign in to continue.'
        }
      });
    } catch (error) {
      setStatusType('error');
      setStatusMessage('Unable to proceed. Please try signing in manually.');
    } finally {
      setLoading(false);
    }
  };

  const handleResendVerification = async () => {
    setResendLoading(true);
    setStatusMessage('');

    try {
      const result = await firebaseService.resendVerificationEmail(location.state?.email);
      if (result.success) {
        setStatusType('success');
        setStatusMessage(result.message);
      }
    } catch (error) {
      setStatusType('error');
      setStatusMessage(error.message || 'Failed to resend verification email. Please try again.');
    } finally {
      setResendLoading(false);
    }
  };

  const handleGoToLogin = () => {
    navigate('/auth?mode=login');
  };

  return (
    <div className="typography-auth min-h-screen flex items-center justify-center py-6 px-4 sm:px-6 lg:px-8 relative"
      style={{
        backgroundImage: "url('/herb_background.jpg')",
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat'
      }}>
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm"></div>
      <div className="max-w-md w-full space-y-4 relative z-10">
        <div className="bg-surface-primary rounded-lg shadow-md p-5">
          <div className="mb-3">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => navigate('/auth?mode=login')}
              className="inline-flex items-center text-sm text-tertiary hover:text-brand transition-colors duration-200 p-0 min-h-0 h-auto"
            >
              <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              <span className="leading-none">Back to Login</span>
            </Button>
          </div>

          <div className="text-center">
            <div className="mx-auto flex items-center justify-center h-16 w-16 rounded-full bg-interactive-success/10 mb-4">
              <svg className="h-8 w-8 text-intent-success" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
            </div>

            <h2 className="text-center text-2xl font-bold font-display text-primary mb-2">
              Check your email
            </h2>

            <p className="text-center text-sm font-sans text-tertiary mb-6">
              We've sent a verification email to <strong>{location.state?.email || 'your email address'}</strong>.
              Please check your inbox and click the verification link to activate your account.
            </p>

            <div className="bg-interactive-brand-primary/10 border border-brand/30 rounded-md p-3 mb-6">
              <p className="text-xs font-accent text-brand">
                <strong>Important:</strong> If you don't see the email within 5 minutes, check your spam folder.
                The verification link will expire in 24 hours.
              </p>
            </div>

            {statusMessage && (
              <div
                className={`rounded-md p-3 mb-4 text-sm font-sans ${
                  statusType === 'error'
                    ? 'bg-intent-danger/10 border border-intent-danger/30 text-intent-danger'
                    : 'bg-intent-success/10 border border-intent-success/30 text-intent-success'
                }`}
              >
                {statusMessage}
              </div>
            )}

            <div className="space-y-3">
              <Button
                type="button"
                variant="primary"
                size="md"
                className="w-full"
                onClick={handleTrySignIn}
                loading={loading}
              >
                I've Verified My Email - Let Me Sign In
              </Button>

              <Button
                type="button"
                variant="outline"
                size="md"
                className="w-full"
                onClick={handleResendVerification}
                loading={resendLoading}
              >
                Resend Verification Email
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default VerifyEmailPage;
