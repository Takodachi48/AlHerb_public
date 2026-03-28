import React from 'react';

const AdminLayout = ({ children }) => {
  return (
    <div className="typography-admin bg-base-tertiary min-h-full relative font-sans">
      <div className="min-w-0 h-[calc(100dvh-4rem)] overflow-y-auto relative">
        {children}
      </div>
    </div>
  );
};

export default AdminLayout;
