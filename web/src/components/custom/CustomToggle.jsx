import React, { useState, useRef, useCallback, useEffect } from 'react';
import '../../styles/components/CustomToggle.css';

const CloudflareIcon = ({ className }) => (
  <svg
    className={className}
    viewBox="0 0 24 24"
    xmlns="http://www.w3.org/2000/svg"
    aria-label="Cloudflare"
    role="img"
  >
    <path
      fill="#F48120"
      d="M16.608 15.716h-9.44a.44.44 0 0 1-.433-.368l-.004-.056a.44.44 0 0 1 .438-.44h9.44a.44.44 0 0 1 .433.366l.004.057a.44.44 0 0 1-.438.441zm.98-2.435H7.164a.44.44 0 0 1-.433-.367l-.004-.057a.44.44 0 0 1 .438-.44H17.59a.44.44 0 0 1 .432.366l.004.057a.44.44 0 0 1-.438.44zm-.98-2.435H9.144a.44.44 0 0 1-.433-.368l-.004-.056a.44.44 0 0 1 .438-.44h7.465a.44.44 0 0 1 .432.366l.004.057a.44.44 0 0 1-.438.441zM12 2C6.477 2 2 6.477 2 12s4.477 10 10 10 10-4.477 10-10S17.523 2 12 2zm5.447 13.795a1.32 1.32 0 0 1-1.323 1.146H7.876a1.32 1.32 0 0 1-1.323-1.146l-.56-5.56a1.32 1.32 0 0 1 1.316-1.459h.072a3.527 3.527 0 0 1 3.497-3.097 3.527 3.527 0 0 1 3.12 1.877 2.643 2.643 0 0 1 3.77 2.396v.284a1.32 1.32 0 0 1 .875 1.24l-.196 4.319z"
    />
  </svg>
);

const CustomToggle = ({ isOn, onToggle, className, disabled = false, style, ...props }) => {
  const THUMB_MOVE_MS = 450;
  const RIPPLE_MS = 500;
  const [rippleAnimating, setRippleAnimating] = useState(false);
  const rippleRef = useRef(null);
  const wrapRef = useRef(null);
  const rippleStartTimerRef = useRef(null);
  const rippleEndTimerRef = useRef(null);
  const hasMountedRef = useRef(false);

  useEffect(() => () => {
    clearTimeout(rippleStartTimerRef.current);
    clearTimeout(rippleEndTimerRef.current);
  }, []);

  const handleClick = useCallback(() => {
    if (disabled) return;
    onToggle(!isOn);
  }, [disabled, isOn, onToggle]);

  useEffect(() => {
    if (!hasMountedRef.current) {
      hasMountedRef.current = true;
      return;
    }

    const ripple = rippleRef.current;
    if (!ripple) return;

    const trackWidth = wrapRef.current?.offsetWidth ?? 220;
    const rippleOnX = trackWidth - 64; // mirrors thumb on-position

    ripple.style.setProperty('--ripple-on-x', `${rippleOnX}px`);
    ripple.classList.remove('animate-on', 'animate-off');
    void ripple.offsetWidth; // force reflow
    clearTimeout(rippleStartTimerRef.current);
    clearTimeout(rippleEndTimerRef.current);
    setRippleAnimating(false);

    // Fire only after confirmed state change and after thumb finishes moving.
    rippleStartTimerRef.current = setTimeout(() => {
      ripple.classList.add(isOn ? 'animate-on' : 'animate-off');
      setRippleAnimating(true);
      rippleEndTimerRef.current = setTimeout(() => setRippleAnimating(false), RIPPLE_MS);
    }, THUMB_MOVE_MS);
  }, [isOn]);

  return (
    <div
      ref={wrapRef}
      className={`toggle-wrap ${isOn ? 'on' : ''} ${className || ''}`}
      onClick={handleClick}
      role="switch"
      aria-checked={isOn}
      aria-disabled={disabled}
      tabIndex={disabled ? -1 : 0}
      onKeyDown={(e) => (e.key === ' ' || e.key === 'Enter') && handleClick()}
      style={style}
      {...props}
    >
      <div className="track">
        <span className="track-text on">Enabled</span>
        <span className="track-text off">Disabled</span>
      </div>
      <div className="ripple" ref={rippleRef} />
      <div className="thumb">
        <CloudflareIcon className="cf-icon" />
      </div>
    </div>
  );
};

export default CustomToggle;
