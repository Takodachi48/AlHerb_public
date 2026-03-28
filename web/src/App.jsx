import React, { lazy, Suspense, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
//import { Palette } from 'lucide-react';
import { useAuth } from './hooks/useAuth';
import { usePreferences } from './context/PreferencesContext';
import { useLoaderActions } from './hooks/useLoader';
import Loading from './components/common/Loading';
import AdminRoute from './routes/AdminRoute';

// Layout Components
import Navbar from './components/layout/Navbar';
import Sidebar from './components/layout/Sidebar';
import AdminWebLayout from './layouts/AdminWebLayout';
import UserWebLayout from './layouts/UserWebLayout';
import { useHerbFilters } from './context/HerbFilterContext';

import RestrictedOverlay from "./components/overlays/RestrictedOverlay";

const AuthPage = lazy(() => import('./pages/auth/AuthPage'));
const VerifyEmailPage = lazy(() => import('./pages/auth/VerifyEmailPage'));
const LandingPage = lazy(() => import('./pages/landing/LandingPage'));
const HomePage = lazy(() => import('./pages/user/HomePage'));
const HerbsPage = lazy(() => import('./pages/user/herb/HerbsPage'));
const HerbDetailPage = lazy(() => import('./pages/user/herb/HerbDetailPage'));
const HerbComparisonPage = lazy(() => import('./pages/user/HerbComparisonPage'));
const RecommendationPage = lazy(() => import('./pages/user/recommendation'));
const HerbSafetyPage = lazy(() => import('./pages/user/HerbSafetyPage'));
const MapPage = lazy(() => import('./pages/user/MapPage'));
const ImageProcessingPage = lazy(() => import('./pages/user/ImageProcessingPage'));
const SettingsPage = lazy(() => import('./pages/user/SettingsPage'));
const BlogPage = lazy(() => import('./pages/blog/BlogPage'));
const BlogFormPage = lazy(() => import('./pages/blog/BlogFormPage'));
const UserBlogs = lazy(() => import('./pages/blog/UserBlogs'));
const BlogViewPage = lazy(() => import('./pages/blog/BlogViewPage'));
const DashboardPage = lazy(() => import('./pages/admin/DashboardPage'));
const HerbsManagementPage = lazy(() => import('./pages/admin/herbs/HerbManagementPage'));
const HerbEditPage = lazy(() => import('./pages/admin/HerbEditPage'));
const AnalyticsPage = lazy(() => import('./pages/admin/AnalyticsPage'));
const MLManagementPage = lazy(() => import('./pages/admin/MLManagementPage'));
const UserManagementPage = lazy(() => import('./pages/admin/UserManagementPage'));
const HerbLocationPage = lazy(() => import('./pages/admin/locations/HerbLocationPage'));
const AssetsPage = lazy(() => import('./pages/admin/AssetsPage'));
const PhytochemicalManagementPage = lazy(() => import('./pages/admin/PhytochemicalManagementPage'));
//const DesignPreviewModal = lazy(() => import('./components/modals/DesignPreviewModal'));
const ChatbotWidget = lazy(() => import('./components/chatbot/ChatbotWidget'));

const RouteReady = ({ children, onReady }) => {
  useEffect(() => {
    onReady();
  }, [onReady]);
  return children;
};

function App() {
  const { user, loading } = useAuth();
  const location = useLocation();
  const { start, finish, addTask, completeTask } = useLoaderActions();
  const { preferences } = usePreferences();
  const {
    localSearch, setLocalSearch,
    activeGender, setActiveGender,
    safetyFilter, setSafetyFilter,
    hasActiveFilters, clearAllFilters
  } = useHerbFilters();
  const [isSidebarOpen, setIsSidebarOpen] = useState(() => {
    const saved = localStorage.getItem('sidebarOpen');
    return saved !== null ? JSON.parse(saved) : true;
  });
  const [isDesignModalOpen, setIsDesignModalOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [canAnimateLayout, setCanAnimateLayout] = useState(false);
  const routeReadyRef = useRef(finish);
  const firstRouteRenderRef = useRef(true);
  const prevPathKeyRef = useRef('');
  const activeRouteLoadIdRef = useRef(null);
  const routeForceFinishTimerRef = useRef(null);
  const authTaskActiveRef = useRef(false);

  useEffect(() => {
    routeReadyRef.current = finish;
  }, [finish]);

  const handleRouteReady = () => {
    if (routeForceFinishTimerRef.current) {
      window.clearTimeout(routeForceFinishTimerRef.current);
      routeForceFinishTimerRef.current = null;
    }
    if (activeRouteLoadIdRef.current) {
      routeReadyRef.current(activeRouteLoadIdRef.current);
      activeRouteLoadIdRef.current = null;
    }
    routeReadyRef.current();
  };

  const withSuspense = (node, fallback = null, mode = 'layout') => {
    const defaultFallback = mode === 'fullscreen'
      ? <div className="h-screen w-full bg-base-primary" />
      : (
        <div className="relative min-h-[calc(100vh-4rem)] w-full bg-base-tertiary">
          <Loading variant="fullpage-progress" text="Loading page content" />
        </div>
      );
    const effectiveFallback = fallback === true || fallback === null
      ? defaultFallback
      : (typeof fallback === 'boolean' ? null : fallback);

    return (
      <Suspense fallback={effectiveFallback}>
        <RouteReady onReady={handleRouteReady}>{node}</RouteReady>
      </Suspense>
    );
  };




  // Sidebar dimensions (scaled)
  const SIDEBAR_SCALE = 0.85;
  const EXPANDED_WIDTH = Math.round(256 * SIDEBAR_SCALE); // 218
  const COLLAPSED_WIDTH = Math.round(80 * SIDEBAR_SCALE); // 68

  // Persist sidebar state to localStorage
  useEffect(() => {
    localStorage.setItem('sidebarOpen', JSON.stringify(isSidebarOpen));
  }, [isSidebarOpen]);

  // Detect mobile screen
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Enable transitions after first paint to avoid "refresh replay" animation.
  useEffect(() => {
    const id = window.requestAnimationFrame(() => setCanAnimateLayout(true));
    return () => window.cancelAnimationFrame(id);
  }, []);
  useEffect(() => {
    const shouldBeDark = preferences.darkMode === 'dark' ||
      (preferences.darkMode === 'auto' && window.matchMedia('(prefers-color-scheme: dark)').matches);

    const faviconHref = shouldBeDark ? '/herb-icon-alt.svg' : '/herb-icon.svg';

    // Update or create favicon link
    let link = document.querySelector("link[rel~='icon']");
    if (!link) {
      link = document.createElement('link');
      link.rel = 'icon';
      link.type = 'image/svg+xml';
      document.head.appendChild(link);
    }
    link.href = faviconHref;
  }, [preferences.darkMode]);

  useLayoutEffect(() => {
    const pathKey = `${location.pathname}${location.search}`;
    const isLandingRoute = location.pathname === '/' || location.pathname === '/landing';
    if (firstRouteRenderRef.current) {
      firstRouteRenderRef.current = false;
      prevPathKeyRef.current = pathKey;
      return;
    }
    if (prevPathKeyRef.current === pathKey) return;
    prevPathKeyRef.current = pathKey;
    if (isLandingRoute) return;
    if (activeRouteLoadIdRef.current) {
      finish(activeRouteLoadIdRef.current);
    }
    const nextId = `route-transition:${pathKey}:${Date.now()}`;
    activeRouteLoadIdRef.current = nextId;
    start({ id: nextId, mode: 'topbar', message: 'Loading page...' });
    if (routeForceFinishTimerRef.current) {
      window.clearTimeout(routeForceFinishTimerRef.current);
    }
    routeForceFinishTimerRef.current = window.setTimeout(() => {
      if (activeRouteLoadIdRef.current === nextId) {
        finish(nextId);
        activeRouteLoadIdRef.current = null;
      }
      routeForceFinishTimerRef.current = null;
    }, 4500);
  }, [location.pathname, location.search, start, finish]);

  useEffect(() => () => {
    if (routeForceFinishTimerRef.current) {
      window.clearTimeout(routeForceFinishTimerRef.current);
      routeForceFinishTimerRef.current = null;
    }
    if (activeRouteLoadIdRef.current) {
      finish(activeRouteLoadIdRef.current);
      activeRouteLoadIdRef.current = null;
    }
  }, [finish]);

  useEffect(() => {
    const isLandingRoute = location.pathname === '/' || location.pathname === '/landing';
    if (isLandingRoute) {
      if (authTaskActiveRef.current) {
        authTaskActiveRef.current = false;
        completeTask('auth-sync');
        finish();
      }
      return;
    }
    if (loading && !authTaskActiveRef.current) {
      authTaskActiveRef.current = true;
      addTask('auth-sync');
      start({ mode: 'topbar', message: 'Syncing session...' });
      return;
    }
    if (loading || !authTaskActiveRef.current) return;
    authTaskActiveRef.current = false;
    completeTask('auth-sync');
    finish();
  }, [loading, location.pathname, addTask, completeTask, finish, start]);

  return (
    <>
      <Routes>
        {/* Landing Page Route */}
        <Route
          path="/landing"
          element={withSuspense(<LandingPage />, false, 'fullscreen')}
        />

        {/* Main Landing Page Route */}
        <Route
          path="/"
          element={withSuspense(<LandingPage />, false, 'fullscreen')}
        />

        {/* Auth Routes (no navbar/sidebar) */}
        <Route path="/auth" element={withSuspense(<AuthPage />, false)} />
        <Route path="/login" element={<Navigate to="/auth?mode=login" replace />} />
        <Route path="/register" element={<Navigate to="/auth?mode=register" replace />} />
        <Route path="/verify-email" element={withSuspense(<VerifyEmailPage />, false)} />

        {/* Map Route - Full Screen without Navbar/Sidebar */}
        <Route path="/map" element={withSuspense(<div className="typography-user"><MapPage /></div>, false, 'fullscreen')} />

        {/* All other routes with main layout */}
        <Route path="*" element={
          <div className="min-h-screen bg-base-tertiary overflow-hidden">
            {user && withSuspense(<ChatbotWidget />)}
            <Navbar isSidebarOpen={isSidebarOpen} setIsSidebarOpen={setIsSidebarOpen} isMobile={isMobile} />

            <div className="flex relative">
              <Sidebar isSidebarOpen={isSidebarOpen} setIsSidebarOpen={setIsSidebarOpen} />

              <motion.main
                initial={false}
                animate={{ marginLeft: isMobile ? 0 : (isSidebarOpen ? EXPANDED_WIDTH : COLLAPSED_WIDTH) }}
                transition={canAnimateLayout ? { type: 'tween', duration: 0.22, ease: [0.22, 1, 0.36, 1] } : { duration: 0 }}
                className="flex-1 overflow-hidden bg-base-tertiary relative"
                style={{ minHeight: 'calc(100vh - 0rem)', paddingTop: '4rem' }}
              >
                <Routes>
                  {/* Public User Routes (no login required) */}
                  <Route path="/home" element={
                    <UserWebLayout>
                      {withSuspense(<HomePage />)}
                    </UserWebLayout>
                  } />
                  <Route path="/herbs" element={
                    <UserWebLayout>
                      {withSuspense(<HerbsPage isSidebarOpen={isSidebarOpen} isMobile={isMobile} />)}
                    </UserWebLayout>
                  } />
                  <Route path="/compare" element={
                    <UserWebLayout>
                      {withSuspense(<HerbComparisonPage />)}
                    </UserWebLayout>
                  } />
                  <Route path="/herbs/:slug" element={
                    <UserWebLayout>
                      {withSuspense(<HerbDetailPage />)}
                    </UserWebLayout>
                  } />
                  <Route path="/blog" element={
                    <UserWebLayout>
                      {withSuspense(<BlogPage />)}
                    </UserWebLayout>
                  } />
                  <Route path="/blog/:slug" element={
                    <UserWebLayout>
                      {withSuspense(<BlogViewPage />)}
                    </UserWebLayout>
                  } />
                  <Route path="/blog/create" element={
                    <UserWebLayout>
                      {withSuspense(<BlogFormPage />)}
                    </UserWebLayout>
                  } />
                  <Route path="/blog/my-blogs" element={
                    <UserWebLayout>
                      {withSuspense(<UserBlogs />)}
                    </UserWebLayout>
                  } />
                  <Route path="/blog/edit/:id" element={
                    <UserWebLayout>
                      {withSuspense(<BlogFormPage />)}
                    </UserWebLayout>
                  } />
                  <Route path="/settings" element={
                    <UserWebLayout>
                      {withSuspense(<SettingsPage />)}
                    </UserWebLayout>
                  } />

                  {/* Restricted User Routes (login required) */}
                  <Route path="/recommendation" element={
                    <UserWebLayout>
                      {withSuspense(user ? <RecommendationPage /> : null)}
                      <RestrictedOverlay />
                    </UserWebLayout>
                  } />
                  <Route path="/safety" element={
                    <UserWebLayout>
                      {withSuspense(user ? <HerbSafetyPage /> : null)}
                      <RestrictedOverlay />
                    </UserWebLayout>
                  } />
                  <Route path="/image-processing" element={
                    <UserWebLayout>
                      {withSuspense(user ? <ImageProcessingPage /> : null)}
                      <RestrictedOverlay />
                    </UserWebLayout>
                  } />

                  {/* Admin Routes */}
                  <Route path="/admin/dashboard" element={
                    <AdminRoute>
                      <AdminWebLayout>
                        {withSuspense(<DashboardPage />, true)}
                      </AdminWebLayout>
                    </AdminRoute>
                  } />
                  <Route path="/admin/herbs" element={
                    <AdminRoute>
                      <AdminWebLayout>
                        {withSuspense(<HerbsManagementPage />, true)}
                      </AdminWebLayout>
                    </AdminRoute>
                  } />
                  <Route path="/admin/phytochemicals" element={
                    <AdminRoute>
                      <AdminWebLayout>
                        {withSuspense(<PhytochemicalManagementPage />, true)}
                      </AdminWebLayout>
                    </AdminRoute>
                  } />
                  <Route path="/admin/herbs/:slug/edit" element={
                    <AdminRoute>
                      <AdminWebLayout>
                        {withSuspense(<HerbEditPage />, true)}
                      </AdminWebLayout>
                    </AdminRoute>
                  } />
                  <Route path="/admin/analytics" element={
                    <AdminRoute>
                      <AdminWebLayout>
                        {withSuspense(<AnalyticsPage />, true)}
                      </AdminWebLayout>
                    </AdminRoute>
                  } />
                  <Route path="/admin/dataset" element={
                    <AdminRoute>
                      <AdminWebLayout>
                        {withSuspense(<MLManagementPage />, true)}
                      </AdminWebLayout>
                    </AdminRoute>
                  } />
                  <Route path="/admin/ml-model" element={
                    <AdminRoute>
                      <AdminWebLayout>
                        {withSuspense(<MLManagementPage />, true)}
                      </AdminWebLayout>
                    </AdminRoute>
                  } />
                  <Route path="/admin/users" element={
                    <AdminRoute>
                      <AdminWebLayout>
                        {withSuspense(<UserManagementPage />, true)}
                      </AdminWebLayout>
                    </AdminRoute>
                  } />
                  <Route path="/admin/blog" element={
                    <AdminRoute>
                      <AdminWebLayout>
                        {withSuspense(<BlogPage />, true)}
                      </AdminWebLayout>
                    </AdminRoute>
                  } />
                  <Route path="/admin/assets" element={
                    <AdminRoute>
                      <AdminWebLayout>
                        {withSuspense(<AssetsPage />, true)}
                      </AdminWebLayout>
                    </AdminRoute>
                  } />
                  <Route path="/admin/landing-assets" element={
                    <AdminRoute>
                      <AdminWebLayout>
                        <Navigate to="/admin/assets" replace />
                      </AdminWebLayout>
                    </AdminRoute>
                  } />
                  <Route path="/admin/herb-locations" element={
                    <AdminRoute>
                      <AdminWebLayout>
                        {withSuspense(<HerbLocationPage />, true)}
                      </AdminWebLayout>
                    </AdminRoute>
                  } />

                  {/* Fallback Route */}
                  <Route path="*" element={
                    <div className="min-h-screen flex items-center justify-center">
                      <div className="text-center">
                        <h1 className="text-4xl font-bold font-display text-primary mb-4">404</h1>
                        <p className="text-lg font-sans text-tertiary mb-8">Page not found</p>
                        <button
                          onClick={() => window.history.back()}
                          className="btn-primary"
                        >
                          Go Back
                        </button>
                      </div>
                    </div>
                  } />
                </Routes>
              </motion.main>
            </div>
          </div>
        } />
      </Routes>

      {/* <button
        onClick={() => setIsDesignModalOpen(true)}
        className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 bg-accent-primary text-text-on-accent p-3 rounded-full shadow-lg hover:bg-accent-primary-hover transition-colors"
        title="View Design"
      >
        <Palette size={16} />
      </button>

      {isDesignModalOpen
        ? withSuspense(<DesignPreviewModal isOpen={isDesignModalOpen} onClose={() => setIsDesignModalOpen(false)} />)
        : null} */}
    </>
  );
}

export default App;
