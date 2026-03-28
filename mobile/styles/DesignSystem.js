import { StyleSheet, Platform } from 'react-native';

export const Colors = {
  // Primary Palette (V2 Spec)
  softWhite: '#FAFAFA',
  deepForest: '#14532D',
  primaryGreen: '#10B981',
  sageGreen: '#D1E7DD',

  // Accents & State
  white: '#FFFFFF',
  black: '#111827',
  gray: '#9CA3AF',
  lightGray: '#F3F4F6',

  // Text
  textMain: '#111827',
  textSecondary: '#4B5563',
  textLight: '#9CA3AF',
  textInverse: '#FFFFFF',
};

export const Spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 40,
};

export const Radius = {
  sm: 8,
  md: 12,
  lg: 24, // V2 Spec: Large rounded corners
  xl: 32,
  pill: 999,
};

export const Shadows = {
  // Neumorphic Soft Shadow
  neumorphic: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 12,
    elevation: 2,
  },
  // Deep Shadow for Floating Elements
  floating: {
    shadowColor: '#14532D', // Updated to Spec color
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 8,
  },
};

export const Typography = {
  h1: {
    fontSize: 28,
    fontWeight: '800', // Spec Display weight
    color: Colors.textMain,
    letterSpacing: -0.5,
  },
  h2: {
    fontSize: 22,
    fontWeight: '800', // Spec Display weight
    color: Colors.textMain,
    letterSpacing: -0.3,
  },
  body: {
    fontSize: 15,
    fontWeight: '500', // Spec Body weight
    color: Colors.textSecondary,
    lineHeight: 22,
  },
  caption: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.textLight,
  },
};

export const Layout = {
  headerHeight: Platform.OS === 'ios' ? 100 : 80, // Total height including status bar
  safeAreaTop: Platform.OS === 'ios' ? 54 : 34,
};

export const SharedStyles = StyleSheet.create({
  card: {
    backgroundColor: Colors.white,
    borderRadius: Radius.lg,
    padding: Spacing.lg,
    ...Shadows.neumorphic,
  },
  sageCard: {
    backgroundColor: Colors.sageGreen,
    borderRadius: Radius.lg,
    padding: Spacing.lg,
    ...Shadows.neumorphic,
  },
  primaryButton: {
    backgroundColor: Colors.deepForest,
    borderRadius: Radius.pill,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.xl,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    ...Shadows.floating,
  },
  container: {
    flex: 1,
    backgroundColor: Colors.softWhite,
  }
});
