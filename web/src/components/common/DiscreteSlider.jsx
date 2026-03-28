import React, { useMemo } from 'react';
import PropTypes from 'prop-types';

/**
 * DiscreteSlider
 *
 * Props:
 *   label         string   — eyebrow label shown top-left
 *   value         string   — currently selected option value
 *   onChange      fn       — (value: string) => void
 *   options       Array<{ value, label, shortLabel? }>
 *   valueColorMap object   — { [value]: cssColorString } overrides thumb/active colour
 *   className     string
 */
const DiscreteSlider = ({
  label     = 'Filter',
  value,
  onChange,
  options,
  valueColorMap = {},
  className = '',
}) => {
  const safeOptions = Array.isArray(options) ? options : [];

  const currentIndex = useMemo(() => {
    const idx = safeOptions.findIndex((item) => item.value === value);
    return idx >= 0 ? idx : 0;
  }, [safeOptions, value]);

  const currentItem  = safeOptions[currentIndex];
  const currentLabel = currentItem?.label || '';
  const currentValue = currentItem?.value;
  const activeColor  = valueColorMap?.[currentValue] || 'var(--border-brand)';

  const handleSliderChange = (e) => {
    const next = safeOptions[Number(e.target.value)];
    if (next) onChange(next.value);
  };

  const handleMarkClick = (index) => {
    const next = safeOptions[index];
    if (next) onChange(next.value);
  };

  if (safeOptions.length <= 1) return null;

  const pct = safeOptions.length > 1
    ? (currentIndex / (safeOptions.length - 1)) * 100
    : 0;

  return (
    <div
      className={`ds-root ${className}`.trim()}
      style={{ '--ds-active': activeColor, '--ds-pct': `${pct}%` }}
    >
      {/* ── Header row ── */}
      <div className="ds-header">
        <span className="ds-eyebrow">{label}</span>
        <span className="ds-value-label">{currentLabel}</span>
      </div>

      {/* ── Track + thumb ── */}
      <div className="ds-track-wrap">
        {/* Tick marks aligned to each option position */}
        <div className="ds-ticks" aria-hidden="true">
          {safeOptions.map((_, i) => {
            const tickPct = safeOptions.length > 1
              ? (i / (safeOptions.length - 1)) * 100
              : 0;
            const isActive = i <= currentIndex;
            return (
              <span
                key={i}
                className={`ds-tick${isActive ? ' ds-tick--active' : ''}`}
                style={{ left: `${tickPct}%` }}
              />
            );
          })}
        </div>

        {/* Native range input — positioned over the track */}
        <input
          type="range"
          min={0}
          max={safeOptions.length - 1}
          step={1}
          value={currentIndex}
          onChange={handleSliderChange}
          className="ds-input"
          aria-label={label}
          aria-valuetext={currentLabel}
        />
      </div>

      {/* ── Step labels ── */}
      <div className="ds-marks" aria-hidden="true">
        {safeOptions.map((item, index) => (
          <button
            key={item.value}
            type="button"
            onClick={() => handleMarkClick(index)}
            className={`ds-mark${index === currentIndex ? ' ds-mark--active' : ''}`}
            tabIndex={-1}
          >
            {item.shortLabel || item.label}
          </button>
        ))}
      </div>
    </div>
  );
};

DiscreteSlider.propTypes = {
  label:         PropTypes.string,
  value:         PropTypes.string.isRequired,
  onChange:      PropTypes.func.isRequired,
  options:       PropTypes.arrayOf(PropTypes.shape({
    value:      PropTypes.string.isRequired,
    label:      PropTypes.string.isRequired,
    shortLabel: PropTypes.string,
  })).isRequired,
  valueColorMap: PropTypes.objectOf(PropTypes.string),
  className:     PropTypes.string,
};

export default DiscreteSlider;