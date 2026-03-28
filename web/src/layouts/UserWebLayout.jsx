import React from 'react';
import { useLocation } from 'react-router-dom';
import { AnimatePresence } from 'framer-motion';
import FilterBar from '../components/common/FilterBar';
import { useHerbFilters } from '../context/HerbFilterContext';

const UserLayout = ({ children }) => {
  const location = useLocation();
  const {
    localSearch, setLocalSearch,
    activeGender, setActiveGender,
    safetyFilter, setSafetyFilter,
    hasActiveFilters, clearAllFilters
  } = useHerbFilters();

  return (
    <div className="typography-user bg-transparent min-h-full relative font-sans">
      <div className="min-w-0 h-[calc(100dvh-4rem)] overflow-y-auto relative">
        <AnimatePresence initial={false}>
          {location.pathname === '/herbs' && (
            <FilterBar
              localSearch={localSearch}
              onSearchChange={setLocalSearch}
              activeGender={activeGender}
              onGenderToggle={setActiveGender}
              safetyFilter={safetyFilter}
              onSafetyChange={setSafetyFilter}
              hasActiveFilters={hasActiveFilters}
              onClearAll={clearAllFilters}
            />
          )}
        </AnimatePresence>
        {children}
      </div>
    </div>
  );
};

export default UserLayout;
