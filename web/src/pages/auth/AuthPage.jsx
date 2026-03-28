import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { useToast } from '../../hooks/useToast';
import Button from '../../components/common/Button';
import Checkbox from '../../components/common/Checkbox';
import Input from '../../components/common/Input';
import siteAssetService from '../../services/siteAssetService';

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const consumedRouteMessages = new Set();
const GOOGLE_GSI_SCRIPT_ID = 'google-gsi-client-script';

const AuthPage = () => {
  const { success, error: showError } = useToast();
  const { login, register, signInWithGoogle, signInWithGoogleIdToken } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();

  const mode = useMemo(() => (
    searchParams.get('mode') === 'register' ? 'register' : 'login'
  ), [searchParams]);
  const isRegister = mode === 'register';

  const [loginForm, setLoginForm] = useState({
    email: '',
    password: '',
    rememberMe: false,
  });
  const [registerForm, setRegisterForm] = useState({
    email: '',
    password: '',
  });
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [captchaToken, setCaptchaToken] = useState('');
  const [turnstileEnabled, setTurnstileEnabled] = useState(false);
  const [turnstileConfigLoaded, setTurnstileConfigLoaded] = useState(false);
  const [loginErrors, setLoginErrors] = useState({ email: '', password: '', captcha: '' });
  const [registerErrors, setRegisterErrors] = useState({ email: '', password: '', captcha: '' });

  const turnstileContainerRef = useRef(null);
  const turnstileWidgetIdRef = useRef(null);
  const googleOneTapInitRef = useRef(false);
  const isTurnstileGateActive = turnstileConfigLoaded && turnstileEnabled && !captchaToken;
  const googleClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;

  useEffect(() => {
    const routeMessage = location.state?.message;
    if (!routeMessage) return;

    const messageKey = `${location.key}:${routeMessage}`;
    if (consumedRouteMessages.has(messageKey)) return;
    consumedRouteMessages.add(messageKey);
    if (consumedRouteMessages.size > 40) {
      const firstKey = consumedRouteMessages.values().next().value;
      consumedRouteMessages.delete(firstKey);
    }

    success(routeMessage);
    navigate(`${location.pathname}${location.search}`, { replace: true, state: null });
  }, [location.key, location.pathname, location.search, location.state, navigate, success]);

  useEffect(() => {
    let mounted = true;
    const loadFlags = async () => {
      try {
        const data = await siteAssetService.getLandingAssets();
        if (!mounted) return;
        setTurnstileEnabled(typeof data?.turnstileEnabled === 'boolean' ? data.turnstileEnabled : false);
      } catch (error) {
        if (mounted) {
          setTurnstileEnabled(false);
        }
      } finally {
        if (mounted) {
          setTurnstileConfigLoaded(true);
        }
      }
    };

    loadFlags();
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (!turnstileConfigLoaded || !turnstileEnabled) {
      setCaptchaToken('');
      return undefined;
    }

    let intervalId;

    const ensureTurnstileScript = () => {
      if (window.turnstile) {
        return;
      }

      const scriptId = 'cf-turnstile-api-script';
      const existingScript = document.getElementById(scriptId)
        || document.querySelector('script[src*="challenges.cloudflare.com/turnstile/v0/api.js"]');

      if (existingScript) {
        return;
      }

      const script = document.createElement('script');
      script.id = scriptId;
      script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js';
      script.async = true;
      script.defer = true;
      document.head.appendChild(script);
    };

    const mountTurnstile = () => {
      if (!window.turnstile || !turnstileContainerRef.current || turnstileWidgetIdRef.current !== null) {
        return;
      }

      if (turnstileContainerRef.current.childElementCount > 0) {
        return;
      }

      turnstileWidgetIdRef.current = window.turnstile.render(turnstileContainerRef.current, {
        sitekey: import.meta.env.VITE_TURNSTILE_SITE_KEY,
        callback: (token) => {
          setCaptchaToken(token);
          setLoginErrors((prev) => ({ ...prev, captcha: '' }));
          setRegisterErrors((prev) => ({ ...prev, captcha: '' }));
        },
        'expired-callback': () => setCaptchaToken(''),
        'error-callback': () => setCaptchaToken(''),
      });
    };

    ensureTurnstileScript();

    if (window.turnstile) {
      mountTurnstile();
    } else {
      intervalId = window.setInterval(() => {
        if (window.turnstile) {
          window.clearInterval(intervalId);
          mountTurnstile();
        }
      }, 100);
    }

    return () => {
      if (intervalId) {
        window.clearInterval(intervalId);
      }

      if (turnstileWidgetIdRef.current !== null && window.turnstile) {
        window.turnstile.remove(turnstileWidgetIdRef.current);
        turnstileWidgetIdRef.current = null;
      }
    };
  }, [turnstileEnabled, turnstileConfigLoaded]);

  useEffect(() => {
    setCaptchaToken('');
    setLoginErrors({ email: '', password: '', captcha: '' });
    setRegisterErrors({ email: '', password: '', captcha: '' });
    if (turnstileWidgetIdRef.current !== null && window.turnstile) {
      window.turnstile.reset(turnstileWidgetIdRef.current);
    }
  }, [mode]);

  useEffect(() => {
    const canPromptOneTap = (
      Boolean(googleClientId)
      && !isRegister
      && !loading
      && !googleLoading
      && turnstileConfigLoaded
      && (!turnstileEnabled || Boolean(captchaToken))
    );

    if (!canPromptOneTap) {
      if (window.google?.accounts?.id) {
        window.google.accounts.id.cancel();
      }
      return undefined;
    }

    let cancelled = false;
    let intervalId;

    const handleOneTapCredential = async (response) => {
      if (cancelled) return;
      if (!response?.credential) return;
      setGoogleLoading(true);
      try {
        const result = await signInWithGoogleIdToken(
          response.credential,
          loginForm.rememberMe,
          turnstileEnabled ? captchaToken : ''
        );
        if (result?.success) {
          success('Google sign-in successful!');
          navigate(result.role === 'admin' ? '/admin/dashboard' : '/home');
        } else if (result?.error?.includes('deactivated') || result?.error === 'Account has been deactivated') {
          showError('Your account has been deactivated. Please contact an administrator.');
        } else {
          showError(result?.error || 'Google sign-in failed');
        }
      } catch (error) {
        if (error.message?.includes('deactivated') || error.message === 'Account has been deactivated') {
          showError('Your account has been deactivated. Please contact an administrator.');
        } else {
          showError(error.message || 'Google sign-in failed');
        }
      } finally {
        if (!cancelled) setGoogleLoading(false);
      }
    };

    const initAndPrompt = () => {
      if (!window.google?.accounts?.id) return;
      if (!googleOneTapInitRef.current && !window.__gsiInitialized) {
        window.google.accounts.id.initialize({
          client_id: googleClientId,
          callback: handleOneTapCredential,
          auto_select: false,
          cancel_on_tap_outside: true,
          context: 'signin',
        });
        googleOneTapInitRef.current = true;
        window.__gsiInitialized = true;
      }
      window.google.accounts.id.prompt();
    };

    const existingScript = document.getElementById(GOOGLE_GSI_SCRIPT_ID)
      || document.querySelector('script[src*="accounts.google.com/gsi/client"]');

    if (existingScript) {
      if (window.google?.accounts?.id) {
        initAndPrompt();
      } else {
        intervalId = window.setInterval(() => {
          if (!window.google?.accounts?.id) return;
          window.clearInterval(intervalId);
          initAndPrompt();
        }, 100);
      }
    } else {
      const script = document.createElement('script');
      script.id = GOOGLE_GSI_SCRIPT_ID;
      script.src = 'https://accounts.google.com/gsi/client';
      script.async = true;
      script.defer = true;
      script.onload = () => initAndPrompt();
      document.head.appendChild(script);
    }

    return () => {
      cancelled = true;
      if (intervalId) window.clearInterval(intervalId);
      if (window.google?.accounts?.id) {
        window.google.accounts.id.cancel();
      }
    };
  }, [
    googleClientId,
    isRegister,
    turnstileConfigLoaded,
    loading,
    googleLoading,
    loginForm.rememberMe,
    turnstileEnabled,
    captchaToken,
    signInWithGoogleIdToken,
    navigate,
    success,
    showError,
  ]);

  const switchMode = (nextMode) => {
    setSearchParams({ mode: nextMode });
  };

  const handleLoginInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    setLoginForm((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }));
    if (name === 'email' || name === 'password') {
      setLoginErrors((prev) => ({ ...prev, [name]: '' }));
    }
  };

  const handleRegisterInputChange = (e) => {
    const { name, value } = e.target;
    setRegisterForm((prev) => ({
      ...prev,
      [name]: value,
    }));
    if (name === 'email' || name === 'password') {
      setRegisterErrors((prev) => ({ ...prev, [name]: '' }));
    }
  };

  const handleRememberMeChange = (checked) => {
    setLoginForm((prev) => ({
      ...prev,
      rememberMe: !!checked,
    }));
  };

  const handleLoginSubmit = async (e) => {
    e.preventDefault();
    const email = (loginForm.email || '').trim();
    const password = String(loginForm.password || '');
    const nextErrors = { email: '', password: '', captcha: '' };

    if (!email) {
      nextErrors.email = 'Enter your email address to continue.';
    } else if (!emailPattern.test(email)) {
      nextErrors.email = 'That email format looks invalid. Try name@example.com.';
    }
    if (!password) {
      nextErrors.password = 'Enter your password to sign in.';
    }
    if (turnstileEnabled && !captchaToken) {
      nextErrors.captcha = 'Please complete the captcha before signing in.';
    }

    if (nextErrors.email || nextErrors.password || nextErrors.captcha) {
      setLoginErrors(nextErrors);
      return;
    }

    setLoginErrors({ email: '', password: '', captcha: '' });

    setLoading(true);
    try {
      const result = await login(
        email,
        password,
        loginForm.rememberMe,
        turnstileEnabled ? captchaToken : ''
      );
      if (result?.success) {
        success('Login successful!');
        navigate(result.role === 'admin' ? '/admin/dashboard' : '/home');
      }
    } catch (error) {
      if (error.message === 'ACCOUNT_DEACTIVATED') {
        showError('Your account has been deactivated. Please contact an administrator.');
      } else {
        showError(error.message);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleRegisterSubmit = async (e) => {
    e.preventDefault();
    const email = (registerForm.email || '').trim();
    const password = String(registerForm.password || '');
    const derivedDisplayName = email.includes('@') ? email.split('@')[0] : email;
    const nextErrors = { email: '', password: '', captcha: '' };

    if (!email) {
      nextErrors.email = 'Enter your email so we can create your account.';
    } else if (!emailPattern.test(email)) {
      nextErrors.email = 'That email format looks invalid. Try name@example.com.';
    }
    if (!password) {
      nextErrors.password = 'Choose a password with at least 8 characters.';
    } else if (password.length < 8) {
      nextErrors.password = 'Use at least 8 characters for a stronger password.';
    }
    if (turnstileEnabled && !captchaToken) {
      nextErrors.captcha = 'Please complete the captcha before creating your account.';
    }

    if (nextErrors.email || nextErrors.password || nextErrors.captcha) {
      setRegisterErrors(nextErrors);
      return;
    }

    setRegisterErrors({ email: '', password: '', captcha: '' });

    setLoading(true);
    try {
      const result = await register(
        email,
        password,
        { ...registerForm, displayName: derivedDisplayName, email },
        turnstileEnabled ? captchaToken : ''
      );
      if (result?.success) {
        success('Registration successful!');
        if (result.requiresVerification) {
          navigate('/verify-email', {
            state: {
              email: result.email,
              message: result.message,
            },
          });
        } else {
          navigate(result.role === 'admin' ? '/admin/dashboard' : '/home');
        }
      }
    } catch (error) {
      showError(error.message || 'Registration failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    if (turnstileEnabled && !captchaToken) {
      if (isRegister) {
        setRegisterErrors((prev) => ({
          ...prev,
          captcha: 'Please complete the captcha before continuing with Google.',
        }));
      } else {
        setLoginErrors((prev) => ({
          ...prev,
          captcha: 'Please complete the captcha before continuing with Google.',
        }));
      }
      return;
    }

    setGoogleLoading(true);
    try {
      const rememberMe = isRegister ? false : loginForm.rememberMe;
      const result = await signInWithGoogle(rememberMe, turnstileEnabled ? captchaToken : '');
      if (result?.success) {
        success('Google sign-in successful!');
        navigate(result.role === 'admin' ? '/admin/dashboard' : '/home');
      } else if (result?.error?.includes('deactivated') || result?.error === 'Account has been deactivated') {
        showError('Your account has been deactivated. Please contact an administrator.');
      } else {
        showError(result?.error || 'Google sign-in failed');
      }
    } catch (error) {
      if (error.message?.includes('deactivated') || error.message === 'Account has been deactivated') {
        showError('Your account has been deactivated. Please contact an administrator.');
      } else {
        showError(error.message || 'Google sign-in failed');
      }
    } finally {
      setGoogleLoading(false);
    }
  };

  return (
    <div
      className="typography-auth min-h-screen flex items-center justify-center py-8 px-4 sm:px-6 lg:px-8 relative"
      style={{
        backgroundImage: "url('/herb_background.jpg')",
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat',
      }}
    >
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      <div className="max-w-md w-full space-y-6 relative z-10">
        <div className="bg-surface-primary rounded-lg shadow-md p-6">
          <div className="mb-4">
            <Link
              to="/"
              className="inline-flex items-center text-sm text-tertiary hover:text-brand transition-colors duration-200"
            >
              <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              <span className="leading-none">Back to Home</span>
            </Link>
          </div>

          <h2 className="text-center text-2xl font-bold font-display text-secondary mb-2">
            {isRegister ? 'Create your account' : 'Sign in to your account'}
          </h2>
          <p className="text-center text-sm font-sans text-tertiary mb-4">
            {isRegister ? 'Already registered?' : "Don't have an account?"}{' '}
            <button
              type="button"
              onClick={() => switchMode(isRegister ? 'login' : 'register')}
              className="font-medium text-accent hover:text-accent-hover p-0 min-h-0 h-auto"
            >
              {isRegister ? 'Log in' : 'Sign up'}
            </button>
          </p>

          <form className="space-y-4" onSubmit={isRegister ? handleRegisterSubmit : handleLoginSubmit} noValidate>
            <div>
              <label
                htmlFor={isRegister ? 'register-email' : 'login-email'}
                className={`block text-sm font-medium font-sans ${
                  (isRegister ? registerErrors.email : loginErrors.email) ? 'text-intent-danger' : 'text-secondary'
                }`}
              >
                {(isRegister ? registerErrors.email : loginErrors.email) || 'Email address'}
              </label>
                <Input
                  id={isRegister ? 'register-email' : 'login-email'}
                  type="email"
                  placeholder="Enter your email address"
                  value={isRegister ? registerForm.email : loginForm.email}
                  onChange={isRegister ? handleRegisterInputChange : handleLoginInputChange}
                  name="email"
                  autoComplete="email"
                  state={(isRegister ? registerErrors.email : loginErrors.email) ? 'error' : undefined}
                />
            </div>

            <div>
              <label
                htmlFor={isRegister ? 'register-password' : 'login-password'}
                className={`block text-sm font-medium font-sans ${
                  (isRegister ? registerErrors.password : loginErrors.password) ? 'text-intent-danger' : 'text-secondary'
                }`}
              >
                {(isRegister ? registerErrors.password : loginErrors.password) || 'Password'}
              </label>
              <div className="relative">
                <Input
                  id={isRegister ? 'register-password' : 'login-password'}
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Enter your password"
                  value={isRegister ? registerForm.password : loginForm.password}
                  onChange={isRegister ? handleRegisterInputChange : handleLoginInputChange}
                  name="password"
                  autoComplete={isRegister ? 'new-password' : 'current-password'}
                  className="pr-10"
                  state={(isRegister ? registerErrors.password : loginErrors.password) ? 'error' : undefined}
                />
                <button
                  type="button"
                  className="password-toggle absolute inset-y-0 right-0 pr-3 flex items-center"
                  onClick={() => setShowPassword((prev) => !prev)}
                >
                  <svg className="h-5 w-5 text-tertiary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    {showPassword ? (
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                    ) : (
                      <>
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                      </>
                    )}
                  </svg>
                </button>
              </div>
            </div>

            {!isRegister && (
              <div className="flex items-center justify-between">
                <div className="flex items-center">
                  <Checkbox
                    id="remember-me"
                    checked={loginForm.rememberMe}
                    onChange={handleRememberMeChange}
                  />
                  <label htmlFor="remember-me" className="ml-2 block text-sm font-sans text-tertiary">
                    Remember me
                  </label>
                </div>
              </div>
            )}

            {turnstileConfigLoaded && turnstileEnabled && (
              <div className="flex flex-col items-center gap-2">
                <div ref={turnstileContainerRef} />
                {(isRegister ? registerErrors.captcha : loginErrors.captcha) && (
                  <p className="text-sm font-sans text-intent-danger text-center">
                    {isRegister ? registerErrors.captcha : loginErrors.captcha}
                  </p>
                )}
              </div>
            )}

            <Button
              type="submit"
              variant="primary"
              size="lg"
              className="w-full"
              loading={loading}
              disabled={isTurnstileGateActive}
            >
              {isRegister ? 'Create Account' : 'Sign in'}
            </Button>

            <div className="relative my-2">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-primary" />
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-2 bg-surface-primary text-tertiary">Or continue with</span>
              </div>
            </div>

            <Button
              type="button"
              variant="neutral"
              size="lg"
              className="w-full flex items-center justify-center"
              onClick={handleGoogleSignIn}
              loading={googleLoading}
              disabled={isTurnstileGateActive}
            >
              <svg className="w-5 h-5 mr-2" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
              </svg>
              Google
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
};

export default AuthPage;
