import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import Button from '../../../components/common/Button';
import { GridSkeleton, MetaRowSkeleton } from '../../../components/common/Skeleton';
import Pagination from '../../../components/common/Pagination';
import HerbCard from '../../../components/herbs/HerbCard';
import { herbService } from '../../../services/herbService';
import { useAuth } from '../../../hooks/useAuth';
import useBatchIntersectionObserver from '../../../hooks/useBatchIntersectionObserver';
import { useLoaderActions } from '../../../hooks/useLoader';
import { useHerbFilters } from '../../../context/HerbFilterContext';
import { buildLooseSearchVariants } from '../../../utils/searchUtils';
import '../../../styles/pages/herbsPage.css';

/* ─── Virtual scroll constants ───────────────────────────────── */
const PAGE_SIZE = 18;
const VIRTUALIZE_THRESHOLD = 24;
const VIRTUAL_ROW_HEIGHT = 400;
const VIRTUAL_OVERSCAN_ROWS = 2;

/* ═══════════════════════════════════════════════════════════════
   HERBS PAGE
═══════════════════════════════════════════════════════════════ */
const HerbsPage = ({ isSidebarOpen = true, isMobile = false }) => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  /* data */
  const [herbs, setHerbs] = useState([]);
  const [pagination, setPagination] = useState({
    currentPage: 1, totalPages: 1, totalItems: 0, itemsPerPage: PAGE_SIZE,
  });
  const [currentPage, setCurrentPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [isFetching, setIsFetching] = useState(false);
  const [error, setError] = useState(null);

  /* favorites */
  const [favoriteIds, setFavoriteIds] = useState(new Set());
  const [favoriteBusy, setFavoriteBusy] = useState({});

  /* viewport / scroll (virtualisation) */
  const [viewportWidth, setViewportWidth] = useState(() => window.innerWidth);
  const [scrollY, setScrollY] = useState(() => window.scrollY || 0);
  const [viewportHeight, setViewportHeight] = useState(() => window.innerHeight);
  const [gridTop, setGridTop] = useState(0);

  /* filters (from context) */
  const {
    localSearch, setLocalSearch,
    debouncedSearch, setDebouncedSearch,
    activeGender, setActiveGender,
    safetyFilter, setSafetyFilter,
    hasActiveFilters, clearAllFilters
  } = useHerbFilters();

  const { user } = useAuth();
  const { addTask, completeTask } = useLoaderActions();
  const observeReveal = useBatchIntersectionObserver({ threshold: 0.08, rootMargin: '140px 0px' });
  const gridContainerRef = useRef(null);
  const requestSeqRef = useRef(0);
  const hasLoadedOnceRef = useRef(false);

  /* ─── loadHerbs (logic unchanged) ───────────────────────── */
  const loadHerbs = useCallback(async ({ page = 1, search = '', forceRefresh = false } = {}) => {
    const requestId = ++requestSeqRef.current;
    const taskId = `fetch-herbs-${requestId}`;
    addTask(taskId);
    try {
      setError(null);
      if (!hasLoadedOnceRef.current) {
        setLoading(true);
      } else {
        setIsFetching(true);
      }

      const searchVariants = buildLooseSearchVariants(search);
      let response = null;
      let herbsData = [];

      for (let i = 0; i < searchVariants.length; i += 1) {
        const searchTerm = searchVariants[i];
        response = await herbService.getAllHerbs(
          {
            page,
            limit: PAGE_SIZE,
            search: searchTerm || undefined,
            gender: activeGender || 'all',
            safety: safetyFilter || 'all',
          },
          { forceRefresh: forceRefresh || i > 0 },
        );

        herbsData = Array.isArray(response?.data) ? response.data : [];
        if (herbsData.length > 0 || i === searchVariants.length - 1) break;
      }

      const nextPagination = response?.pagination || {
        currentPage: page, totalPages: 1, totalItems: herbsData.length, itemsPerPage: PAGE_SIZE,
      };

      if (requestId !== requestSeqRef.current) return;
      setHerbs(herbsData);
      setPagination(nextPagination);
      setCurrentPage(nextPagination.currentPage || page);
      hasLoadedOnceRef.current = true;
    } catch (err) {
      if (requestId !== requestSeqRef.current) return;
      console.error('Failed to load herbs:', err);
      setError('Failed to load herbs. Please try again.');
    } finally {
      completeTask(taskId);
      if (requestId === requestSeqRef.current) {
        setLoading(false);
        setIsFetching(false);
      }
    }
  }, [activeGender, safetyFilter, addTask, completeTask]);

  /* ─── loadFavorites (logic unchanged) ───────────────────── */
  const loadFavorites = async () => {
    if (!user) { setFavoriteIds(new Set()); return; }
    try {
      const response = await herbService.getFavoriteHerbs();
      const favorites = response?.data || response || [];
      const next = new Set(
        (Array.isArray(favorites) ? favorites : [])
          .map((item) => (typeof item === 'string' ? item : item?._id || item?.id))
          .filter(Boolean),
      );
      setFavoriteIds(next);
    } catch {
      setFavoriteIds(new Set());
    }
  };

  /* ─── Effects (all unchanged) ───────────────────────────── */
  /* initial load of favorites */
  useEffect(() => { loadFavorites(); }, [user]);

  useEffect(() => {
    setCurrentPage(1);
  }, [debouncedSearch, activeGender, safetyFilter]);

  useEffect(() => {
    loadHerbs({ page: currentPage, search: debouncedSearch });
  }, [loadHerbs, currentPage, debouncedSearch, activeGender, safetyFilter]);

  useEffect(() => {
    let frameId = null;
    const onWindowChange = () => {
      if (frameId) return;
      frameId = window.requestAnimationFrame(() => {
        frameId = null;
        setViewportWidth(window.innerWidth);
        setViewportHeight(window.innerHeight);
        setScrollY(window.scrollY || 0);
      });
    };
    onWindowChange();
    window.addEventListener('scroll', onWindowChange, { passive: true });
    window.addEventListener('resize', onWindowChange);
    return () => {
      if (frameId) window.cancelAnimationFrame(frameId);
      window.removeEventListener('scroll', onWindowChange);
      window.removeEventListener('resize', onWindowChange);
    };
  }, []);

  useEffect(() => {
    const measureTop = () => {
      if (!gridContainerRef.current) return;
      const rect = gridContainerRef.current.getBoundingClientRect();
      setGridTop(rect.top + (window.scrollY || 0));
    };
    measureTop();
    window.addEventListener('resize', measureTop);
    return () => window.removeEventListener('resize', measureTop);
  }, [herbs.length, viewportWidth, currentPage]);

  /* ─── Derived state ──────────────────────────────────────── */
  const filteredHerbs = useMemo(() => herbs, [herbs]);
  const activeSearch = localSearch.trim();
  const gridColumns = viewportWidth >= 1024 ? 3 : viewportWidth >= 768 ? 2 : 1;

  /* Virtual scroll (logic unchanged) */
  const virtualState = useMemo(() => {
    const totalItems = filteredHerbs.length;
    const totalRows = Math.ceil(totalItems / gridColumns);
    const shouldVirtualize = totalItems > VIRTUALIZE_THRESHOLD;

    if (!shouldVirtualize || totalRows <= 0) {
      return { shouldVirtualize, totalHeight: 0, offsetY: 0, visibleHerbs: filteredHerbs };
    }

    const relativeTop = Math.max(0, scrollY - gridTop);
    const startRow = Math.max(0, Math.floor(relativeTop / VIRTUAL_ROW_HEIGHT) - VIRTUAL_OVERSCAN_ROWS);
    const visibleRowCount = Math.ceil(viewportHeight / VIRTUAL_ROW_HEIGHT) + VIRTUAL_OVERSCAN_ROWS * 2;
    const endRow = Math.min(totalRows, startRow + visibleRowCount);
    const startIndex = startRow * gridColumns;
    const endIndex = Math.min(totalItems, endRow * gridColumns);

    return {
      shouldVirtualize,
      totalHeight: totalRows * VIRTUAL_ROW_HEIGHT,
      offsetY: startRow * VIRTUAL_ROW_HEIGHT,
      visibleHerbs: filteredHerbs.slice(startIndex, endIndex),
    };
  }, [filteredHerbs, gridColumns, gridTop, scrollY, viewportHeight]);

  /* Handlers are now partially in context, partially local for page navigation */
  const handleHerbClick = (herb) => navigate(`/herbs/${herb.slug || herb._id}`);
  const handlePageChange = (nextPage) => {
    const totalPages = pagination?.totalPages || 1;
    if (nextPage < 1 || nextPage > totalPages || nextPage === currentPage) return;
    setCurrentPage(nextPage);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };
  const handleToggleFavorite = async (herb) => {
    if (!user || !herb?._id || favoriteBusy[herb._id]) return;
    const herbId = herb._id;
    const wasFavorite = favoriteIds.has(herbId);
    const prevFavorites = new Set(favoriteIds);
    const nextFavorites = new Set(favoriteIds);
    if (wasFavorite) nextFavorites.delete(herbId); else nextFavorites.add(herbId);
    setFavoriteBusy((prev) => ({ ...prev, [herbId]: true }));
    setFavoriteIds(nextFavorites);
    try {
      if (wasFavorite) await herbService.removeFromFavorites(herbId);
      else await herbService.addToFavorites(herbId);
      await loadHerbs({ page: currentPage, search: debouncedSearch, forceRefresh: true });
    } catch {
      setFavoriteIds(prevFavorites);
    } finally {
      setFavoriteBusy((prev) => ({ ...prev, [herbId]: false }));
    }
  };

  /* ═══════════════════════════════════════════════════════════
     RENDER
  ═══════════════════════════════════════════════════════════ */

  /* ── Error fullscreen ── */
  if (error) {
    return (
      <div className="hp-error-wrap">
        <div className="hp-error-card">
          <div className="hp-error-icon">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="9" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <circle cx="12" cy="16" r=".8" fill="currentColor" />
            </svg>
          </div>
          <p className="hp-error-eyebrow">Error</p>
          <p className="hp-error-msg">{error}</p>
          <Button onClick={() => loadHerbs({ page: currentPage, search: debouncedSearch, forceRefresh: true })}>
            Try Again
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="hp-root">

      {/* ══ CONTENT ══════════════════════════════════════════ */}
      <div className="hp-content">

        {/* Results / page meta */}
        {loading || isFetching ? (
          <MetaRowSkeleton />
        ) : (
          <div style={{
            background: 'var(--surface-primary)',
            border: '1.5px solid var(--border-primary)',
            borderLeft: '3px solid var(--border-weak)',
            borderRadius: '6px',
            boxShadow: '4px 4px 0 var(--surface-tertiary)',
            padding: '18px 20px',
            marginBottom: '16px'
          }}>
            <div className="hp-meta-row" style={{ marginBottom: 0 }}>
              <span className="hp-meta-count">
                {pagination.totalItems > 0
                  ? `${pagination.totalItems.toLocaleString()} herb${pagination.totalItems !== 1 ? 's' : ''}`
                  : 'No results'}
              </span>
              {(pagination?.totalPages || 1) > 1 && (
                <span className="hp-meta-page">
                  Page {pagination.currentPage || currentPage} of {pagination.totalPages}
                </span>
              )}
            </div>
          </div>
        )}

        {/* Grid */}
        <div ref={gridContainerRef}>
          {loading || isFetching ? (
            <GridSkeleton count={6} />

          ) : filteredHerbs.length === 0 ? (
            /* ── Empty state ── */
            <div className="hp-empty">
              <div className="hp-empty-icon">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none"
                  stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="11" cy="11" r="7" />
                  <line x1="21" y1="21" x2="16.65" y2="16.65" />
                </svg>
              </div>
              <p className="hp-empty-title">
                {activeSearch ? `No results for "${activeSearch}"` : 'No herbs available'}
              </p>
              <p className="hp-empty-sub">
                {hasActiveFilters
                  ? 'Try adjusting or clearing your filters'
                  : 'Check back later for new herbs'}
              </p>
              {hasActiveFilters && (
                <Button variant="primary" size="sm" onClick={clearAllFilters} style={{ marginTop: '14px' }}>
                  Clear filters
                </Button>
              )}
            </div>

          ) : virtualState.shouldVirtualize ? (
            /* ── Virtualised grid ── */
            <div style={{ height: `${virtualState.totalHeight}px`, position: 'relative' }}>
              <div
                className="hp-grid"
                style={{
                  position: 'absolute', left: 0, right: 0, top: 0,
                  transform: `translateY(${virtualState.offsetY}px)`,
                }}
              >
                {virtualState.visibleHerbs.map((herb) => (
                  <div key={herb._id}>
                    <HerbCard
                      herb={herb}
                      onViewDetails={handleHerbClick}
                      onToggleFavorite={user ? handleToggleFavorite : undefined}
                      isFavorite={favoriteIds.has(herb._id)}
                      favoriteBusy={Boolean(favoriteBusy[herb._id])}
                    />
                  </div>
                ))}
              </div>
            </div>

          ) : (
            /* ── Normal grid ── */
            <div className="hp-grid">
              {filteredHerbs.map((herb) => (
                <div
                  key={herb._id}
                  className="io-reveal"
                  data-io-animation="zoom"
                  ref={observeReveal(`herb-card-${herb._id}`)}
                >
                  <HerbCard
                    herb={herb}
                    onViewDetails={handleHerbClick}
                    onToggleFavorite={user ? handleToggleFavorite : undefined}
                    isFavorite={favoriteIds.has(herb._id)}
                    favoriteBusy={Boolean(favoriteBusy[herb._id])}
                  />
                </div>
              ))}
            </div>
          )}

          {/* Pagination */}
          {(pagination?.totalPages || 1) > 1 && (
            <div className="hp-pagination">
              <Pagination
                currentPage={pagination.currentPage || currentPage}
                totalPages={pagination.totalPages || 1}
                onPageChange={handlePageChange}
                total={pagination.totalItems || 0}
                limit={pagination.itemsPerPage || PAGE_SIZE}
              />
            </div>
          )}
        </div>

      </div>
    </div>
  );
};

export default HerbsPage;
