import React from 'react';
import { Routes, Route } from 'react-router-dom';

// Import your page components here as they are created
import HomePage from '../pages/user/HomePage';
// import LoginPage from '../pages/auth/LoginPage';

const AppRoutes = () => {
  return (
    <Routes>
      {/* Add your routes here */}
      <Route path="/" element={<div>Home Page - Coming Soon</div>} />
      <Route path="/home" element={<HomePage />} />
      <Route path="/login" element={<div>Login Page - Coming Soon</div>} />
      <Route path="/register" element={<div>Register Page - Coming Soon</div>} />
      <Route path="*" element={<div>404 - Page Not Found</div>} />
    </Routes>
  );
};

export default AppRoutes;
