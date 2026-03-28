import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '../hooks/useAuth';
import api from '../services/api';
import { API_ENDPOINTS } from '../../../shared/constants/api-endpoints';

const PreferencesContext = createContext();

// Constants
const UI_PREFS_KEY = 'user_prefs_ui';
const DEFAULT_PREFS = {
  notifications: { email: true, system: true, blog: true },
  language: 'en',
  theme: 'theme1',
  darkMode: 'light',
  chatbot: { enabled: true },
  hideSidebar: false
};

export const usePreferences = () => {
  const context = useContext(PreferencesContext);
  if (!context) {
    throw new Error('usePreferences must be used within a PreferencesProvider');
  }
  return context;
};

export const PreferencesProvider = ({ children }) => {
  const { user, isAuthenticated } = useAuth();
  const preferencesRef = useRef(DEFAULT_PREFS);

  // Layer A: Load UI preferences from localStorage immediately (non-blocking)
  const [preferences, setPreferences] = useState(() => {
    try {
      const storedUi = localStorage.getItem(UI_PREFS_KEY);
      const uiPrefs = storedUi ? JSON.parse(storedUi) : {};
      return { ...DEFAULT_PREFS, ...uiPrefs };
    } catch (e) {
      return DEFAULT_PREFS;
    }
  });

  const [loading, setLoading] = useState(false);

  useEffect(() => {
    preferencesRef.current = preferences;
  }, [preferences]);

  // Sync UI preferences to document element classes.
  const applyUiPreferences = useCallback((prefs) => {
    const root = document.documentElement;

    root.classList.remove('theme1', 'theme2', 'theme8');

    if (prefs.theme === 'theme2') {
      root.classList.add('theme2');
    } else if (prefs.theme === 'theme8') {
      root.classList.add('theme8');
    }

    const shouldBeDark = prefs.darkMode === 'dark' ||
      (prefs.darkMode === 'auto' && window.matchMedia('(prefers-color-scheme: dark)').matches);

    if (shouldBeDark) {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }

    if (prefs.hideSidebar) {
      root.classList.add('hide-sidebar');
    } else {
      root.classList.remove('hide-sidebar');
    }
  }, []);

  // Effect to apply UI changes whenever prefs change
  useEffect(() => {
    applyUiPreferences(preferences);

    // Save UI-critical prefs to localStorage
    const uiPrefs = {
      theme: preferences.theme,
      darkMode: preferences.darkMode,
      language: preferences.language,
      hideSidebar: preferences.hideSidebar,
      chatbot: preferences.chatbot
    };
    localStorage.setItem(UI_PREFS_KEY, JSON.stringify(uiPrefs));
  }, [preferences, applyUiPreferences]);

  // Layer B: Sync account preferences from database when authenticated
  useEffect(() => {
    if (!isAuthenticated) return;

    const syncAccountPrefs = async () => {
      try {
        console.log('[PREF] Syncing account preferences...');
        const response = await api.get(API_ENDPOINTS.USERS.PROFILE);

        const payload = response?.data?.data || response?.data || {};
        const dbPrefs = payload?.preferences;
        if (dbPrefs && typeof dbPrefs === 'object') {

          setPreferences(prev => {
            // Start with DB prefs merged into previous state
            const merged = { ...prev, ...dbPrefs };

            // Explicitly prioritize local overrides for UI-critical settings
            // This ensures that if a user changes theme/sidebar locally, it doesn't get 
            // overwritten by stale DB data on reload before the DB sync happens.
            try {
              const localUi = JSON.parse(localStorage.getItem(UI_PREFS_KEY) || '{}');
              const uiKeys = ['theme', 'darkMode', 'chatbot', 'hideSidebar', 'language'];

              uiKeys.forEach(key => {
                // Only override if strictly present in local storage
                if (localUi[key] !== undefined) {
                  // Handle nested objects like chatbot
                  if (typeof localUi[key] === 'object' && merged[key] && !Array.isArray(localUi[key])) {
                    merged[key] = { ...merged[key], ...localUi[key] };
                  } else {
                    merged[key] = localUi[key];
                  }
                }
              });
            } catch (e) {
              console.warn('[PREF] Failed to apply local overrides:', e);
            }

            return merged;
          });

          console.log('[PREF] Sync complete');
        }
      } catch (error) {
        console.error('[PREF] Sync failed', error);
      }
    };

    syncAccountPrefs();
  }, [isAuthenticated]); // Only run on auth status change

  const updatePreferenceSection = useCallback(async (section, values) => {
    const previousPreferences = preferencesRef.current;
    const nextPreferences = {
      ...previousPreferences,
      [section]: typeof previousPreferences[section] === 'object'
        ? { ...previousPreferences[section], ...values }
        : values
    };

    // Optimistic local update first
    setPreferences(nextPreferences);

    // Save to DB immediately
    if (isAuthenticated) {
      try {
        await api.put(API_ENDPOINTS.USERS.PREFERENCES, {
          preferences: nextPreferences
        });
      } catch (error) {
        console.error('[PREF] Save failed:', error);
        setPreferences(previousPreferences);
      }
    }
  }, [isAuthenticated]);

  const setTheme = (theme) => updatePreferenceSection('theme', theme);
  const toggleSidebar = () => {
    // Use updatePreferenceSection to ensure it saves to DB
    const newValue = !preferences.hideSidebar;
    updatePreferenceSection('hideSidebar', newValue);
  };

  const value = {
    preferences,
    updatePreferenceSection,
    setTheme,
    toggleSidebar,
    loading: !isAuthenticated,
    // Convenience getters
    theme: preferences.theme,
    language: preferences.language,
    hideSidebar: preferences.hideSidebar,
    chatbotEnabled: preferences.chatbot?.enabled === true,
  };

  return (
    <PreferencesContext.Provider value={value}>
      {children}
    </PreferencesContext.Provider>
  );
};

export default PreferencesContext;
