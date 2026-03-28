import React, { useEffect, useLayoutEffect } from 'react';
import { SYSTEM_NAME } from '../../../../shared/constants/app.js';
import '../../styles/components/Loading.css';

const Loading = ({
  size = 'medium',
  variant = 'inline',
  animation = 'chaotic',
  text,
  className = '',
  overlayOpacity = 'bg-base-primary/60',
  backdropBlur = 'backdrop-blur-sm',
  progressBackgroundImageUrl = '',
  progressValue = null,
  complete = false,
  onExitStart,
  onComplete,
  centerOffset = '0rem', // New prop to handle layout-aware centering
}) => {
  const resolveDarkMode = () => {
    if (typeof document === 'undefined') return false;
    const root = document.documentElement;
    if (root.classList.contains('dark')) return true;
    if (root.classList.contains('light')) return false;
    if (typeof window !== 'undefined' && typeof window.matchMedia === 'function') {
      return window.matchMedia('(prefers-color-scheme: dark)').matches;
    }
    return false;
  };

  const [isDarkMode, setIsDarkMode] = React.useState(resolveDarkMode);
  const sizeClass = { small: 'ld-sz-sm', medium: 'ld-sz-md', large: 'ld-sz-lg', extraLarge: 'ld-sz-xl' }[size] ?? 'ld-sz-md';
  const textSizeClass = { small: 'ld-txt-sm', medium: 'ld-txt-md', large: 'ld-txt-lg', extraLarge: 'ld-txt-xl' }[size] ?? 'ld-txt-md';

  const bouncingSpinner = (
    <div className="wrapper flex items-center justify-center" style={{ width: '120px', height: '40px', position: 'relative', zIndex: 1 }}>
      <div className="circle bg-accent" style={{ width: '12px', height: '12px', position: 'absolute', borderRadius: '50%', left: '15%', transformOrigin: '50%', animation: 'circle7124 0.5s alternate infinite ease' }}></div>
      <div className="circle bg-accent" style={{ width: '12px', height: '12px', position: 'absolute', borderRadius: '50%', left: '45%', transformOrigin: '50%', animation: 'circle7124 0.5s alternate infinite ease', animationDelay: '0.2s' }}></div>
      <div className="circle bg-accent" style={{ width: '12px', height: '12px', position: 'absolute', borderRadius: '50%', right: '15%', transformOrigin: '50%', animation: 'circle7124 0.5s alternate infinite ease', animationDelay: '0.3s' }}></div>
      <div className="shadow bg-black/90" style={{ width: '12px', height: '2px', borderRadius: '50%', position: 'absolute', top: '42px', transformOrigin: '50%', zIndex: -1, left: '15%', filter: 'blur(1px)', animation: 'shadow046 0.5s alternate infinite ease' }}></div>
      <div className="shadow bg-black/90" style={{ width: '12px', height: '2px', borderRadius: '50%', position: 'absolute', top: '42px', transformOrigin: '50%', zIndex: -1, left: '45%', filter: 'blur(1px)', animation: 'shadow046 0.5s alternate infinite ease', animationDelay: '0.2s' }}></div>
      <div className="shadow bg-black/90" style={{ width: '12px', height: '2px', borderRadius: '50%', position: 'absolute', top: '42px', transformOrigin: '50%', zIndex: -1, right: '15%', filter: 'blur(1px)', animation: 'shadow046 0.5s alternate infinite ease', animationDelay: '0.3s' }}></div>
    </div>
  );

  const chaoticSpinner = <div className="ld-chaotic" />;

  const spinner = animation === 'bouncing' ? bouncingSpinner : chaoticSpinner;
  const [progress, setProgress] = React.useState(0);
  const [exiting, setExiting] = React.useState(false);
  const progressRef = React.useRef(0);
  const isProgressVariant = variant === 'fullscreen-progress' || variant === 'fullpage-progress';
  const isControlledProgress = Number.isFinite(progressValue);
  const resolvedProgressBackgroundImageUrl = React.useMemo(() => {
    if (typeof progressBackgroundImageUrl === 'string') {
      return progressBackgroundImageUrl.trim();
    }

    if (progressBackgroundImageUrl && typeof progressBackgroundImageUrl === 'object') {
      const darkUrl = typeof progressBackgroundImageUrl.dark === 'string'
        ? progressBackgroundImageUrl.dark.trim()
        : '';
      const lightUrl = typeof progressBackgroundImageUrl.light === 'string'
        ? progressBackgroundImageUrl.light.trim()
        : '';
      return isDarkMode ? (darkUrl || lightUrl) : (lightUrl || darkUrl);
    }

    return '';
  }, [progressBackgroundImageUrl, isDarkMode]);

  const hasProgressBackgroundImage = resolvedProgressBackgroundImageUrl.length > 0;
  const progressBackgroundImageStyle = hasProgressBackgroundImage
    ? { backgroundImage: `url("${resolvedProgressBackgroundImageUrl}")` }
    : {};

  const LeafIcon = ({ size = 24, className: iconClassName = '' }) => (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={iconClassName}
    >
      <path d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19 2c1 2 2 4.18 2 8 0 5.5-4.78 10-10 10z" />
      <path d="M2 21c0-3 1.85-5.36 5.08-6C9.5 14.52 12 13 13 12" />
    </svg>
  );

  useEffect(() => {
    if (typeof document === 'undefined') return undefined;

    const root = document.documentElement;
    const mediaQuery = typeof window !== 'undefined' && typeof window.matchMedia === 'function'
      ? window.matchMedia('(prefers-color-scheme: dark)')
      : null;
    const syncMode = () => setIsDarkMode(resolveDarkMode());
    syncMode();

    const observer = typeof MutationObserver !== 'undefined'
      ? new MutationObserver(syncMode)
      : null;
    if (observer) {
      observer.observe(root, { attributes: true, attributeFilter: ['class'] });
    }

    if (mediaQuery && typeof mediaQuery.addEventListener === 'function') {
      mediaQuery.addEventListener('change', syncMode);
    } else if (mediaQuery && typeof mediaQuery.addListener === 'function') {
      mediaQuery.addListener(syncMode);
    }

    return () => {
      if (observer) observer.disconnect();
      if (mediaQuery && typeof mediaQuery.removeEventListener === 'function') {
        mediaQuery.removeEventListener('change', syncMode);
      } else if (mediaQuery && typeof mediaQuery.removeListener === 'function') {
        mediaQuery.removeListener(syncMode);
      }
    };
  }, []);

  useEffect(() => {
    if (!isProgressVariant || !isControlledProgress) return undefined;
    const normalized = Math.max(0, Math.min(100, progressValue));
    setProgress(normalized);
    return undefined;
  }, [isProgressVariant, isControlledProgress, progressValue]);

  useEffect(() => {
    if (!isProgressVariant || isControlledProgress) return undefined;

    let intervalId = null;
    intervalId = window.setInterval(() => {
      setProgress((prev) => {
        if (complete) return prev;
        const remaining = 92 - prev;
        if (remaining <= 0) return 92;
        const step = remaining > 40 ? 2.2 : remaining > 20 ? 1.2 : 0.45;
        return Math.min(92, prev + step + Math.random() * 0.7);
      });
    }, 120);

    return () => {
      if (intervalId) window.clearInterval(intervalId);
    };
  }, [complete, isProgressVariant, isControlledProgress]);

  useEffect(() => {
    if (!isProgressVariant) return;
    if (!complete) {
      setExiting(false);
    }
  }, [complete, isProgressVariant]);

  useEffect(() => {
    progressRef.current = progress;
  }, [progress]);

  useEffect(() => {
    if (!isProgressVariant || isControlledProgress || !complete) return undefined;

    let rafId = null;
    let startTs = null;
    const startProgress = progressRef.current;
    const duration = 550;

    const tick = (ts) => {
      if (!startTs) startTs = ts;
      const elapsed = ts - startTs;
      const raw = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - raw, 2.5);
      const nextValue = startProgress + (100 - startProgress) * eased;
      setProgress(nextValue);
      if (raw < 1) {
        rafId = window.requestAnimationFrame(tick);
      } else {
        setProgress(100);
        if (typeof onExitStart === 'function') {
          onExitStart();
        }
        setExiting(true);
        window.setTimeout(() => {
          if (typeof onComplete === 'function') {
            onComplete();
          }
        }, 420);
      }
    };

    rafId = window.requestAnimationFrame(tick);
    return () => {
      if (rafId) window.cancelAnimationFrame(rafId);
    };
  }, [complete, isProgressVariant, onComplete, onExitStart, isControlledProgress]);


  const content = (
    <div className={`ld-content ${sizeClass} ${className}`}>
      {spinner}
      {text && <p className={`ld-status ${textSizeClass}`}>{text}</p>}
    </div>
  );

  // Inline variant - default behavior
  if (variant === 'inline') {
    return content;
  }

  // Overlay variant - fullscreen with darkened/blurred background
  if (variant === 'overlay') {
    return (
      <div className={`ld-overlay ${overlayOpacity} ${backdropBlur}`}>
        <div className="ld-overlay__panel">{content}</div>
      </div>
    );
  }

  // Fullscreen variant - covers entire screen without background styling
  if (variant === 'fullscreen') {
    return (
      <div className="ld-fullscreen">
        <div className="ld-fullscreen__shell" style={{ transform: `translateY(${centerOffset})` }}>
          <div className="ld-fullscreen__wordmark">
            <span className="ld-fullscreen__eyebrow">Botanical Systems</span>
            <span className="ld-fullscreen__brand">{SYSTEM_NAME}</span>
          </div>
          {chaoticSpinner}
          {text && <p className="ld-fullscreen__label">{text}</p>}
        </div>
      </div>
    );
  }

  /* ── fullscreen-progress / fullpage-progress ── */
  const isFullscreen   = variant === 'fullscreen-progress';
  const defaultLabel   = isFullscreen ? 'loading' : 'loading page';
  const pct            = Math.round(progress);

  return (
    <div className={[
      'ld-prog',
      isFullscreen ? 'ld-prog--fullscreen' : 'ld-prog--fullpage',
      exiting ? 'is-exiting' : '',
    ].join(' ')}>

      {/* ── Background layers ── */}
      <div className={`ld-prog__bg-base ${isFullscreen ? 'ld-prog__bg-base--fs' : 'ld-prog__bg-base--fp'}`} />
      <div className="ld-prog__bg-tint" />
      {hasProgressBackgroundImage && (
        <div
          className="ld-prog__bg-image"
          style={{ backgroundImage: `url("${resolvedProgressBackgroundImageUrl}")` }}
        />
      )}

      {/* ── Centred content ── */}
      <div className="ld-prog__shell" style={{ transform: `translateY(${centerOffset})` }}>

        {/* Brand */}
        <div className="ld-prog__brand">
          <span className="ld-prog__eyebrow">Botanical Systems</span>
          <h1   className="ld-prog__title">{SYSTEM_NAME}</h1>
          <span className="ld-prog__rule" aria-hidden="true" />
        </div>

        {/* Progress */}
        <div className="ld-prog__block">

          {/* Label row */}
          <div className="ld-prog__meta">
            <span className="ld-prog__label">{text || defaultLabel}</span>
            <span className="ld-prog__pct" aria-live="polite">{pct}<em>%</em></span>
          </div>

          {/* Track */}
          <div className="ld-prog__track" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
            <div className="ld-prog__fill" style={{ width: `${progress}%` }} />
          </div>

          {/* Tick marks */}
          <div className="ld-prog__ticks" aria-hidden="true">
            {[0, 25, 50, 75, 100].map(n => (
              <span key={n} className={`ld-prog__tick${progress >= n ? ' is-lit' : ''}`} />
            ))}
          </div>

        </div>
      </div>
    </div>
  );
};

export default Loading;
