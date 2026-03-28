import React from 'react';
import { Link } from 'react-router-dom';
import { SYSTEM_SHORT_NAME } from '../../../../shared/constants/app.js';

const LogoOverlay = () => {
  return (
    <div className="absolute left-10 top-0.5 flex items-center justify-center z-40">
      <Link to="/" className="block">
        <div className="rounded-full p-2 overflow-hidden w-36 h-36 flex items-center justify-center bg-surface-primary border border-primary">
          <img
            src="/herb-icon-alt.svg"
            alt={`${SYSTEM_SHORT_NAME} Logo`}
            className="w-full h-full object-contain"
          />
        </div>
      </Link>
    </div>
  );
};

export default LogoOverlay;
