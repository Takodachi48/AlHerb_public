import React from 'react';
import PropTypes from 'prop-types';
import { Bookmark, Heart, Mars, ThumbsUp, Venus } from 'lucide-react';

const VARIANT_STYLES = {
  primary: {
    borderColor: 'var(--border-brand, #7fa87f)',
    background: 'var(--interactive-brand-primary, #7fa87f)',
    color: 'var(--text-on-brand, #0d160d)',
  },
  secondary: {
    borderColor: 'var(--border-secondary, rgba(255,255,255,.18))',
    background: 'var(--surface-secondary, #222)',
    color: 'var(--text-secondary, #b8b4ac)',
  },
  outline: {
    borderColor: 'var(--border-secondary, rgba(255,255,255,.16))',
    background: 'transparent',
    color: 'var(--text-secondary, #b8b4ac)',
  },
  ghost: {
    borderColor: 'transparent',
    background: 'rgba(0,0,0,.36)',
    color: 'var(--text-secondary, #b8b4ac)',
  },
};

const SIZE_STYLES = {
  sm: { width: 30, height: 30, icon: 14 },
  md: { width: 34, height: 34, icon: 16 },
  lg: { width: 40, height: 40, icon: 18 },
};

const FilledThumbsUpIcon = ({ size = 16, ...props }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    {...props}
  >
    <path
      d="M15 5.88 14 10h5.83a2 2 0 0 1 1.92 2.56l-2.33 8A2 2 0 0 1 17.5 22H4a2 2 0 0 1-2-2v-8a2 2 0 0 1 2-2h2.76a2 2 0 0 0 1.79-1.11L12 2a3.13 3.13 0 0 1 3 3.88Z"
      fill="currentColor"
    />
    <path
      d="M15 5.88 14 10h5.83a2 2 0 0 1 1.92 2.56l-2.33 8A2 2 0 0 1 17.5 22H4a2 2 0 0 1-2-2v-8a2 2 0 0 1 2-2h2.76a2 2 0 0 0 1.79-1.11L12 2a3.13 3.13 0 0 1 3 3.88Z"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path
      d="M7 10v12"
      stroke="var(--surface-primary, #1a1a1a)"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

const PRESET_CONFIG = {
  like: {
    icon: ThumbsUp,
    activeIcon: FilledThumbsUpIcon,
    activeStyle: {
      borderColor: 'var(--interactive-accent-indicator)',
      color: 'var(--interactive-accent-indicator)',
    },
  },
  bookmark: {
    icon: Bookmark,
    fillWhenToggled: true,
    activeStyle: {
      borderColor: 'var(--interactive-accent-indicator)',
      color: 'var(--interactive-accent-indicator)',
    },
  },
  favorite: {
    icon: Heart,
    fillWhenToggled: true,
    activeStyle: {
      color: 'var(--icon-danger)',
      borderColor: 'rgba(255,255,255,0.3)',
    },
  },
  genderMale: {
    icon: Mars,
    inactiveStyle: {
      borderColor: 'rgba(84, 140, 255, 0.45)',
      background: 'transparent',
      color: 'rgb(84, 140, 255)',
    },
    activeStyle: {
      borderColor: 'rgb(84, 140, 255)',
      background: 'rgb(84, 140, 255)',
      color: 'var(--text-on-dark)',
    },
  },
  genderFemale: {
    icon: Venus,
    inactiveStyle: {
      borderColor: 'rgba(236, 108, 181, 0.45)',
      background: 'transparent',
      color: 'rgb(236, 108, 181)',
    },
    activeStyle: {
      borderColor: 'rgb(236, 108, 181)',
      background: 'rgb(236, 108, 181)',
      color: 'var(--text-on-dark)',
    },
  },
};

const PRESET_NAME_ALIASES = {
  like: 'like',
  bookmark: 'bookmark',
  favorite: 'favorite',
  'gender-male': 'genderMale',
  'gender-female': 'genderFemale',
};

const parsePreset = (preset) => {
  const raw = String(preset || '').trim();
  if (!raw) return { name: '', variant: '' };
  const parts = raw.split('-');
  const maybeVariant = parts[parts.length - 1];
  if (Object.prototype.hasOwnProperty.call(VARIANT_STYLES, maybeVariant)) {
    return {
      name: parts.slice(0, -1).join('-'),
      variant: maybeVariant,
    };
  }
  return { name: raw, variant: '' };
};

const IconToggleButton = ({
  preset = '',
  icon: Icon = null,
  activeIcon: ActiveIcon = null,
  toggled = false,
  onClick = undefined,
  ariaLabel = 'Toggle option',
  title = '',
  variant = 'outline',
  size = 'md',
  disabled = false,
  loading = false,
  className = '',
  style = {},
  activeStyle = {},
  inactiveStyle = {},
  fillWhenToggled = undefined,
  activeStroke = 'currentColor',
  activeFill = 'currentColor',
}) => {
  const parsedPreset = parsePreset(preset);
  const presetKey = PRESET_NAME_ALIASES[parsedPreset.name] || '';
  const presetConfig = presetKey ? PRESET_CONFIG[presetKey] : null;

  const resolvedVariant = parsedPreset.variant || variant;
  const chosenVariant = VARIANT_STYLES[resolvedVariant] ? resolvedVariant : 'outline';
  const chosenSize = SIZE_STYLES[size] ? size : 'md';
  const resolvedIcon = Icon || presetConfig?.icon;
  const resolvedActiveIcon = ActiveIcon || presetConfig?.activeIcon || null;
  const resolvedFillWhenToggled = typeof fillWhenToggled === 'boolean'
    ? fillWhenToggled
    : Boolean(presetConfig?.fillWhenToggled);

  const IconComp = toggled && resolvedActiveIcon ? resolvedActiveIcon : resolvedIcon;
  if (!IconComp) return null;

  const combinedActiveStyle = {
    ...(presetConfig?.activeStyle || {}),
    ...(activeStyle || {}),
  };
  const combinedInactiveStyle = {
    ...(presetConfig?.inactiveStyle || {}),
    ...(inactiveStyle || {}),
  };

  const mergedStyle = {
    width: SIZE_STYLES[chosenSize].width,
    height: SIZE_STYLES[chosenSize].height,
    borderRadius: 999,
    border: '1px solid',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: disabled || loading ? 'default' : 'pointer',
    opacity: disabled || loading ? 0.65 : 1,
    transition: 'all .18s ease',
    lineHeight: 1,
    ...VARIANT_STYLES[chosenVariant],
    ...(toggled ? combinedActiveStyle : combinedInactiveStyle),
    ...style,
  };

  return (
    <button
      type="button"
      className={className}
      onClick={onClick}
      aria-label={ariaLabel}
      aria-pressed={Boolean(toggled)}
      title={title || ariaLabel}
      disabled={disabled || loading}
      style={mergedStyle}
    >
      {loading ? (
        <span style={{ fontSize: 12 }}>...</span>
      ) : (
        <IconComp
          size={SIZE_STYLES[chosenSize].icon}
          strokeWidth={2}
          fill={resolvedFillWhenToggled && toggled ? activeFill : 'none'}
          stroke={toggled ? activeStroke : 'currentColor'}
          aria-hidden="true"
        />
      )}
    </button>
  );
};

IconToggleButton.propTypes = {
  preset: PropTypes.string,
  icon: PropTypes.elementType,
  activeIcon: PropTypes.elementType,
  toggled: PropTypes.bool,
  onClick: PropTypes.func,
  ariaLabel: PropTypes.string,
  title: PropTypes.string,
  variant: PropTypes.oneOf(['primary', 'secondary', 'outline', 'ghost']),
  size: PropTypes.oneOf(['sm', 'md', 'lg']),
  disabled: PropTypes.bool,
  loading: PropTypes.bool,
  className: PropTypes.string,
  style: PropTypes.object,
  activeStyle: PropTypes.object,
  inactiveStyle: PropTypes.object,
  fillWhenToggled: PropTypes.bool,
  activeStroke: PropTypes.string,
  activeFill: PropTypes.string,
};

export default IconToggleButton;
