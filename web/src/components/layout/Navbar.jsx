import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import SearchModal from '../modals/SearchModal';
import SearchButton from '../common/SearchButton';
import Breadcrumb from '../common/Breadcrumb';

const Navbar = ({ isSidebarOpen, setIsSidebarOpen, isMobile }) => {
  const [isSearchModalOpen, setIsSearchModalOpen] = useState(false);
  const [showBreadcrumbs, setShowBreadcrumbs] = useState(!isMobile || !isSidebarOpen);
  const [canAnimateLayout, setCanAnimateLayout] = useState(false);
  const SIDEBAR_MOTION = { type: 'tween', duration: 0.22, ease: [0.22, 1, 0.36, 1] };

  // Enable transitions after first paint to avoid "refresh replay" animation.
  useEffect(() => {
    const id = window.requestAnimationFrame(() => setCanAnimateLayout(true));
    return () => window.cancelAnimationFrame(id);
  }, []);

  const expandedSidebarWidth = 218;
  const collapsedSidebarWidth = 68;

  const leftPosition = isMobile
    ? (isSidebarOpen ? expandedSidebarWidth : 0)
    : (isSidebarOpen ? expandedSidebarWidth : collapsedSidebarWidth);

  const toggleOffset = 8;
  const toggleLeft = leftPosition + toggleOffset;

  useEffect(() => {
    if (isMobile) {
      if (isSidebarOpen) {
        setShowBreadcrumbs(false);
      } else {
        setTimeout(() => setShowBreadcrumbs(true), 220); // Wait for sidebar collapse animation
      }
    } else {
      setShowBreadcrumbs(true);
    }
  }, [isMobile, isSidebarOpen]);

  return (
    <>
      {/* Sidebar toggle seam wrapper: overlaid between sidebar and navbar */}
      <motion.div
        initial={false}
        animate={{ left: toggleLeft, opacity: 1, y: 0 }}
        transition={canAnimateLayout ? SIDEBAR_MOTION : { duration: 0 }}
        className="fixed top-6 z-[80] w-5 h-5 rounded-[4px] bg-surface-primary flex items-center justify-center"
      >
        <button
          onClick={() => setIsSidebarOpen(!isSidebarOpen)}
          className="p-2 rounded-full transition-colors hover:bg-surface-secondary/50 text-primary"
          aria-label="Toggle sidebar"
        >
          <svg
            className="w-5 h-5"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
            <line x1="9" y1="3" x2="9" y2="21" />
            <path
              d="M3 5c0-1.1.9-2 2-2h4v18H5c-1.1 0-2-.9-2-2V5z"
              fill="currentColor"
              className="opacity-40"
              stroke="none"
            />
            <path
              d="M14 15l3-3-3-3"
              strokeWidth="2.5"
              className={`transition-transform duration-300 origin-[15px_12px] ${isSidebarOpen ? 'rotate-180' : ''}`}
            />
          </svg>
        </button>
      </motion.div>

      {/* Navbar body */}
      <motion.div
        initial={false}
        animate={{ left: leftPosition, opacity: 1, y: 0 }}
        transition={canAnimateLayout ? SIDEBAR_MOTION : { duration: 0 }}
        className="fixed top-0 right-0 z-50 bg-base-primary h-16"
      >
        <div className="flex items-center justify-between h-full px-12">
          <AnimatePresence>
            {showBreadcrumbs && (
              <motion.div
                initial={canAnimateLayout ? { opacity: 0 } : false}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0, transition: { duration: 0 } }}
                transition={{ duration: 0.2 }}
              >
                <Breadcrumb />
              </motion.div>
            )}
          </AnimatePresence>
          <div />
          {/* Search Button */}
          <div className="z-40">
            <SearchButton onClick={() => setIsSearchModalOpen(true)} />
          </div>
        </div>
      </motion.div>

      {/* Search Modal */}
      <SearchModal
        isOpen={isSearchModalOpen}
        onClose={() => setIsSearchModalOpen(false)}
      />
    </>
  );
};

export default Navbar;
