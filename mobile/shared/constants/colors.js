// Color constants for the Herbal Medicine System

export const COLORS = {
  // Primary brand colors (green theme)
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

  // Secondary colors
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

  // Success colors
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

  // Warning colors
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

  // Error colors
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

  // Info colors
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

  // Neutral colors
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

// Herb-specific colors
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

// Status colors
export const STATUS_COLORS = {
  active: COLORS.success[500],
  inactive: COLORS.neutral[400],
  pending: COLORS.warning[500],
  error: COLORS.error[500],
  success: COLORS.success[500],
  warning: COLORS.warning[500],
  info: COLORS.info[500],
};

// Rating colors
export const RATING_COLORS = {
  5: COLORS.success[500],
  4: COLORS.success[400],
  3: COLORS.warning[500],
  2: COLORS.warning[600],
  1: COLORS.error[500],
};

// Theme colors for different modes
export const THEME_COLORS = {
  light: {
    background: COLORS.white,
    surface: COLORS.neutral[50],
    text: COLORS.neutral[900],
    textSecondary: COLORS.neutral[600],
    border: COLORS.neutral[200],
    primary: COLORS.primary[500],
    primaryHover: COLORS.primary[600],
  },
  dark: {
    background: COLORS.neutral[900],
    surface: COLORS.neutral[800],
    text: COLORS.neutral[100],
    textSecondary: COLORS.neutral[400],
    border: COLORS.neutral[700],
    primary: COLORS.primary[400],
    primaryHover: COLORS.primary[300],
  },
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
