import React from 'react';
import { Link } from 'react-router-dom';
import { usePreferences } from '../../context/PreferencesContext';
import { SYSTEM_SHORT_NAME } from '../../../../shared/constants/app.js';

const LogoWrapper = ({ size = 'large', className = '', transparent = false, noPadding = false }) => {
  const { preferences } = usePreferences();

  // Determine logo source synchronously to prevent flash
  const shouldBeDark = preferences.darkMode === 'dark' ||
    (preferences.darkMode === 'auto' && window.matchMedia('(prefers-color-scheme: dark)').matches);

  const logoSrc = shouldBeDark ? '/herb-icon-alt.svg' : '/herb-icon.svg';

  const sizeClasses = {
    small: 'w-8 h-8',
    medium: 'w-12 h-12',
    large: 'w-16 h-16',
    xl: 'w-20 h-20',
    xxl: 'w-24 h-24'
  };

  return (
    <div className={`rounded-full ${noPadding ? 'p-0' : 'p-2'} overflow-hidden flex items-center justify-center ${transparent ? 'bg-transparent' : 'bg-surface-primary'
      } ${sizeClasses[size]}`}>
      <img
        src={logoSrc}
        alt={`${SYSTEM_SHORT_NAME} Logo`}
        className="w-full h-full object-contain"
      />
    </div>
  );
};

export default LogoWrapper;
