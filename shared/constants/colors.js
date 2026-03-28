// Color constants for the Herbal Medicine System
// Aligned with semantic theme system using CSS custom properties

export const COLORS = {
  // Legacy color scales (keep for backward compatibility)
  primary: {
    50: '#f0fdf4',
    100: '#dcfce7',
    200: '#bbf7d0',
    300: '#86efac',
    400: '#4ade80',
    500: '#22c55e',
    600: '#16a34a',
    700: '#15803d',
    800: '#166534',
    900: '#14532d',
  },

  secondary: {
    50: '#f8fafc',
    100: '#f1f5f9',
    200: '#e2e8f0',
    300: '#cbd5e1',
    400: '#94a3b8',
    500: '#64748b',
    600: '#475569',
    700: '#334155',
    800: '#1e293b',
    900: '#0f172a',
  },

  success: {
    50: '#f0fdf4',
    100: '#dcfce7',
    200: '#bbf7d0',
    300: '#86efac',
    400: '#4ade80',
    500: '#22c55e',
    600: '#16a34a',
    700: '#15803d',
    800: '#166534',
    900: '#14532d',
  },

  warning: {
    50: '#fffbeb',
    100: '#fef3c7',
    200: '#fde68a',
    300: '#fcd34d',
    400: '#fbbf24',
    500: '#f59e0b',
    600: '#d97706',
    700: '#b45309',
    800: '#92400e',
    900: '#78350f',
  },

  error: {
    50: '#fef2f2',
    100: '#fee2e2',
    200: '#fecaca',
    300: '#fca5a5',
    400: '#f87171',
    500: '#ef4444',
    600: '#dc2626',
    700: '#b91c1c',
    800: '#991b1b',
    900: '#7f1d1d',
  },

  info: {
    50: '#eff6ff',
    100: '#dbeafe',
    200: '#bfdbfe',
    300: '#93c5fd',
    400: '#60a5fa',
    500: '#3b82f6',
    600: '#2563eb',
    700: '#1d4ed8',
    800: '#1e40af',
    900: '#1e3a8a',
  },

  neutral: {
    50: '#fafafa',
    100: '#f5f5f5',
    200: '#e5e5e5',
    300: '#d4d4d4',
    400: '#a3a3a3',
    500: '#737373',
    600: '#525252',
    700: '#404040',
    800: '#262626',
    900: '#171717',
  },

  // Semantic color aliases
  white: '#ffffff',
  black: '#000000',
  transparent: 'transparent',
};

// Herb-specific colors (keeping for herb-specific components)
export const HERB_COLORS = {
  // Plant-related colors
  leaf: {
    light: '#86efac',
    medium: '#22c55e',
    dark: '#15803d',
  },
  flower: {
    light: '#fbbf24',
    medium: '#f59e0b',
    dark: '#d97706',
  },
  root: {
    light: '#fca5a5',
    medium: '#ef4444',
    dark: '#dc2626',
  },
  seed: {
    light: '#fde68a',
    medium: '#fbbf24',
    dark: '#f59e0b',
  },
  bark: {
    light: '#d4d4d4',
    medium: '#737373',
    dark: '#404040',
  },
};

// Status colors (using semantic intent colors)
export const STATUS_COLORS = {
  active: 'var(--intent-success)',
  inactive: 'var(--neutral)',
  pending: 'var(--intent-warning)',
  error: 'var(--intent-danger)',
  success: 'var(--intent-success)',
  warning: 'var(--intent-warning)',
  info: 'var(--intent-info)',
};

// Rating colors (using semantic intent colors)
export const RATING_COLORS = {
  5: 'var(--intent-success)',
  4: 'var(--intent-success)',
  3: 'var(--intent-warning)',
  2: 'var(--intent-warning)',
  1: 'var(--intent-danger)',
};

// Semantic theme colors (using CSS custom properties)
export const THEME_COLORS = {
  // Core theme colors
  background: 'rgb(var(--background))',
  primary: 'rgb(var(--primary))',
  secondary: 'rgb(var(--secondary))',
  accent: 'rgb(var(--accent))',
  
  // Semantic colors
  surface: 'rgb(var(--surface))',
  'surface-alt': 'rgb(var(--surface-alt))',
  
  // Text colors
  'text-neutral': 'rgb(var(--text-neutral))',
  'text-colored': 'rgb(var(--text-colored))',
  'text-colored-alt': 'rgb(var(--text-colored-alt))',
  
  // Icon colors
  'icon-neutral': 'rgb(var(--icon-neutral))',
  'icon-colored': 'rgb(var(--icon-colored))',
  'icon-colored-alt': 'rgb(var(--icon-colored-alt))',
  
  // Control colors
  'control-bg': 'rgb(var(--control-bg))',
  'control-bg-hover': 'rgb(var(--control-bg-hover))',
  'control-text': 'rgb(var(--control-text))',
  
  // Input colors
  'input-bg': 'rgb(var(--input-bg))',
  'input-border': 'rgb(var(--input-border))',
  'input-placeholder': 'rgb(var(--input-placeholder))',
  
  // Border colors
  border: 'rgb(var(--border))',
  'border-alt': 'rgb(var(--border-alt))',
  divider: 'rgb(var(--divider))',
  
  // Link colors
  link: 'rgb(var(--link))',
  'link-hover': 'rgb(var(--link-hover))',
  'link-active': 'rgb(var(--link-active))',
  
  // Intent colors
  'intent-success': '#82B46E',
  'intent-success-hover': '#6EA05A',
  'intent-warning': '#FFBE50',
  'intent-warning-hover': '#F0AA3C',
  'intent-danger': '#E6786E',
  'intent-danger-hover': '#D2645A',
};

// Utility functions
export const getColorByValue = (value, colorScale = COLORS.primary) => {
  const values = Object.values(colorScale);
  const index = Math.round((value / 100) * (values.length - 1));
  return values[Math.min(index, values.length - 1)];
};

export const getStatusColor = (status) => {
  return STATUS_COLORS[status] || COLORS.neutral[500];
};

export const getRatingColor = (rating) => {
  return RATING_COLORS[rating] || COLORS.neutral[500];
};
