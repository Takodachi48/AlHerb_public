import { usePreferences } from '../context/PreferencesContext';
import { useAuth } from '../hooks/useAuth';

export default function ThemeSwitcher() {
  const { preferences, updatePreferenceSection } = usePreferences();
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';

  if (!isAdmin) {
    return null;
  }

  const handleThemeChange = (newTheme) => {
    updatePreferenceSection('theme', newTheme);
  };

  const handleDarkModeChange = (e) => {
    updatePreferenceSection('darkMode', e.target.value);
  };

  return (
    <div className="flex items-center gap-4 p-4 bg-primary rounded-lg shadow">
      <div className="flex items-center gap-2">
        <label htmlFor="theme-select" className="text-sm font-medium text-text">
          Theme:
        </label>
        <select
          id="theme-select"
          value={preferences.theme || 'theme1'}
          onChange={(e) => handleThemeChange(e.target.value)}
          className="input text-sm"
        >
          <option value="theme1">Theme 1 (Warm)</option>
          <option value="theme2">Theme 2 (Cool)</option>
          <option value="theme8">Theme 8 (Violet)</option>
        </select>
      </div>

      <div className="flex items-center gap-2">
        <label htmlFor="dark-mode-select" className="text-sm font-medium text-text">
          Mode:
        </label>
        <select
          id="dark-mode-select"
          value={preferences.darkMode || 'light'}
          onChange={handleDarkModeChange}
          className="input text-sm"
        >
          <option value="light">Light</option>
          <option value="dark">Dark</option>
          <option value="auto">Auto</option>
        </select>
      </div>
    </div>
  );
}
