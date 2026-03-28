import React from 'react';

const AdminLayout = ({ children }) => {
  return (
    <div className="typography-admin bg-base-secondary min-h-full relative font-sans">
      {children}
    </div>
  );
};

export default AdminLayout;
