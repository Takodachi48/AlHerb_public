import { useState, useEffect, useCallback, useRef } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { cleanParams } from '../utils/adminUtils';

/**
 * Unified hook for handling admin list logic (pagination, filtering, selection, URL sync)
 * 
 * @param {Object} options - Configuration options
 * @param {Function} options.fetchData - Service function to fetch data
 * @param {Object} options.defaultFilters - Default filter values
 * @param {number} options.defaultLimit - Default items per page
 */
export const useAdminList = ({
    fetchData,
    defaultFilters = {},
    defaultLimit = 10
}) => {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const isMounted = useRef(true);
    const abortControllerRef = useRef(null);

    // State
    const [items, setItems] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [selectedIds, setSelectedIds] = useState(new Set());

    // Filters state - initialize from URL
    const [filters, setFilters] = useState(() => {
        const initialFilters = { ...defaultFilters };
        const page = parseInt(searchParams.get('page')) || 1;
        const limit = parseInt(searchParams.get('limit')) || defaultLimit;

        // Merge URL params into filters
        searchParams.forEach((value, key) => {
            if (key !== 'page' && key !== 'limit') {
                initialFilters[key] = value;
            }
        });

        return { ...initialFilters, page, limit };
    });

    // Pagination state (received from backend)
    const [pagination, setPagination] = useState({
        total: 0,
        page: 1,
        limit: defaultLimit,
        totalPages: 0
    });

    // Fetch data function
    const loadData = useCallback(async (currentFilters = filters) => {
        // Cancel previous request if any
        if (abortControllerRef.current) {
            abortControllerRef.current.abort();
        }
        abortControllerRef.current = new AbortController();

        try {
            setLoading(true);
            setError(null);

            // Clean params for API (remove 'all', empty, etc.)
            const apiParams = cleanParams(currentFilters);

            const response = await fetchData(apiParams, {
                signal: abortControllerRef.current.signal
            });

            if (!isMounted.current) return;

            // Handle different response formats (standardizing)
            let data = [];
            let paginationData = { ...pagination };

            if (response && response.data) {
                // Axios-style or standardized response
                data = Array.isArray(response.data) ? response.data : (response.data.data || []);

                // Handle pagination object if present
                const p = response.pagination || response.data.pagination;
                if (p) {
                    paginationData = {
                        total: p.total || p.totalItems || 0,
                        page: p.page || p.currentPage || currentFilters.page,
                        limit: p.limit || p.itemsPerPage || currentFilters.limit,
                        totalPages: p.totalPages || Math.ceil((p.total || p.totalItems || 0) / (p.limit || p.itemsPerPage || currentFilters.limit))
                    };
                } else {
                    // Fallback pagination
                    const total = response.total || response.data.total || data.length;
                    paginationData = {
                        ...pagination,
                        total,
                        page: currentFilters.page,
                        totalPages: Math.ceil(total / currentFilters.limit)
                    };
                }
            } else if (Array.isArray(response)) {
                data = response;
                paginationData = {
                    ...pagination,
                    total: data.length,
                    page: currentFilters.page,
                    totalPages: 1
                };
            }

            setItems(data);
            setPagination(paginationData);
        } catch (err) {
            const isCanceled = err.name === 'AbortError' ||
                err.code === 'ERR_CANCELED' ||
                err.message === 'canceled' ||
                (err.error === 'ERR_CANCELED') ||
                (err.response?.data?.message === 'canceled');

            if (isCanceled) return;
            if (!isMounted.current) return;

            console.error('Admin list fetch error:', err);
            setError(err.message || 'Failed to load data');
            setItems([]);
        } finally {
            if (isMounted.current) {
                setLoading(false);
            }
        }
    }, [fetchData, filters, pagination]);

    // Sync state with URL change
    useEffect(() => {
        const page = parseInt(searchParams.get('page')) || 1;
        const limit = parseInt(searchParams.get('limit')) || defaultLimit;

        // Reset to defaults first, then apply URL params
        const newFilters = { ...defaultFilters, page, limit };

        searchParams.forEach((value, key) => {
            if (key !== 'page' && key !== 'limit') {
                newFilters[key] = value;
            }
        });

        // Check if filters actually changed to avoid infinite loop
        if (JSON.stringify(newFilters) !== JSON.stringify(filters)) {
            setFilters(newFilters);
            loadData(newFilters);
        } else if (items.length === 0 && !loading && !error) {
            // Initial load
            loadData(newFilters);
        }
    }, [searchParams, defaultLimit, fetchData]);

    // Handle filter/pagination change and update URL
    const updateParams = useCallback((newParams) => {
        const nextFilters = { ...filters, ...newParams };

        // If it's a filter change (not just page), reset to page 1
        if (newParams.page === undefined) {
            nextFilters.page = 1;
        }

        const urlParams = new URLSearchParams();

        Object.entries(nextFilters).forEach(([key, value]) => {
            if (value !== null && value !== undefined && value !== '' && value !== 'all') {
                if (key === 'page' && value === 1) return;
                if (key === 'limit' && value === defaultLimit) return;
                urlParams.set(key, value.toString());
            }
        });

        navigate(`?${urlParams.toString()}`, { replace: true });
    }, [filters, navigate, defaultLimit]);

    const handlePageChange = (newPage) => {
        updateParams({ page: newPage });
    };

    const handleFilterChange = (key, value) => {
        updateParams({ [key]: value });
    };

    // Selection logic
    const toggleSelection = (id) => {
        const nextSelected = new Set(selectedIds);
        if (nextSelected.has(id)) {
            nextSelected.delete(id);
        } else {
            nextSelected.add(id);
        }
        setSelectedIds(nextSelected);
    };

    const selectAll = (ids) => {
        setSelectedIds(new Set(ids));
    };

    const clearSelection = () => {
        setSelectedIds(new Set());
    };

    // Lifecycle
    useEffect(() => {
        isMounted.current = true;
        return () => {
            isMounted.current = false;
            if (abortControllerRef.current) {
                abortControllerRef.current.abort();
            }
        };
    }, []);

    return {
        items,
        setItems,
        loading,
        error,
        filters,
        pagination,
        selectedIds,
        handlePageChange,
        handleFilterChange,
        toggleSelection,
        selectAll,
        clearSelection,
        refresh: () => loadData(filters)
    };
};
