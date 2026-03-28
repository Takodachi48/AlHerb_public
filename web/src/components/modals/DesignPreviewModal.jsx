import React, { useState, useEffect } from 'react';
import PropTypes from 'prop-types';
import { usePreferences } from '../../context/PreferencesContext';
import { useToast } from '../../hooks/useToast';
import Loading from '../common/Loading';
import GlobalLoader from '../GlobalLoader';
import TabNavigation from '../common/TabNavigation';
import DatePicker from '../common/DatePicker';

const semanticsData = {
  base: [
    '--color-base-primary',
    '--color-base-secondary',
    '--color-base-tertiary'
  ],
  surface: [
    '--color-surface-primary',
    '--color-surface-secondary',
    '--color-surface-tertiary',
    '--color-surface-brand',
    '--color-surface-brand-strong',
    '--color-surface-accent',
    '--color-surface-accent-strong',
    '--color-neutral-subtle'
  ],
  text: [
    '--color-text-strong',
    '--color-text-primary',
    '--color-text-secondary',
    '--color-text-tertiary',
    '--color-text-weak',
    '--color-text-weakest',
    '--color-text-placeholder',
    '--color-text-disabled',
    '--color-text-on-brand',
    '--color-text-on-accent',
    '--color-text-on-neutral',
    '--color-text-on-neutral-alt',
    '--color-text-on-dark',
    '--color-text-brand',
    '--color-text-brand-hover',
    '--color-text-brand-pressed',
    '--color-text-accent',
    '--color-text-accent-hover',
    '--color-text-accent-pressed'
  ],
  icon: [
    '--color-icon-primary',
    '--color-icon-secondary',
    '--color-icon-tertiary',
    '--color-icon-weak',
    '--color-icon-disabled',
    '--color-icon-brand',
    '--color-icon-brand-hover',
    '--color-icon-brand-pressed',
    '--color-icon-on-brand',
    '--color-icon-accent',
    '--color-icon-accent-hover',
    '--color-icon-accent-pressed',
    '--color-icon-on-accent',
    '--color-icon-on-neutral'
  ],
  border: [
    '--color-border-strong',
    '--color-border-primary',
    '--color-border-secondary',
    '--color-border-weak',
    '--color-border-weakest',
    '--color-border-disabled',
    '--color-border-brand',
    '--color-border-brand-hover',
    '--color-border-focus',
    '--color-border-accent',
    '--color-border-accent-hover'
  ],
  interactive: [
    '--color-neutral-primary',
    '--color-neutral-primary-hover',
    '--color-neutral-primary-pressed',
    '--color-neutral-primary-disabled',
    '--color-neutral-secondary',
    '--color-neutral-secondary-hover',
    '--color-neutral-secondary-pressed',
    '--color-neutral-secondary-disabled',
    '--color-accent-primary',
    '--color-accent-primary-hover',
    '--color-accent-primary-pressed',
    '--color-accent-primary-focus',
    '--color-accent-primary-disabled',
    '--color-accent-secondary',
    '--color-accent-secondary-hover',
    '--color-accent-secondary-pressed',
    '--color-accent-secondary-disabled',
    '--color-accent-active',
    '--color-accent-active-text',
    '--color-accent-progress',
    '--color-accent-indicator',
    '--color-brand-primary',
    '--color-brand-primary-hover',
    '--color-brand-primary-pressed',
    '--color-brand-primary-focus',
    '--color-brand-primary-disabled',
    '--color-brand-secondary',
    '--color-brand-secondary-hover',
    '--color-brand-secondary-pressed',
    '--color-brand-secondary-disabled'
  ],
  intent: [
    '--color-intent-success',
    '--color-intent-success-strong',
    '--color-intent-success-weak',
    '--color-intent-success-weakest',
    '--color-intent-success-text',
    '--color-intent-success-text-on',
    '--color-intent-success-border',
    '--color-intent-success-icon',
    '--color-intent-success-hover',
    '--color-intent-success-pressed',
    '--color-intent-success-disabled',
    '--color-intent-warning',
    '--color-intent-warning-strong',
    '--color-intent-warning-weak',
    '--color-intent-warning-weakest',
    '--color-intent-warning-text',
    '--color-intent-warning-text-on',
    '--color-intent-warning-border',
    '--color-intent-warning-icon',
    '--color-intent-warning-hover',
    '--color-intent-warning-pressed',
    '--color-intent-warning-disabled',
    '--color-intent-danger',
    '--color-intent-danger-strong',
    '--color-intent-danger-weak',
    '--color-intent-danger-weakest',
    '--color-intent-danger-text',
    '--color-intent-danger-text-on',
    '--color-intent-danger-border',
    '--color-intent-danger-icon',
    '--color-intent-danger-hover',
    '--color-intent-danger-pressed',
    '--color-intent-danger-disabled',
    '--color-intent-info',
    '--color-intent-info-strong',
    '--color-intent-info-weak',
    '--color-intent-info-weakest',
    '--color-intent-info-text',
    '--color-intent-info-text-on',
    '--color-intent-info-border',
    '--color-intent-info-icon',
    '--color-intent-info-hover',
    '--color-intent-info-pressed',
    '--color-intent-info-disabled'
  ],
  chart: Array.from({ length: 12 }, (_, i) => `--color-chart-${i + 1}`),
  tabNavigation: [], // Tab Navigation component variants
  datePicker: [], // Date Picker component variants
  loading: [] // Loading component variants
};

const tabLabels = {
  tabNavigation: 'Tab Navigation',
  datePicker: 'Date Picker',
  loading: 'Loading'
};

const rampMap = {
  // Base
  '--color-base-primary': '--neutral-50',
  '--color-base-secondary': '--neutral-100',
  '--color-base-tertiary': '--neutral-200',
  // Surface
  '--color-surface-primary': '--brand-50',
  '--color-surface-secondary': '--brand-100',
  '--color-surface-tertiary': '--brand-200',
  '--color-surface-brand': '--brand-50',
  '--color-surface-brand-strong': '--brand-100',
  '--color-surface-accent': '--accent-50',
  '--color-surface-accent-strong': '--accent-100',
  '--color-neutral-subtle': '--neutral-400',
  // Text
  '--color-text-strong': '--neutral-950',
  '--color-text-primary': '--neutral-900',
  '--color-text-secondary': '--neutral-700',
  '--color-text-tertiary': '--neutral-500',
  '--color-text-weak': '--neutral-400',
  '--color-text-weakest': '--neutral-300',
  '--color-text-placeholder': '--neutral-400',
  '--color-text-disabled': '--neutral-300',
  '--color-text-on-brand': '--neutral-950',
  '--color-text-on-accent': '--neutral-950',
  '--color-text-on-neutral': '--neutral-50',
  '--color-text-on-neutral-alt': '--neutral-950',
  '--color-text-on-dark': '--neutral-50',
  '--color-text-brand': '--brand-600',
  '--color-text-brand-hover': '--brand-700',
  '--color-text-brand-pressed': '--brand-800',
  '--color-text-accent': '--accent-600',
  '--color-text-accent-hover': '--accent-700',
  '--color-text-accent-pressed': '--accent-800',
  // Icon
  '--color-icon-primary': '--neutral-800',
  '--color-icon-secondary': '--neutral-600',
  '--color-icon-tertiary': '--neutral-400',
  '--color-icon-weak': '--neutral-300',
  '--color-icon-disabled': '--neutral-300',
  '--color-icon-brand': '--brand-500',
  '--color-icon-brand-hover': '--brand-600',
  '--color-icon-brand-pressed': '--brand-700',
  '--color-icon-on-brand': '--neutral-950',
  '--color-icon-accent': '--accent-500',
  '--color-icon-accent-hover': '--accent-600',
  '--color-icon-accent-pressed': '--accent-700',
  '--color-icon-on-accent': '--neutral-950',
  '--color-icon-on-neutral': '--neutral-50',
  // Border
  '--color-border-strong': '--neutral-300',
  '--color-border-primary': '--neutral-200',
  '--color-border-secondary': '--neutral-100',
  '--color-border-weak': '--neutral-100',
  '--color-border-weakest': '--neutral-50',
  '--color-border-disabled': '--neutral-200',
  '--color-border-brand': '--brand-300',
  '--color-border-brand-hover': '--brand-400',
  '--color-border-focus': '--accent-500',
  '--color-border-accent': '--accent-400',
  '--color-border-accent-hover': '--accent-500',
  // Interactive
  '--color-neutral-primary': '--neutral-900',
  '--color-neutral-primary-hover': '--neutral-950',
  '--color-neutral-primary-pressed': '--neutral-950',
  '--color-neutral-primary-disabled': '--neutral-300',
  '--color-neutral-secondary': '--neutral-100',
  '--color-neutral-secondary-hover': '--neutral-200',
  '--color-neutral-secondary-pressed': '--neutral-300',
  '--color-neutral-secondary-disabled': '--neutral-50',
  '--color-accent-primary': '--accent-600',
  '--color-accent-primary-hover': '--accent-700',
  '--color-accent-primary-pressed': '--accent-800',
  '--color-accent-primary-focus': '--accent-600',
  '--color-accent-primary-disabled': '--accent-200',
  '--color-accent-secondary': '--accent-100',
  '--color-accent-secondary-hover': '--accent-200',
  '--color-accent-secondary-pressed': '--accent-300',
  '--color-accent-secondary-disabled': '--accent-50',
  '--color-accent-active': '--accent-600',
  '--color-accent-active-text': '--neutral-50',
  '--color-accent-progress': '--accent-600',
  '--color-accent-indicator': '--accent-500',
  '--color-brand-primary': '--brand-500',
  '--color-brand-primary-hover': '--brand-600',
  '--color-brand-primary-pressed': '--brand-700',
  '--color-brand-primary-focus': '--brand-500',
  '--color-brand-primary-disabled': '--brand-200',
  '--color-brand-secondary': '--brand-100',
  '--color-brand-secondary-hover': '--brand-200',
  '--color-brand-secondary-pressed': '--brand-300',
  '--color-brand-secondary-disabled': '--brand-50',
  // Intent
  '--color-intent-success': '--intent-success-400',
  '--color-intent-success-strong': '--intent-success-600',
  '--color-intent-success-weak': '--intent-success-200',
  '--color-intent-success-weakest': '--intent-success-50',
  '--color-intent-success-text': '--intent-success-700',
  '--color-intent-success-text-on': '--intent-success-50',
  '--color-intent-success-border': '--intent-success-300',
  '--color-intent-success-icon': '--intent-success-500',
  '--color-intent-success-hover': '--intent-success-500',
  '--color-intent-success-pressed': '--intent-success-600',
  '--color-intent-success-disabled': '--intent-success-200',
  '--color-intent-warning': '--intent-warning-300',
  '--color-intent-warning-strong': '--intent-warning-500',
  '--color-intent-warning-weak': '--intent-warning-100',
  '--color-intent-warning-weakest': '--intent-warning-50',
  '--color-intent-warning-text': '--intent-warning-700',
  '--color-intent-warning-text-on': '--intent-warning-950',
  '--color-intent-warning-border': '--intent-warning-200',
  '--color-intent-warning-icon': '--intent-warning-500',
  '--color-intent-warning-hover': '--intent-warning-400',
  '--color-intent-warning-pressed': '--intent-warning-500',
  '--color-intent-warning-disabled': '--intent-warning-100',
  '--color-intent-danger': '--intent-danger-400',
  '--color-intent-danger-strong': '--intent-danger-600',
  '--color-intent-danger-weak': '--intent-danger-100',
  '--color-intent-danger-weakest': '--intent-danger-50',
  '--color-intent-danger-text': '--intent-danger-700',
  '--color-intent-danger-text-on': '--intent-danger-50',
  '--color-intent-danger-border': '--intent-danger-200',
  '--color-intent-danger-icon': '--intent-danger-500',
  '--color-intent-danger-hover': '--intent-danger-500',
  '--color-intent-danger-pressed': '--intent-danger-600',
  '--color-intent-danger-disabled': '--intent-danger-100',
  '--color-intent-info': '--intent-info-500',
  '--color-intent-info-strong': '--intent-info-700',
  '--color-intent-info-weak': '--intent-info-100',
  '--color-intent-info-weakest': '--intent-info-50',
  '--color-intent-info-text': '--intent-info-700',
  '--color-intent-info-text-on': '--intent-info-50',
  '--color-intent-info-border': '--intent-info-200',
  '--color-intent-info-icon': '--intent-info-500',
  '--color-intent-info-hover': '--intent-info-600',
  '--color-intent-info-pressed': '--intent-info-700',
  '--color-intent-info-disabled': '--intent-info-100',
  // Chart
  ...Array.from({ length: 12 }, (_, i) => ({ [`--color-chart-${i + 1}`]: `oklch(0.65 0.15 ${i * 30})` })).reduce((acc, obj) => ({ ...acc, ...obj }), {})
};

const darkRampMap = {
  // Base
  '--color-base-primary': '--neutral-950',
  '--color-base-secondary': '--neutral-900',
  '--color-base-tertiary': '--neutral-800',
  // Surface
  '--color-surface-primary': '--brand-900',
  '--color-surface-secondary': '--brand-800',
  '--color-surface-tertiary': '--brand-700',
  '--color-surface-brand': '--brand-950',
  '--color-surface-brand-strong': '--brand-900',
  '--color-surface-accent': '--accent-950',
  '--color-surface-accent-strong': '--accent-900',
  '--color-neutral-subtle': '--neutral-600',
  // Text
  '--color-text-strong': '--neutral-50',
  '--color-text-primary': '--neutral-100',
  '--color-text-secondary': '--neutral-300',
  '--color-text-tertiary': '--neutral-500',
  '--color-text-weak': '--neutral-600',
  '--color-text-weakest': '--neutral-700',
  '--color-text-placeholder': '--neutral-500',
  '--color-text-disabled': '--neutral-600',
  '--color-text-on-brand': '--neutral-950',
  '--color-text-on-accent': '--neutral-950',
  '--color-text-on-neutral': '--neutral-950',
  '--color-text-on-neutral-alt': '--neutral-50',
  '--color-text-on-dark': '--neutral-50',
  '--color-text-brand': '--brand-300',
  '--color-text-brand-hover': '--brand-200',
  '--color-text-brand-pressed': '--brand-100',
  '--color-text-accent': '--accent-300',
  '--color-text-accent-hover': '--accent-200',
  '--color-text-accent-pressed': '--accent-100',
  // Icon
  '--color-icon-primary': '--neutral-200',
  '--color-icon-secondary': '--neutral-400',
  '--color-icon-tertiary': '--neutral-600',
  '--color-icon-weak': '--neutral-700',
  '--color-icon-disabled': '--neutral-700',
  '--color-icon-brand': '--brand-300',
  '--color-icon-brand-hover': '--brand-200',
  '--color-icon-brand-pressed': '--brand-100',
  '--color-icon-on-brand': '--neutral-950',
  '--color-icon-accent': '--accent-300',
  '--color-icon-accent-hover': '--accent-200',
  '--color-icon-accent-pressed': '--accent-100',
  '--color-icon-on-accent': '--neutral-950',
  '--color-icon-on-neutral': '--neutral-950',
  // Border
  '--color-border-strong': '--neutral-600',
  '--color-border-primary': '--neutral-700',
  '--color-border-secondary': '--neutral-800',
  '--color-border-weak': '--neutral-800',
  '--color-border-weakest': '--neutral-900',
  '--color-border-disabled': '--neutral-700',
  '--color-border-brand': '--brand-700',
  '--color-border-brand-hover': '--brand-600',
  '--color-border-focus': '--accent-400',
  '--color-border-accent': '--accent-600',
  '--color-border-accent-hover': '--accent-500',
  // Interactive
  '--color-neutral-primary': '--neutral-100',
  '--color-neutral-primary-hover': '--neutral-50',
  '--color-neutral-primary-pressed': '--neutral-50',
  '--color-neutral-primary-disabled': '--neutral-700',
  '--color-neutral-secondary': '--neutral-800',
  '--color-neutral-secondary-hover': '--neutral-700',
  '--color-neutral-secondary-pressed': '--neutral-600',
  '--color-neutral-secondary-disabled': '--neutral-900',
  '--color-accent-primary': '--accent-300',
  '--color-accent-primary-hover': '--accent-200',
  '--color-accent-primary-pressed': '--accent-100',
  '--color-accent-primary-focus': '--accent-300',
  '--color-accent-primary-disabled': '--accent-700',
  '--color-accent-secondary': '--accent-800',
  '--color-accent-secondary-hover': '--accent-700',
  '--color-accent-secondary-pressed': '--accent-600',
  '--color-accent-secondary-disabled': '--accent-900',
  '--color-accent-active': '--accent-300',
  '--color-accent-active-text': '--neutral-950',
  '--color-accent-progress': '--accent-300',
  '--color-accent-indicator': '--accent-400',
  '--color-brand-primary': '--brand-400',
  '--color-brand-primary-hover': '--brand-300',
  '--color-brand-primary-pressed': '--brand-200',
  '--color-brand-primary-focus': '--brand-400',
  '--color-brand-primary-disabled': '--brand-700',
  '--color-brand-secondary': '--brand-800',
  '--color-brand-secondary-hover': '--brand-700',
  '--color-brand-secondary-pressed': '--brand-600',
  '--color-brand-secondary-disabled': '--brand-900',
  // Intent (same as light, since intent is luminance-agnostic)
  '--color-intent-success': '--intent-success-400',
  '--color-intent-success-strong': '--intent-success-600',
  '--color-intent-success-weak': '--intent-success-200',
  '--color-intent-success-weakest': '--intent-success-50',
  '--color-intent-success-text': '--intent-success-700',
  '--color-intent-success-text-on': '--intent-success-50',
  '--color-intent-success-border': '--intent-success-300',
  '--color-intent-success-icon': '--intent-success-500',
  '--color-intent-success-hover': '--intent-success-500',
  '--color-intent-success-pressed': '--intent-success-600',
  '--color-intent-success-disabled': '--intent-success-200',
  '--color-intent-warning': '--intent-warning-300',
  '--color-intent-warning-strong': '--intent-warning-500',
  '--color-intent-warning-weak': '--intent-warning-100',
  '--color-intent-warning-weakest': '--intent-warning-50',
  '--color-intent-warning-text': '--intent-warning-700',
  '--color-intent-warning-text-on': '--intent-warning-950',
  '--color-intent-warning-border': '--intent-warning-200',
  '--color-intent-warning-icon': '--intent-warning-500',
  '--color-intent-warning-hover': '--intent-warning-400',
  '--color-intent-warning-pressed': '--intent-warning-500',
  '--color-intent-warning-disabled': '--intent-warning-100',
  '--color-intent-danger': '--intent-danger-400',
  '--color-intent-danger-strong': '--intent-danger-600',
  '--color-intent-danger-weak': '--intent-danger-100',
  '--color-intent-danger-weakest': '--intent-danger-50',
  '--color-intent-danger-text': '--intent-danger-700',
  '--color-intent-danger-text-on': '--intent-danger-50',
  '--color-intent-danger-border': '--intent-danger-200',
  '--color-intent-danger-icon': '--intent-danger-500',
  '--color-intent-danger-hover': '--intent-danger-500',
  '--color-intent-danger-pressed': '--intent-danger-600',
  '--color-intent-danger-disabled': '--intent-danger-100',
  '--color-intent-info': '--intent-info-500',
  '--color-intent-info-strong': '--intent-info-700',
  '--color-intent-info-weak': '--intent-info-100',
  '--color-intent-info-weakest': '--intent-info-50',
  '--color-intent-info-text': '--intent-info-700',
  '--color-intent-info-text-on': '--intent-info-50',
  '--color-intent-info-border': '--intent-info-200',
  '--color-intent-info-icon': '--intent-info-500',
  '--color-intent-info-hover': '--intent-info-600',
  '--color-intent-info-pressed': '--intent-info-700',
  '--color-intent-info-disabled': '--intent-info-100',
  // Chart
  ...Array.from({ length: 12 }, (_, i) => ({ [`--color-chart-${i + 1}`]: `oklch(0.72 0.14 ${i * 30})` })).reduce((acc, obj) => ({ ...acc, ...obj }), {})
};

const DesignPreviewModal = ({ isOpen, onClose }) => {
  const [activeTab, setActiveTab] = useState('base');
  const [values, setValues] = useState({});
  const [isLoadingPopoverOpen, setIsLoadingPopoverOpen] = useState(false);
  const [fullpageDone, setFullpageDone] = useState(false);
  const [fullpageCompleteRequested, setFullpageCompleteRequested] = useState(false);
  const [fullpageResetKey, setFullpageResetKey] = useState(0);
  const [fullscreenOpen, setFullscreenOpen] = useState(false);
  const [fullscreenDone, setFullscreenDone] = useState(false);
  const [fullscreenCompleteRequested, setFullscreenCompleteRequested] = useState(false);
  const [fullscreenResetKey, setFullscreenResetKey] = useState(0);
  const [globalLoaderVisible, setGlobalLoaderVisible] = useState(false);
  const [globalLoaderProgress, setGlobalLoaderProgress] = useState(0);
  const { preferences, updatePreferenceSection } = usePreferences();
  const toast = useToast();

  const toggleDarkMode = () => {
    const newMode = preferences.darkMode === 'dark' ? 'light' : 'dark';
    updatePreferenceSection('darkMode', newMode);
  };

  const triggerRandomToast = () => {
    const types = ['success', 'error', 'warning', 'info'];
    const randomType = types[Math.floor(Math.random() * types.length)];
    const toastMethod = toast[randomType];
    if (typeof toastMethod === 'function') {
      toastMethod('Random notification!');
    }
  };

  const loadingVariants = [
    { size: 'small', variant: 'inline', animation: 'chaotic', text: 'Small loading...' },
    { size: 'medium', variant: 'inline', animation: 'chaotic', text: 'Medium loading...' },
    { size: 'large', variant: 'inline', animation: 'chaotic', text: 'Large loading...' },
    { size: 'medium', variant: 'inline', animation: 'bouncing', text: 'Bouncing animation...' },
    { size: 'medium', variant: 'card', animation: 'chaotic', text: 'Card variant...' },
    { size: 'medium', variant: 'centered', animation: 'chaotic', text: 'Centered variant...' },
  ];

  useEffect(() => {
    setTimeout(() => {
      const computed = getComputedStyle(document.documentElement);
      const newValues = {};
      for (const varName of Object.values(semanticsData).flat()) {
        newValues[varName] = computed.getPropertyValue(varName);
      }
      setValues(newValues);
    }, 0);
  }, [isOpen, preferences.darkMode]);

  if (!isOpen) return null;

  const isColor = (value) => {
    return value.startsWith('#') || value.startsWith('rgb') || value.startsWith('hsl') || value.startsWith('oklch') || value.startsWith('var(');
  };

  const renderContent = () => {
    if (activeTab === 'tabNavigation') {
      const tabItems = [
        { id: 'overview', label: 'Overview', badge: '3' },
        { id: 'settings', label: 'Settings' },
        { id: 'profile', label: 'Profile' },
      ];

      return (
        <div className="space-y-8">
          <div>
            <h3 className="text-lg font-semibold text-primary mb-4">Panel Variant</h3>
            <TabNavigation
              items={tabItems}
              value="overview"
              variant="panel"
              renderPanel={(item) => <div className="p-4">{item.label} Content</div>}
            />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-primary mb-4">Line Variant</h3>
            <TabNavigation
              items={tabItems}
              value="settings"
              variant="line"
            />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-primary mb-4">Chip Variant</h3>
            <TabNavigation
              items={tabItems}
              value="profile"
              variant="chip"
            />
          </div>
        </div>
      );
    }

    if (activeTab === 'loading') {
      return (
        <div className="space-y-8">
          <div>
            <h3 className="text-lg font-semibold text-primary mb-4">Inline Variants</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="p-4 border border-border-secondary rounded">
                <Loading size="small" variant="inline" animation="chaotic" text="Small loading..." />
              </div>
              <div className="p-4 border border-border-secondary rounded">
                <Loading size="medium" variant="inline" animation="chaotic" text="Medium loading..." />
              </div>
              <div className="p-4 border border-border-secondary rounded">
                <Loading size="large" variant="inline" animation="chaotic" text="Large loading..." />
              </div>
            </div>
          </div>
          <div>
            <h3 className="text-lg font-semibold text-primary mb-4">Animation Variants</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-4 border border-border-secondary rounded">
                <Loading size="medium" variant="inline" animation="chaotic" text="Chaotic animation..." />
              </div>
              <div className="p-4 border border-border-secondary rounded">
                <Loading size="medium" variant="inline" animation="bouncing" text="Bouncing animation..." />
              </div>
            </div>
          </div>
          <div>
            <h3 className="text-lg font-semibold text-primary mb-4">Layout Variants</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-4 border border-border-secondary rounded">
                <Loading size="medium" variant="card" animation="chaotic" text="Card variant..." />
              </div>
              <div className="p-4 border border-border-secondary rounded">
                <Loading size="medium" variant="centered" animation="chaotic" text="Centered variant..." />
              </div>
            </div>
          </div>
          <div>
            <h3 className="text-lg font-semibold text-primary mb-4">Fullscreen Progress</h3>
            <div className="space-y-4">
              <button
                onClick={() => {
                  setFullscreenOpen(true);
                  setFullscreenDone(false);
                  setFullscreenCompleteRequested(false);
                  setFullscreenResetKey(prev => prev + 1);
                }}
                className="px-4 py-2 bg-accent-primary text-text-on-accent hover:bg-accent-primary-hover rounded transition-colors"
              >
                Trigger Fullscreen Loading
              </button>
              <button
                onClick={() => {
                  setFullscreenCompleteRequested(true);
                }}
                disabled={!fullscreenOpen || fullscreenDone}
                className="px-4 py-2 bg-accent-secondary text-text-primary hover:bg-accent-secondary-hover rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed ml-2"
              >
                Complete Loading
              </button>
            </div>
          </div>
          <div>
            <h3 className="text-lg font-semibold text-primary mb-4">Global Loader (Container)</h3>
            <div className="relative h-64 border border-border-secondary rounded overflow-hidden bg-surface-secondary">
              {globalLoaderVisible && (
                <div className="absolute inset-0">
                  <div className="fixed inset-0 z-[95] flex items-center justify-center bg-base-primary/95 backdrop-blur-sm">
                    <div className="w-[min(460px,88vw)] px-6">
                      <div className="mb-4 text-center text-sm text-secondary font-sans">
                        Loading application...
                      </div>
                      <div className="relative h-2 overflow-hidden rounded-full bg-surface-secondary">
                        <div
                          className="absolute inset-y-0 left-0 origin-left rounded-full bg-interactive-accent-primary shadow-[0_0_14px_color-mix(in_srgb,var(--interactive-accent-primary)_45%,transparent)] transition-transform duration-75"
                          style={{ transform: `scaleX(${globalLoaderProgress / 100})` }}
                        />
                        <div className="absolute inset-0 animate-pulse opacity-30" />
                      </div>
                      <div className="mt-3 text-center text-xs text-tertiary font-sans">{Math.round(globalLoaderProgress)}%</div>
                    </div>
                  </div>
                </div>
              )}
              <div className="flex items-center justify-center h-full">
                <div className="text-center">
                  <p className="text-tertiary mb-4">Container Content</p>
                  <button
                    onClick={() => {
                      setGlobalLoaderVisible(true);
                      setGlobalLoaderProgress(0);
                      const interval = setInterval(() => {
                        setGlobalLoaderProgress(prev => {
                          if (prev >= 95) {
                            clearInterval(interval);
                            setTimeout(() => setGlobalLoaderVisible(false), 500);
                            return prev;
                          }
                          return prev + Math.random() * 15;
                        });
                      }, 200);
                    }}
                    disabled={globalLoaderVisible}
                    className="px-4 py-2 bg-accent-primary text-text-on-accent hover:bg-accent-primary-hover rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Show Global Loader in Container
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      );
    }

    if (activeTab === 'datePicker') {
      return (
        <div className="space-y-8">
          <div>
            <h3 className="text-lg font-semibold text-primary mb-4">Production Period</h3>
            <DatePicker
              mode="range"
              variant="period"
              value={{ startDate: '2023-01-01', endDate: '2023-01-07', days: 7 }}
              onChange={() => {}}
              label="Date Range"
            />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-primary mb-4">Quick Select</h3>
            <DatePicker
              mode="range"
              variant="quick"
              value={{ startDate: '2023-01-01', endDate: '2023-01-07', days: 7 }}
              onChange={() => {}}
              label="Date Range"
            />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-primary mb-4">Variant A — Scroll Columns</h3>
            <DatePicker
              mode="birthdate"
              variant="scroll"
              value="1990-01-01"
              onChange={() => {}}
              label="Birthdate"
            />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-primary mb-4">Variant B — Steppers</h3>
            <DatePicker
              mode="birthdate"
              variant="stepper"
              value="1990-01-01"
              onChange={() => {}}
              label="Birthdate"
            />
          </div>
        </div>
      );
    }

    const variables = semanticsData[activeTab] || [];
    return (
      <table className="w-full table-auto border-collapse">
        <thead>
          <tr className="bg-surface-secondary">
            <th className="border border-border-secondary px-4 py-2 text-left">Variable</th>
            <th className="border border-border-secondary px-4 py-2 text-left">Light Ramp</th>
            <th className="border border-border-secondary px-4 py-2 text-left">Dark Ramp</th>
            <th className="border border-border-secondary px-4 py-2 text-left">Swatch</th>
          </tr>
        </thead>
        <tbody>
          {variables.map(varName => {
            const value = values[varName] || '';
            const displayName = varName.replace('--color-', '');
            const lightRamp = rampMap[varName] || '';
            const darkRamp = darkRampMap[varName] || '';
            return (
              <tr key={varName} className="hover:bg-surface-secondary">
                <td className="border border-border-secondary px-4 py-2 font-mono text-sm">{displayName}</td>
                <td className="border border-border-secondary px-4 py-2 font-mono text-sm">{lightRamp}</td>
                <td className="border border-border-secondary px-4 py-2 font-mono text-sm">{darkRamp}</td>
                <td className="border border-border-secondary px-4 py-2">
                  {isColor(value) && (
                    <div
                      className="w-8 h-8 border border-border-primary rounded"
                      style={{ backgroundColor: value }}
                      title={value}
                    />
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      {fullscreenOpen && !fullscreenDone && (
        <Loading
          key={`fullscreen-progress-${fullscreenResetKey}`}
          variant="fullscreen-progress"
          text="loading"
          complete={fullscreenCompleteRequested}
          onComplete={() => {
            setFullscreenDone(true);
            setTimeout(() => setFullscreenOpen(false), 50);
          }}
        />
      )}
      <div className="bg-surface-primary border border-border-primary rounded-lg shadow-lg max-w-6xl w-full max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border-secondary">
          <div className="flex space-x-2 overflow-x-auto">
            {Object.keys(semanticsData).map(tab => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`
                  relative px-4 py-2
                  text-sm font-medium capitalize tracking-wide
                  transition-all duration-500 ease-out
                  ${activeTab === tab
                    ? 'text-accent scale-110 -translate-y-0.5'
                    : 'text-secondary hover:text-accent scale-100 translate-y-0'
                  }
                `}
              >
                {tabLabels[tab] || tab}
              </button>
            ))}
          </div>
          <div className="flex space-x-2">
            <button
              onClick={toggleDarkMode}
              className="px-3 py-1 bg-surface-secondary text-text-primary hover:bg-surface-tertiary rounded transition-colors"
            >
              {preferences.darkMode === 'dark' ? 'Light' : 'Dark'}
            </button>
            <button
              onClick={triggerRandomToast}
              className="px-3 py-1 bg-accent-primary text-text-on-accent hover:bg-accent-primary-hover rounded transition-colors"
            >
              Random Toast
            </button>
          </div>
          <button
            onClick={onClose}
            className="text-text-primary hover:text-text-secondary text-2xl leading-none"
          >
            ×
          </button>
        </div>
        {/* Content */}
        <div className="p-4 overflow-auto max-h-[calc(90vh-120px)]">
          {renderContent()}
        </div>
      </div>
    </div>
  );
};

DesignPreviewModal.propTypes = {
  isOpen: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
};

export default DesignPreviewModal;
