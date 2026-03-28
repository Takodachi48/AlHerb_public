import React, { useEffect, useMemo, useState, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import ProfilePicture from '../../components/common/ProfilePicture';
import Button from '../../components/common/Button';
import SearchBar from '../../components/common/SearchBar';
import Dropdown from '../../components/common/Dropdown';
import CarouselDots from '../../components/common/CarouselDots';
import BlogSidepanel from '../../components/blog/BlogSidepanel';
import blogApi from '../../services/blogService';
import { useAuth } from '../../hooks/useAuth';
import useBatchIntersectionObserver from '../../hooks/useBatchIntersectionObserver';
import { useLoaderActions } from '../../hooks/useLoader';

const categories = [
  { value: 'all',          label: 'All Posts' },
  { value: 'general',      label: 'General' },
  { value: 'herb_profiles',label: 'Herb Profiles' },
  { value: 'remedies',     label: 'Remedies' },
  { value: 'research',     label: 'Research' },
  { value: 'safety',       label: 'Safety' },
  { value: 'gardening',    label: 'Gardening' },
  { value: 'foraging',     label: 'Foraging' },
  { value: 'recipes',      label: 'Recipes' },
  { value: 'news',         label: 'News' },
  { value: 'interviews',   label: 'Interviews' },
];

const statusOptions = [
  { value: 'all',      label: 'All' },
  { value: 'review',   label: 'Review Requests' },
  { value: 'draft',    label: 'Draft' },
  { value: 'published',label: 'Published' },
  { value: 'archived', label: 'Archived' },
];

/* ─── Status badge: use design-system tokens ─── */
const STATUS_STYLES = {
  review:   { background: 'var(--color-intent-warning-weak)', color: 'var(--text-warning)',  borderColor: 'var(--border-warning)' },
  draft:    { background: 'var(--color-intent-info-weak)',    color: 'var(--text-secondary)', borderColor: 'var(--border-primary)' },
  archived: { background: 'var(--color-intent-danger-weak)',  color: 'var(--icon-danger)',    borderColor: 'var(--border-danger)' },
  published:{ background: 'var(--color-intent-success-weak)', color: 'var(--text-success)',   borderColor: 'var(--border-success)' },
};
const getStatusStyle = (status) => STATUS_STYLES[(status || 'published').toLowerCase()] || STATUS_STYLES.published;

const BLOG_LIST_STYLES = `
  .bl-grid { position: relative; height: calc(100dvh - 4rem); min-height: calc(100dvh - 4rem); overflow: hidden; background: var(--base-tertiary); }
  .bl-main { min-width: 0; height: 100%; overflow-y: auto; padding: 16px 280px 56px 24px; }
  .bl-main-inner { max-width: 680px; margin: 0 auto; }

  /* Eyebrow / section label */
  .eyebrow { display: flex; align-items: center; gap: 8px; }
  .eyebrow-bar { width: 10px; height: 1.5px; background: var(--border-brand); flex-shrink: 0; }
  .eyebrow-text { font-family: var(--font-mono); font-size: 9px; font-weight: 600; letter-spacing: .18em; text-transform: uppercase; color: var(--text-secondary); }

  /* Top lanes (featured / trending) */
  .bl-top-lane { margin-bottom: 24px; }
  .bl-top-row { margin-top: 10px; display: flex; gap: 10px; overflow-x: auto; -webkit-overflow-scrolling: touch; scrollbar-width: none; }
  .bl-top-row::-webkit-scrollbar { display: none; }
  .bl-top-row--trending { flex-wrap: nowrap; overflow-x: auto; overscroll-behavior-x: contain; -webkit-overflow-scrolling: touch; scrollbar-width: none; }
  .bl-top-row--trending::-webkit-scrollbar { display: none; }

  /* Top cards */
  .bl-top-card {
    min-width: 240px; max-width: 240px;
    background: var(--surface-primary);
    border: 1.5px solid var(--border-primary);
    border-left: 3px solid var(--border-weak);
    border-radius: 6px;
    padding: 12px;
    text-decoration: none;
    color: inherit;
    transition: border-left-color 150ms, box-shadow 150ms;
    display: block;
  }
  .bl-top-card:hover { border-left-color: var(--border-brand); box-shadow: 3px 3px 0 var(--surface-tertiary); }

  .bl-top-thumb { width: 100%; height: 84px; border-radius: 4px; overflow: hidden; background: var(--surface-secondary); border: 1px solid var(--border-primary); margin-bottom: 8px; }
  .bl-top-thumb img { width: 100%; height: 100%; object-fit: cover; display: block; }

  .bl-top-title { font-family: var(--font-ui); font-size: .9rem; font-weight: 600; line-height: 1.35; color: var(--text-primary); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; margin-bottom: 6px; }
  .bl-top-meta { display: flex; align-items: center; gap: 6px; font-family: var(--font-mono); font-size: 9px; letter-spacing: .08em; color: var(--text-tertiary); }
  .bl-featured-chip { margin-left: auto; border: 1px solid var(--border-brand); background: var(--surface-accent); color: var(--text-accent); font-size: 9px; letter-spacing: .1em; text-transform: uppercase; padding: 2px 6px; border-radius: 3px; font-family: var(--font-mono); }

  /* Blog list */
  .bl-cards { display: flex; flex-direction: column; gap: 10px; }

  /* Main blog card */
  .bl-card {
    display: flex; gap: 14px; padding: 16px 18px;
    background: var(--surface-primary);
    border: 1.5px solid var(--border-primary);
    border-left: 3px solid var(--border-weak);
    border-radius: 6px;
    text-decoration: none; color: inherit;
    transition: border-left-color 150ms, box-shadow 150ms;
  }
  .bl-card:hover { border-left-color: var(--border-brand); box-shadow: 3px 3px 0 var(--surface-tertiary); }

  .bl-thumb { flex-shrink: 0; width: 96px; height: 68px; border-radius: 4px; background: var(--surface-secondary); border: 1px solid var(--border-primary); overflow: hidden; }
  .bl-thumb img { width: 100%; height: 100%; object-fit: cover; display: block; }

  .bl-card-body { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 5px; }
  .bl-meta { display: flex; align-items: center; gap: 7px; }
  .bl-category { font-family: var(--font-mono); font-size: 9px; font-weight: 600; letter-spacing: .16em; text-transform: uppercase; color: var(--text-accent); }
  .bl-dot { color: var(--border-primary); font-size: 10px; }
  .bl-readtime { font-family: var(--font-mono); font-size: 9px; letter-spacing: .06em; color: var(--text-tertiary); }

  .bl-status-badge { margin-left: auto; font-family: var(--font-mono); font-size: 9px; font-weight: 600; letter-spacing: .1em; text-transform: uppercase; padding: 2px 7px; border-radius: 3px; border: 1px solid; }

  .bl-title { font-family: var(--font-ui); font-size: 1rem; font-weight: 600; line-height: 1.35; color: var(--text-primary); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .bl-excerpt { font-family: var(--font-ui); font-size: 12px; color: var(--text-tertiary); line-height: 1.65; overflow: hidden; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; }

  .bl-author-row { display: flex; align-items: center; gap: 7px; margin-top: 2px; }
  .bl-author-name { font-family: var(--font-ui); font-size: 11px; color: var(--text-secondary); }
  .bl-date { font-family: var(--font-mono); font-size: 9px; letter-spacing: .06em; color: var(--text-tertiary); }

  /* Empty state */
  .bl-empty { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 10px; min-height: 240px; border: 1.5px dashed var(--border-primary); border-radius: 6px; color: var(--text-tertiary); }

  /* Pagination */
  .bl-pagination { display: flex; align-items: center; justify-content: center; gap: 5px; margin-top: 28px; }
  .bl-page-btn { width: 32px; height: 32px; border-radius: 4px; font-family: var(--font-mono); font-size: 11px; cursor: pointer; transition: all .15s; border: 1.5px solid var(--border-primary); background: transparent; color: var(--text-tertiary); }
  .bl-page-btn.active { border-color: var(--border-brand); background: var(--interactive-brand-primary); color: var(--text-on-brand); font-weight: 700; }
  .bl-page-btn:disabled { opacity: .4; cursor: default; }

  /* Right sidebar */
  .bl-sidebar { position: absolute; top: 12px; right: 24px; bottom: 12px; width: 228px; background: var(--surface-primary); border: 1.5px solid var(--border-primary); border-left: 3px solid var(--border-brand); border-radius: 6px; display: flex; flex-direction: column; overflow: visible; z-index: 5; box-shadow: 3px 3px 0 var(--surface-tertiary); }
  .bl-sb-section { padding: 16px 14px 16px 16px; }
  .bl-sb-section + .bl-sb-section { border-top: 1px solid var(--border-primary); }
  .bl-sb-section.io-reveal, .bl-sb-section.io-reveal.io-visible { transform: none; }
  .bl-sb-actions { display: flex; flex-direction: column; gap: 7px; margin-top: 12px; }

  /* Stats */
  .bl-stats-row { display: flex; justify-content: space-between; align-items: baseline; margin-top: 12px; }
  .bl-stats-label { font-family: var(--font-mono); font-size: 9px; letter-spacing: .1em; text-transform: uppercase; color: var(--text-tertiary); }
  .bl-stats-count { font-family: var(--font-ui); font-size: 1.9rem; font-weight: 800; color: var(--text-accent); line-height: 1; }

  /* Login overlay */
  .bl-login-overlay { position: fixed; inset: 0; z-index: 60; background: rgba(0,0,0,.5); backdrop-filter: blur(4px); display: flex; align-items: center; justify-content: center; padding: 16px; }
  .bl-login-card { width: min(400px, 100%); padding: 22px; background: var(--surface-primary); border: 1.5px solid var(--border-primary); border-left: 3px solid var(--border-brand); border-radius: 6px; display: flex; flex-direction: column; gap: 16px; box-shadow: 4px 4px 0 var(--surface-tertiary); }
  .bl-login-copy { font-family: var(--font-ui); color: var(--text-secondary); line-height: 1.6; font-size: 13px; }
  .bl-login-actions { display: flex; gap: 8px; }

  /* Mobile */
  .bl-mobile-topbar { display: none; position: sticky; top: 0; z-index: 25; }
  .bl-mobile-topbar-inner { display: grid; grid-template-columns: minmax(0,1fr) 140px; gap: 8px; padding: 10px 14px; background: var(--base-tertiary); border-bottom: 1.5px solid var(--border-primary); }
  .bl-mobile-search { width: 100%; padding: 8px 12px; background: var(--surface-primary); border: 1.5px solid var(--border-primary); border-radius: 5px; font-family: var(--font-ui); font-size: 13px; color: var(--text-primary); outline: none; }
  .bl-mobile-select { width: 100%; padding: 8px 28px 8px 10px; background: var(--surface-secondary); border: 1.5px solid var(--border-primary); border-radius: 5px; font-family: var(--font-ui); font-size: 13px; color: var(--text-primary); outline: none; appearance: none; background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%237a7670' stroke-width='2'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E"); background-repeat: no-repeat; background-position: right 10px center; }

  @media (max-width: 900px) {
    .bl-grid { display: block; height: auto; min-height: auto; overflow: visible; }
    .bl-sidebar { display: none; }
    .bl-main { height: auto; overflow: visible; padding: 72px 14px 24px; }
    .bl-mobile-topbar { display: block; }
    .bl-top-row--trending .bl-top-card { min-width: 78vw; max-width: 78vw; }
  }
`;

const SectionLabel = ({ children }) => (
  <div className="eyebrow">
    <div className="eyebrow-bar" />
    <span className="eyebrow-text">{children}</span>
  </div>
);

const formatCategory = (value) => (value ? value.replace(/_/g, ' ') : 'General');
const formatDate = (value) => {
  if (!value) return '';
  return new Date(value).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
};
const getReadingTime = (blog) => {
  if (blog?.readingTime) return `${blog.readingTime} min read`;
  const text = `${blog?.excerpt || ''} ${blog?.content || ''}`.trim();
  if (!text) return '3 min read';
  return `${Math.max(1, Math.round(text.split(/\s+/).length / 220))} min read`;
};

const buildPageItems = (current, total) => {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  if (current <= 3) return [1, 2, 3, 'ellipsis-right', total];
  if (current >= total - 2) return [1, 'ellipsis-left', total - 2, total - 1, total];
  return [1, 'ellipsis-left', current, 'ellipsis-right', total];
};

const BlogPage = () => {
  const [blogs, setBlogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [selectedStatus, setSelectedStatus] = useState('review');
  const [viewMode, setViewMode] = useState('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [searchInput, setSearchInput] = useState('');
  const [showRestrictedOverlay, setShowRestrictedOverlay] = useState(false);
  const [pagination, setPagination] = useState({ page: 1, limit: 10, total: 0, pages: 0 });
  const [stats, setStats] = useState({ all: 0, draft: 0, review: 0, published: 0, archived: 0 });
  const [featuredBlogs, setFeaturedBlogs] = useState([]);
  const [trendingBlogs, setTrendingBlogs] = useState([]);
  const listRequestSeqRef = useRef(0);
  const topSectionsRequestSeqRef = useRef(0);

  const navigate = useNavigate();
  const { user } = useAuth();
  const { addTask, completeTask } = useLoaderActions();
  const observeReveal = useBatchIntersectionObserver({ threshold: 0.08, rootMargin: '140px 0px' });
  const canModerate = user && (user.role === 'admin' || user.role === 'moderator');
  const mainScrollRef = useRef();
  const trendingRef = useRef();
  const [activeIndex, setActiveIndex] = useState(0);

  /* ── Horizontal wheel scroll for trending strip ── */
  useEffect(() => {
    const el = trendingRef.current;
    if (!el) return undefined;
    const handleWheel = (e) => {
      if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) return;
      if (!(el.scrollWidth > el.clientWidth)) return;
      e.preventDefault();
      el.scrollLeft += e.deltaY * 0.8;
    };
    el.addEventListener('wheel', handleWheel, { passive: false });
    return () => el.removeEventListener('wheel', handleWheel);
  }, [trendingBlogs.length]);

  const updateActiveIndex = () => {
    if (!trendingRef.current) return;
    const { scrollLeft, scrollWidth, clientWidth } = trendingRef.current;
    const maxScroll = scrollWidth - clientWidth;
    if (scrollLeft >= maxScroll - 10) { setActiveIndex(trendingBlogs.length - 1); return; }
    setActiveIndex(Math.min(Math.max(Math.round(scrollLeft / 250), 0), trendingBlogs.length - 1));
  };

  const scrollToIndex = (i) => {
    if (trendingRef.current) trendingRef.current.scrollLeft = i * 250;
  };

  /* ── Fetch list ── */
  useEffect(() => {
    const fetchBlogs = async () => {
      const requestId = listRequestSeqRef.current + 1;
      listRequestSeqRef.current = requestId;
      const taskId = `blog-page:list:${requestId}`;
      addTask(taskId);
      try {
        setLoading(true);
        setError(null);
        if (viewMode === 'saved') {
          const response = await blogApi.getSavedBlogs({ page: currentPage, limit: 10 });
          const payload = response?.data || {};
          if (payload?.blogs && payload?.pagination) { setBlogs(payload.blogs); setPagination(payload.pagination); }
          else setError('Failed to fetch saved blogs');
        } else if (canModerate) {
          const response = await blogApi.getAdminBlogs({ page: currentPage, limit: 10, status: selectedStatus });
          if (response?.blogs && response?.pagination) { setBlogs(response.blogs); setPagination(response.pagination); setStats(response.stats || stats); }
          else setError('Failed to fetch blogs');
        } else {
          const params = { page: currentPage, limit: 10 };
          if (selectedCategory !== 'all') params.category = selectedCategory;
          const response = await blogApi.getPublishedBlogs(params);
          if (response.data?.blogs && response.data?.pagination) { setBlogs(response.data.blogs); setPagination(response.data.pagination); }
          else setError('Failed to fetch blogs');
        }
      } catch (err) {
        setError(err.message || 'Failed to fetch blogs');
      } finally {
        completeTask(taskId);
        setLoading(false);
      }
    };
    fetchBlogs();
  }, [selectedCategory, selectedStatus, currentPage, canModerate, viewMode, addTask, completeTask]);

  /* ── Fetch featured + trending ── */
  useEffect(() => {
    const load = async () => {
      const requestId = topSectionsRequestSeqRef.current + 1;
      topSectionsRequestSeqRef.current = requestId;
      const taskId = `blog-page:top-sections:${requestId}`;
      addTask(taskId);
      if (canModerate) { setFeaturedBlogs([]); setTrendingBlogs([]); completeTask(taskId); return; }
      try {
        const [featuredRes, trendingRes] = await Promise.all([
          blogApi.getFeaturedBlogs({ limit: 10 }),
          blogApi.getTrendingBlogs({ limit: 10 }),
        ]);
        setFeaturedBlogs(Array.isArray(featuredRes?.data) ? featuredRes.data : (Array.isArray(featuredRes) ? featuredRes : []));
        setTrendingBlogs(Array.isArray(trendingRes?.data) ? trendingRes.data : (Array.isArray(trendingRes) ? trendingRes : []));
      } catch { setFeaturedBlogs([]); setTrendingBlogs([]); }
      finally { completeTask(taskId); }
    };
    load();
  }, [canModerate, addTask, completeTask]);

  const filteredBlogs = useMemo(() => {
    const term = searchInput.trim().toLowerCase();
    if (!term) return blogs;
    return blogs.filter((b) =>
      b.title?.toLowerCase().includes(term) ||
      b.excerpt?.toLowerCase().includes(term) ||
      b.category?.toLowerCase().includes(term) ||
      b.author?.displayName?.toLowerCase().includes(term)
    );
  }, [blogs, searchInput]);

  const selectedCategoryLabel = categories.find((c) => c.value === selectedCategory)?.label || 'All Posts';
  const selectedStatusLabel   = statusOptions.find((s) => s.value === selectedStatus)?.label || 'All';
  const selectedLabel = viewMode === 'saved' ? 'Saved Blogs' : (canModerate ? selectedStatusLabel : selectedCategoryLabel);
  const statsCount = searchInput.trim() ? filteredBlogs.length : (viewMode === 'saved' ? pagination.total : (canModerate ? (stats[selectedStatus] ?? stats.all) : pagination.total));
  const totalPages = canModerate ? (pagination.totalPages || 1) : (pagination.pages || 1);
  const pageItems  = buildPageItems(pagination.page || 1, totalPages);

  const onCategoryChange = (v) => { setSelectedCategory(v); setCurrentPage(1); };
  const onStatusChange   = (v) => { setSelectedStatus(v); setCurrentPage(1); };
  const onViewModeChange = (mode) => {
    if (mode === 'saved' && !user) { setShowRestrictedOverlay(true); return; }
    setViewMode(mode); setCurrentPage(1);
  };

  if (error) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh', padding: 24 }}>
        <div className="card" style={{ padding: '14px 16px', borderLeftColor: 'var(--border-danger)' }}>
          <span style={{ fontFamily: 'var(--font-ui)', fontSize: 13, color: 'var(--icon-danger)' }}>{error}</span>
        </div>
      </div>
    );
  }

  return (
    <>
      <style>{BLOG_LIST_STYLES}</style>
      <div className="bl-grid">
        {/* Mobile top bar */}
        <BlogSidepanel
          hideDesktop
          mobileControls={{
            searchValue: searchInput,
            onSearchChange: setSearchInput,
            searchPlaceholder: 'Search posts…',
            filterValue: canModerate ? selectedStatus : selectedCategory,
            onFilterChange: canModerate ? onStatusChange : onCategoryChange,
            filterOptions: canModerate ? statusOptions : categories,
            filterAriaLabel: canModerate ? 'Status filter mobile' : 'Category filter mobile',
            overlay: true, overlayTop: 64, overlayZIndex: 45,
          }}
        />

        {/* ── Main content ── */}
        <main className="bl-main" ref={mainScrollRef}>
          <div className="bl-main-inner">
            <div className="bl-cards">

              {/* Featured lane */}
              {!canModerate && featuredBlogs.length > 0 && (
                <div className="bl-top-lane io-reveal" data-io-animation="fade" ref={observeReveal('featured-lane')}>
                  <SectionLabel>Featured</SectionLabel>
                  <div className="bl-top-row">
                    {featuredBlogs.map((blog) => (
                      <Link key={`featured-${blog._id}`} to={`/blog/${blog.slug}`} className="bl-top-card">
                        {blog.featuredImage?.url && (
                          <div className="bl-top-thumb">
                            <img src={blog.featuredImage.url} alt={blog.featuredImage?.alt || blog.title} />
                          </div>
                        )}
                        <div className="bl-top-title">{blog.title}</div>
                        <div className="bl-top-meta">
                          <span>{Number(blog.likeCount || 0)} likes</span>
                          <span className="bl-dot">·</span>
                          <span>{Number(blog.analytics?.views || 0)} views</span>
                          <span className="bl-featured-chip">Featured</span>
                        </div>
                      </Link>
                    ))}
                  </div>
                </div>
              )}

              {/* Trending lane */}
              {!canModerate && trendingBlogs.length > 0 && (
                <div className="bl-top-lane io-reveal" data-io-animation="fade" ref={observeReveal('trending-lane')}>
                  <SectionLabel>Trending</SectionLabel>
                  <div className="bl-top-row bl-top-row--trending" ref={trendingRef} onScroll={updateActiveIndex}>
                    {trendingBlogs.map((blog) => (
                      <Link key={`trending-${blog._id}`} to={`/blog/${blog.slug}`} className="bl-top-card">
                        {blog.featuredImage?.url && (
                          <div className="bl-top-thumb">
                            <img src={blog.featuredImage.url} alt={blog.featuredImage?.alt || blog.title} />
                          </div>
                        )}
                        <div className="bl-top-title">{blog.title}</div>
                        <div className="bl-top-meta">
                          <span>{Number(blog.likeCount || 0)} likes</span>
                          <span className="bl-dot">·</span>
                          <span>{Number(blog.analytics?.views || 0)} views</span>
                        </div>
                      </Link>
                    ))}
                  </div>
                  <CarouselDots total={trendingBlogs.length} activeIndex={activeIndex} onChange={scrollToIndex} />
                </div>
              )}

              {/* Loading skeleton */}
              {loading && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {[1, 2, 3, 4].map((i) => (
                    <div key={i} style={{ height: 100, borderRadius: 6, background: 'var(--surface-secondary)', border: '1.5px solid var(--border-primary)', animation: 'pulse 1.5s infinite' }} />
                  ))}
                </div>
              )}

              {/* Empty state */}
              {!loading && filteredBlogs.length === 0 && (
                <div className="bl-empty io-reveal" data-io-animation="fade" ref={observeReveal('blog-empty')}>
                  <SectionLabel>No Results</SectionLabel>
                  <span style={{ fontFamily: 'var(--font-ui)', fontSize: 13, color: 'var(--text-tertiary)' }}>
                    No posts match this filter.
                  </span>
                </div>
              )}

              {/* Blog cards */}
              {!loading && filteredBlogs.map((blog) => (
                <Link
                  key={blog._id}
                  to={canModerate ? `/blog/${blog.slug}?id=${blog._id}` : `/blog/${blog.slug}`}
                  ref={observeReveal(`blog-card-${blog._id}`)}
                  className="bl-card io-reveal"
                  data-io-animation="slide"
                >
                  {blog.featuredImage && (
                    <div className="bl-thumb">
                      <img src={blog.featuredImage?.url || blog.featuredImage} alt={blog.featuredImage?.alt || blog.title} />
                    </div>
                  )}
                  <div className="bl-card-body">
                    <div className="bl-meta">
                      <span className="bl-category">{formatCategory(blog.category)}</span>
                      <span className="bl-dot">·</span>
                      <span className="bl-readtime">{getReadingTime(blog)}</span>
                      {canModerate && (
                        <span className="bl-status-badge" style={getStatusStyle(blog.status)}>
                          {blog.status === 'review' ? 'Under Review' : (blog.status || 'Published')}
                        </span>
                      )}
                    </div>
                    <div className="bl-title">{blog.title}</div>
                    <p className="bl-excerpt">{blog.excerpt}</p>
                    <div className="bl-author-row">
                      <ProfilePicture size="sm" currentPhotoURL={blog.author?.photoURL} className="flex-shrink-0" />
                      <span className="bl-author-name">{blog.author?.displayName || 'Unknown'}</span>
                      <span className="bl-dot">·</span>
                      <span className="bl-date">{formatDate(blog.publishedAt || blog.createdAt)}</span>
                    </div>
                  </div>
                </Link>
              ))}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="bl-pagination">
                {pageItems.map((item, index) => (
                  <button
                    key={`${item}-${index}`}
                    type="button"
                    disabled={String(item).includes('ellipsis')}
                    onClick={() => typeof item === 'number' && setCurrentPage(item)}
                    className={`bl-page-btn${item === pagination.page ? ' active' : ''}`}
                  >
                    {String(item).includes('ellipsis') ? '…' : item}
                  </button>
                ))}
              </div>
            )}
          </div>
        </main>

        {/* ── Right sidebar ── */}
        <aside className="bl-sidebar">
          <BlogSidepanel
            sectionRef={observeReveal('blog-sidebar-actions')}
            actions={[
              {
                key: 'create',
                label: canModerate ? 'Create Post' : 'Write a Post',
                variant: 'primary',
                onClick: () => (user ? navigate('/blog/create') : setShowRestrictedOverlay(true)),
                icon: (
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <path strokeLinecap="round" d="M12 4v16m8-8H4" />
                  </svg>
                ),
              },
              user ? {
                key: 'my-blogs',
                label: 'My Blogs',
                variant: 'outline',
                onClick: () => navigate('/blog/my-blogs'),
                icon: (
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                    <path strokeLinecap="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                ),
              } : null,
              {
                key: 'toggle-saved',
                label: viewMode === 'saved' ? 'View All Blogs' : 'Saved Blogs',
                variant: 'outline',
                onClick: () => onViewModeChange(viewMode === 'saved' ? 'all' : 'saved'),
                icon: (
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 4h12a1 1 0 011 1v15l-7-3-7 3V5a1 1 0 011-1z" />
                  </svg>
                ),
              },
            ]}
          />

          {/* Search */}
          <div className="bl-sb-section io-reveal" data-io-animation="fade" ref={observeReveal('blog-sidebar-search')}>
            <SectionLabel>Search</SectionLabel>
            <div style={{ marginTop: 10 }}>
              <SearchBar
                value={searchInput}
                onChange={setSearchInput}
                placeholder="Search blog posts…"
                defaultWidth="w-full"
                focusedWidth="w-full"
              />
            </div>
          </div>

          {/* Filter */}
          <div className="bl-sb-section io-reveal" data-io-animation="fade" ref={observeReveal('blog-sidebar-filter')}>
            <SectionLabel>Filter</SectionLabel>
            <div style={{ marginTop: 10 }}>
              <Dropdown
                value={canModerate ? selectedStatus : selectedCategory}
                onChange={canModerate ? onStatusChange : onCategoryChange}
                options={canModerate
                  ? statusOptions.map((s) => ({ value: s.value, label: `${s.label} (${stats[s.value] ?? stats.all})` }))
                  : categories
                }
                size="sm"
              />
            </div>
          </div>

          {/* Stats */}
          <div className="bl-sb-section io-reveal" data-io-animation="fade" ref={observeReveal('blog-sidebar-stats')}>
            <SectionLabel>Stats</SectionLabel>
            <div className="bl-stats-row">
              <span className="bl-stats-label">{selectedLabel}</span>
              <span className="bl-stats-count">{statsCount}</span>
            </div>
          </div>
        </aside>
      </div>

      {/* ── Login-required overlay ── */}
      {showRestrictedOverlay && (
        <div className="bl-login-overlay" onClick={() => setShowRestrictedOverlay(false)}>
          <div className="bl-login-card" onClick={(e) => e.stopPropagation()}>
            <SectionLabel>Sign in required</SectionLabel>
            <p className="bl-login-copy">Sign in to share your herbal knowledge with the community, or to access your saved posts.</p>
            <div className="bl-login-actions">
              <Button variant="primary" size="sm" onClick={() => { setShowRestrictedOverlay(false); navigate('/login'); }}>
                Sign In
              </Button>
              <Button variant="outline" size="sm" onClick={() => setShowRestrictedOverlay(false)}>
                Close
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default BlogPage;