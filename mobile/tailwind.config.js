/** @type {import('tailwindcss').Config} */
module.exports = {
  // NativeWind v4 requires this preset
  presets: [require("nativewind/preset")],
  content: [
    './App.{js,jsx,ts,tsx}',
    './app/**/*.{js,jsx,ts,tsx}',
    './components/**/*.{js,jsx,ts,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        primary: 'rgb(var(--color-primary) / <alpha-value>)',
        secondary: 'rgb(var(--color-secondary) / <alpha-value>)',
        accent: 'rgb(var(--color-accent) / <alpha-value>)',
        bg: 'rgb(var(--color-bg) / <alpha-value>)',
        text: 'rgb(var(--color-text) / <alpha-value>)',
        neutral: {
          0: 'rgb(var(--color-neutral-0) / <alpha-value>)',
          10: 'rgb(var(--color-neutral-10) / <alpha-value>)',
          20: 'rgb(var(--color-neutral-20) / <alpha-value>)',
          30: 'rgb(var(--color-neutral-30) / <alpha-value>)',
          40: 'rgb(var(--color-neutral-40) / <alpha-value>)',
        },
        intent: {
          success: {
            DEFAULT: 'rgb(var(--color-success) / <alpha-value>)',
            hover: 'rgb(var(--color-success-hover) / <alpha-value>)',
          },
          warning: {
            DEFAULT: 'rgb(var(--color-warning) / <alpha-value>)',
            hover: 'rgb(var(--color-warning-hover) / <alpha-value>)',
          },
          danger: {
            DEFAULT: 'rgb(var(--color-danger) / <alpha-value>)',
            hover: 'rgb(var(--color-danger-hover) / <alpha-value>)',
          },
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        display: ['Playfair Display', 'serif'],
      },
      borderRadius: {
        '4xl': '32px',
      },
      spacing: {
        '18': '4.5rem',
        '88': '22rem',
        '128': '32rem',
      },
      animation: {
        'fade-in': 'fadeIn 0.5s ease-in-out',
        'slide-up': 'slideUp 0.3s ease-out',
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: 0 },
          '100%': { opacity: 1 },
        },
        slideUp: {
          '0%': { transform: 'translateY(10px)', opacity: 0 },
          '100%': { transform: 'translateY(0)', opacity: 1 },
        },
      },
      screens: {
        'xs': '320px',
        'sm': '640px',
        'md': '768px',
        'lg': '1024px',
        'xl': '1280px',
      },
    },
  },
  plugins: [],
};
