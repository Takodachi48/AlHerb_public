import React, { createContext, useContext, useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';

const HerbFilterContext = createContext();

export const useHerbFilters = () => {
    const context = useContext(HerbFilterContext);
    if (!context) {
        throw new Error('useHerbFilters must be used within a HerbFilterProvider');
    }
    return context;
};

export const HerbFilterProvider = ({ children }) => {
    const [searchParams] = useSearchParams();

    /* initial values from URL */
    const searchQuery = searchParams.get('search') || '';
    const genderQuery = searchParams.get('gender') || 'all';

    const [localSearch, setLocalSearch] = useState(searchQuery);
    const [debouncedSearch, setDebouncedSearch] = useState(searchQuery);
    const [activeGender, setActiveGender] = useState(genderQuery);
    const [safetyFilter, setSafetyFilter] = useState('all');

    /* Debounce search updates to localSearch */
    useEffect(() => {
        const timer = setTimeout(() => {
            setDebouncedSearch(localSearch);
        }, 400);
        return () => clearTimeout(timer);
    }, [localSearch]);

    /* Sync with searchParams if they change externally (e.g. browser back) */
    useEffect(() => {
        setLocalSearch(searchQuery);
        setDebouncedSearch(searchQuery);
        setActiveGender(genderQuery);
    }, [searchQuery, genderQuery]);

    const clearAllFilters = () => {
        setLocalSearch('');
        setDebouncedSearch('');
        setActiveGender('all');
        setSafetyFilter('all');
    };

    const hasActiveFilters =
        localSearch !== '' ||
        activeGender !== 'all' ||
        safetyFilter !== 'all';

    return (
        <HerbFilterContext.Provider value={{
            localSearch, setLocalSearch,
            debouncedSearch, setDebouncedSearch,
            activeGender, setActiveGender,
            safetyFilter, setSafetyFilter,
            hasActiveFilters, clearAllFilters
        }}>
            {children}
        </HerbFilterContext.Provider>
    );
};
