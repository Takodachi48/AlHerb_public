import React from 'react';

const UserLayout = ({ children }) => {
  return (
    <div className="typography-user bg-transparent min-h-full relative font-sans">
      {children}
    </div>
  );
};

export default UserLayout;
