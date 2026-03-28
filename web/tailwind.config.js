import typography from '@tailwindcss/typography';
import forms from '@tailwindcss/forms';
import aspectRatio from '@tailwindcss/aspect-ratio';

/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx,css}",
  ],
  theme: {
    fontSize: {
     '2xs': ['var(--font-size-2xs)', { lineHeight: '1.3',  letterSpacing: '0.08em' }],
     'xs':  ['var(--font-size-xs)',  { lineHeight: '1.4',  letterSpacing: '0'      }],
     'sm':  ['var(--font-size-sm)',  { lineHeight: '1.55', letterSpacing: '0'      }],
     'md':  ['var(--font-size-md)',  { lineHeight: '1.6',  letterSpacing: '0'      }],
     'lg':  ['var(--font-size-lg)',  { lineHeight: '1.25', letterSpacing: '-0.005em'}],
     'xl':  ['var(--font-size-xl)',  { lineHeight: '1.2',  letterSpacing: '-0.01em'}],
     '2xl': ['var(--font-size-2xl)', { lineHeight: '1.15', letterSpacing: '-0.015em'}],
     '3xl': ['var(--font-size-3xl)', { lineHeight: '1.1',  letterSpacing: '-0.02em'}],
     '4xl': ['var(--font-size-4xl)', { lineHeight: '1.1',  letterSpacing: '-0.025em'}],
     '5xl': ['var(--font-size-5xl)', { lineHeight: '1.05', letterSpacing: '-0.03em'}],
     '6xl': ['var(--font-size-6xl)', { lineHeight: '1.05', letterSpacing: '-0.035em'}],
     '7xl': ['var(--font-size-7xl)', { lineHeight: '1.05', letterSpacing: '-0.04em'}],
     '8xl': ['var(--font-size-8xl)', { lineHeight: '1.05', letterSpacing: '-0.045em'}],
     '9xl': ['var(--font-size-9xl)', { lineHeight: '1.05', letterSpacing: '-0.05em'}],
    },
    extend: {
      colors: {
        // ── BASE (60% — neutral canvas) ───────────────────────
        'base-primary': 'var(--base-primary)',
        'base-secondary': 'var(--base-secondary)',
        'base-tertiary': 'var(--base-tertiary)',

        // ── SURFACE (15% — tinted panels) ─────────────────────
        'surface-primary': 'var(--surface-primary)',
        'surface-secondary': 'var(--surface-secondary)',
        'surface-tertiary': 'var(--surface-tertiary)',
        'surface-brand': 'var(--surface-brand)',
        'surface-brand-strong': 'var(--surface-brand-strong)',
        'surface-accent': 'var(--surface-accent)',
        'surface-accent-strong': 'var(--surface-accent-strong)',
        'surface-success': 'var(--surface-success)',
        'surface-success-strong': 'var(--surface-success-strong)',
        'surface-warning': 'var(--surface-warning)',
        'surface-warning-strong': 'var(--surface-warning-strong)',
        'surface-danger': 'var(--surface-danger)',
        'surface-danger-strong': 'var(--surface-danger-strong)',
        'surface-info': 'var(--surface-info)',
        'surface-info-strong': 'var(--surface-info-strong)',

        // ── INTERACTIVE — IMPORTANCE = DARKNESS ───────────────
        // Neutral (most important — darkest/lightest)
        'interactive-neutral-primary': 'var(--interactive-neutral-primary)',
        'interactive-neutral-primary-hover': 'var(--interactive-neutral-primary-hover)',
        'interactive-neutral-primary-pressed': 'var(--interactive-neutral-primary-pressed)',
        'interactive-neutral-primary-disabled': 'var(--interactive-neutral-primary-disabled)',
        'interactive-neutral-secondary': 'var(--interactive-neutral-secondary)',
        'interactive-neutral-secondary-hover': 'var(--interactive-neutral-secondary-hover)',
        'interactive-neutral-secondary-pressed': 'var(--interactive-neutral-secondary-pressed)',
        
        // Accent (10% — high importance, primary CTAs)
        'interactive-accent-primary': 'var(--interactive-accent-primary)',
        'interactive-accent-primary-hover': 'var(--interactive-accent-primary-hover)',
        'interactive-accent-primary-pressed': 'var(--interactive-accent-primary-pressed)',
        'interactive-accent-primary-disabled': 'var(--interactive-accent-primary-disabled)',
        'interactive-accent-secondary': 'var(--interactive-accent-secondary)',
        'interactive-accent-secondary-hover': 'var(--interactive-accent-secondary-hover)',
        'interactive-accent-secondary-pressed': 'var(--interactive-accent-secondary-pressed)',
        'interactive-accent-secondary-disabled': 'var(--interactive-accent-secondary-disabled)',
        'interactive-accent-active': 'var(--interactive-accent-active)',
        'interactive-accent-progress': 'var(--interactive-accent-progress)',
        'interactive-accent-indicator': 'var(--interactive-accent-indicator)',

        // Brand (15% — mid importance, secondary CTAs)
        'interactive-brand-primary': 'var(--interactive-brand-primary)',
        'interactive-brand-primary-hover': 'var(--interactive-brand-primary-hover)',
        'interactive-brand-primary-pressed': 'var(--interactive-brand-primary-pressed)',
        'interactive-brand-primary-disabled': 'var(--interactive-brand-primary-disabled)',
        'interactive-brand-secondary': 'var(--interactive-brand-secondary)',
        'interactive-brand-secondary-hover': 'var(--interactive-brand-secondary-hover)',
        'interactive-brand-secondary-pressed': 'var(--interactive-brand-secondary-pressed)',
        'interactive-brand-secondary-disabled': 'var(--interactive-brand-secondary-disabled)',

        // Intent
        'interactive-success': 'var(--interactive-success)',
        'interactive-success-hover': 'var(--interactive-success-hover)',
        'interactive-success-pressed': 'var(--interactive-success-pressed)',
        'interactive-success-disabled': 'var(--interactive-success-disabled)',
        'interactive-warning': 'var(--interactive-warning)',
        'interactive-warning-hover': 'var(--interactive-warning-hover)',
        'interactive-warning-pressed': 'var(--interactive-warning-pressed)',
        'interactive-warning-disabled': 'var(--interactive-warning-disabled)',
        'interactive-danger': 'var(--interactive-danger)',
        'interactive-danger-hover': 'var(--interactive-danger-hover)',
        'interactive-danger-pressed': 'var(--interactive-danger-pressed)',
        'interactive-danger-disabled': 'var(--interactive-danger-disabled)',
        'interactive-info': 'var(--interactive-info)',
        'interactive-info-hover': 'var(--interactive-info-hover)',
        'interactive-info-pressed': 'var(--interactive-info-pressed)',
        'interactive-info-disabled': 'var(--interactive-info-disabled)',

        // ── TEXT ──────────────────────────────────────────────
        'strong': 'var(--text-strong)',
        'primary': 'var(--text-primary)',
        'secondary': 'var(--text-secondary)',
        'tertiary': 'var(--text-tertiary)',
        'weak': 'var(--text-weak)',
        'weakest': 'var(--text-weakest)',
        'placeholder': 'var(--text-placeholder)',
        'disabled': 'var(--text-disabled)',
        'on-brand': 'var(--text-on-brand)',
        'on-accent': 'var(--text-on-accent)',
        'on-neutral': 'var(--text-on-neutral)',
        'on-dark': 'var(--text-on-dark)',
        'on-success': 'var(--text-on-success)',
        'on-warning': 'var(--text-on-warning)',
        'on-danger': 'var(--text-on-danger)',
        'on-info': 'var(--text-on-info)',
        'accent': 'var(--text-accent)',
        'accent-hover': 'var(--text-accent-hover)',
        'accent-pressed': 'var(--text-accent-pressed)',
        'brand': 'var(--text-brand)',
        'brand-hover': 'var(--text-brand-hover)',
        'brand-pressed': 'var(--text-brand-pressed)',
        'link': 'var(--text-accent)',
        'link-hover': 'var(--text-accent-hover)',

        // ── ICON ──────────────────────────────────────────────
        'icon-primary': 'var(--icon-primary)',
        'icon-secondary': 'var(--icon-secondary)',
        'icon-tertiary': 'var(--icon-tertiary)',
        'icon-weak': 'var(--icon-weak)',
        'icon-disabled': 'var(--icon-disabled)',
        'icon-brand': 'var(--icon-brand)',
        'icon-brand-hover': 'var(--icon-brand-hover)',
        'icon-brand-pressed': 'var(--icon-brand-pressed)',
        'icon-on-brand': 'var(--icon-on-brand)',
        'icon-accent': 'var(--icon-accent)',
        'icon-accent-hover': 'var(--icon-accent-hover)',
        'icon-accent-pressed': 'var(--icon-accent-pressed)',
        'icon-on-accent': 'var(--icon-on-accent)',
        'icon-on-neutral': 'var(--icon-on-neutral)',
        'icon-success': 'var(--icon-success)',
        'icon-warning': 'var(--icon-warning)',
        'icon-danger': 'var(--icon-danger)',
        'icon-info': 'var(--icon-info)',

        // ── BORDER ────────────────────────────────────────────
        'border-strong': 'var(--border-strong)',
        'border-primary': 'var(--border-primary)',
        'border-secondary': 'var(--border-secondary)',
        'border-weak': 'var(--border-weak)',
        'border-weakest': 'var(--border-weakest)',
        'border-disabled': 'var(--border-disabled)',
        'border-brand': 'var(--border-brand)',
        'border-brand-hover': 'var(--border-brand-hover)',
        'border-focus': 'var(--border-focus)',
        'border-accent': 'var(--border-accent)',
        'border-accent-hover': 'var(--border-accent-hover)',
        'border-success': 'var(--border-success)',
        'border-warning': 'var(--border-warning)',
        'border-danger': 'var(--border-danger)',
        'border-info': 'var(--border-info)',

        // ── INTENT (standalone for utilities) ─────────────────
        'success': 'var(--border-success)',
        'warning': 'var(--border-warning)',
        'danger': 'var(--border-danger)',
        'info': 'var(--border-info)',

        // ── ROLE COLORS ───────────────────────────────────────────
        'role-op': 'var(--text-role-op)',
        'role-admin': 'var(--text-role-admin)',
        'role-moderator': 'var(--text-role-moderator)',
        'role-expert': 'var(--text-role-expert)',

        // ── CHART COLORS (OKLCH perceptually uniform) ─────────
        'chart-1': 'var(--chart-1)',
        'chart-2': 'var(--chart-2)',
        'chart-3': 'var(--chart-3)',
        'chart-4': 'var(--chart-4)',
        'chart-5': 'var(--chart-5)',
        'chart-6': 'var(--chart-6)',
        'chart-7': 'var(--chart-7)',
        'chart-8': 'var(--chart-8)',
        'chart-9': 'var(--chart-9)',
        'chart-10': 'var(--chart-10)',
        'chart-11': 'var(--chart-11)',
        'chart-12': 'var(--chart-12)',
      },

      ringColor: {
        DEFAULT: 'var(--border-focus)',
      },

      fontFamily: {
        sans: ['var(--font-core)'],
        serif: ['var(--font-display)'],
        display: ['var(--font-display)'],
        accent: ['var(--font-accent)'],
        mono: ['var(--font-mono)'],
      },

      animation: {
        'fade-in': 'fadeIn 0.5s ease-in-out',
        'slide-up': 'slideUp 0.3s ease-out',
        'fade-out': 'fadeOut 0.5s ease-in-out',
      },

      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        fadeOut: {
          '0%': { opacity: '1', transform: 'translateX(0)' },
          '70%': { opacity: '1', transform: 'translateX(0)' },
          '100%': { opacity: '0', transform: 'translateX(20px)' },
        },
        slideUp: {
          '0%': { transform: 'translateY(10px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
      },

    },
  },

  plugins: [
    typography,
    forms,
    aspectRatio,
  ],
}
