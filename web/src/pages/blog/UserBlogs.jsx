import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Button from '../../components/common/Button';
import SearchBar from '../../components/common/SearchBar';
import Dropdown from '../../components/common/Dropdown';
import BlogSidepanel from '../../components/blog/BlogSidepanel';
import blogApi from '../../services/blogService';
import useBatchIntersectionObserver from '../../hooks/useBatchIntersectionObserver';
import { useLoaderActions } from '../../hooks/useLoader';

const USER_BLOGS_STYLES = `
  .bl-grid { position: relative; height: calc(100dvh - 4rem); min-height: calc(100dvh - 4rem); overflow: hidden; background: var(--base-tertiary, #101315); }
  .bl-main { min-width: 0; height: 100%; overflow-y: auto; padding: 12px 280px 56px 24px; }
  .bl-main-inner { max-width: 680px; margin: 0 auto; }
  .eyebrow { display: flex; align-items: center; gap: 10px; }
  .eyebrow-bar { width: 3px; height: 14px; border-radius: 999px; background: var(--border-brand, #7fa87f); flex-shrink: 0; }
  .eyebrow-text { font-family: 'DM Sans', sans-serif; font-size: 10px; font-weight: 600; letter-spacing: .22em; text-transform: uppercase; color: var(--text-brand, #8fbf8f); }
  .bl-section-count { font-family: 'DM Sans', sans-serif; font-size: 11px; color: var(--text-tertiary, #7a7670); letter-spacing: .1em; text-transform: uppercase; }
  .bl-card { display: flex; gap: 16px; padding: 18px 20px; background: var(--surface-primary, #1a1a1a); border: 1px solid var(--border-secondary, rgba(255,255,255,.1)); border-radius: 8px; text-decoration: none; color: inherit; transition: border-color .2s, box-shadow .2s; margin-bottom: 12px; cursor: pointer; }
  .bl-card:hover { border-color: var(--border-brand, #7fa87f); box-shadow: 0 4px 24px rgba(0,0,0,.2); }
  .bl-thumb { flex-shrink: 0; width: 104px; height: 74px; border-radius: 5px; background: linear-gradient(135deg, var(--surface-secondary, #222), var(--border-weak, rgba(255,255,255,.06))); border: 1px solid var(--border-weak, rgba(255,255,255,.06)); overflow: hidden; }
  .bl-thumb img { width: 100%; height: 100%; object-fit: cover; display: block; }
  .bl-card-body { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 6px; }
  .bl-meta { display: flex; align-items: center; gap: 8px; }
  .bl-category { font-family: 'DM Sans', sans-serif; font-size: 10px; font-weight: 600; letter-spacing: .16em; text-transform: uppercase; color: var(--text-brand, #8fbf8f); }
  .bl-dot { color: var(--border-primary, rgba(255,255,255,.12)); font-size: 12px; }
  .bl-readtime { font-family: 'DM Sans', sans-serif; font-size: 11px; color: var(--text-weak, #504e4a); }
  .bl-status-badge { margin-left: auto; font-family: 'DM Sans', sans-serif; font-size: 10px; font-weight: 600; letter-spacing: .1em; text-transform: uppercase; padding: 2px 8px; border-radius: 3px; border: 1px solid rgba(127,168,127,.25); background: rgba(127,168,127,.12); color: var(--text-brand, #8fbf8f); }
  .bl-title { font-family: 'Fraunces', Georgia, serif; font-size: 1.05rem; line-height: 1.35; color: var(--text-primary, #f0ede8); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .bl-excerpt { font-family: 'DM Sans', sans-serif; font-size: 13px; color: var(--text-tertiary, #7a7670); line-height: 1.6; overflow: hidden; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; }
  .bl-author-row { display: flex; align-items: center; gap: 8px; margin-top: 2px; }
  .bl-date { font-family: 'DM Sans', sans-serif; font-size: 11px; color: var(--text-weak, #504e4a); }
  .bl-actions { margin-left: auto; display: flex; gap: 6px; }
  .bl-menu-wrap { margin-left: auto; position: relative; }
  .bl-menu-trigger { width: 32px; height: 32px; border-radius: 6px; border: 1px solid var(--border-secondary, rgba(255,255,255,.1)); background: transparent; color: var(--text-secondary, #b8b4ac); cursor: pointer; font-size: 18px; line-height: 1; display: inline-flex; align-items: center; justify-content: center; }
  .bl-menu-panel { position: absolute; right: 0; top: calc(100% + 6px); min-width: 170px; z-index: 20; background: var(--surface-primary, #1a1a1a); border: 1px solid var(--border-secondary, rgba(255,255,255,.1)); border-radius: 8px; padding: 6px; box-shadow: 0 10px 26px rgba(0,0,0,.28); }
  .bl-menu-item { width: 100%; text-align: left; border: none; background: transparent; color: var(--text-secondary, #b8b4ac); padding: 8px 10px; border-radius: 6px; font-family: 'DM Sans', sans-serif; font-size: 12px; cursor: pointer; }
  .bl-menu-item:hover { background: var(--surface-secondary, #222); color: var(--text-primary, #f0ede8); }
  .bl-btn-sm { padding: 4px 10px; border-radius: 3px; font-family: 'DM Sans', sans-serif; font-size: 10px; letter-spacing: .12em; text-transform: uppercase; font-weight: 600; cursor: pointer; background: transparent; }
  .bl-btn-edit { border: 1px solid var(--border-secondary, rgba(255,255,255,.1)); color: var(--text-secondary, #b8b4ac); }
  .bl-btn-delete { border: 1px solid rgba(200,70,70,.35); color: rgba(200,100,100,.85); }
  .bl-empty { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 12px; min-height: 260px; border: 1px dashed var(--border-secondary, rgba(255,255,255,.1)); border-radius: 8px; color: var(--text-tertiary, #7a7670); }
  .bl-sidebar { position: absolute; top: 12px; right: 24px; bottom: 12px; width: 232px; background: var(--base-primary, #0f0f0f); border: 1px solid var(--border-weak, rgba(255,255,255,.06)); border-radius: 8px; display: flex; flex-direction: column; overflow-y: auto; z-index: 5; }
  .bl-sb-section { padding: 18px 16px; }
  .bl-sb-section + .bl-sb-section { border-top: 1px solid var(--border-weak, rgba(255,255,255,.06)); }
  .bl-sb-section.io-reveal,
  .bl-sb-section.io-reveal.io-visible { transform: none; }
  .bl-sb-actions { display: flex; flex-direction: column; gap: 8px; margin-top: 14px; }
  .bl-sb-btn { display: flex; align-items: center; justify-content: center; gap: 8px; width: 100%; padding: 10px 14px; border-radius: 4px; font-family: 'DM Sans', sans-serif; font-size: 11px; font-weight: 600; letter-spacing: .14em; text-transform: uppercase; cursor: pointer; transition: opacity .15s; }
  .bl-sb-btn:hover { opacity: .85; }
  .bl-sb-btn-primary { border: 1px solid var(--border-brand, #7fa87f); background: var(--interactive-brand-primary, #7fa87f); color: var(--text-on-brand, #0d160d); }
  .bl-sb-btn-ghost { border: 1px solid var(--border-secondary, rgba(255,255,255,.1)); background: transparent; color: var(--text-secondary, #b8b4ac); }
  .bl-filter-select { width: 100%; margin-top: 12px; padding: 10px 36px 10px 13px; background: var(--surface-secondary, #222); border: 1px solid var(--border-secondary, rgba(255,255,255,.1)); border-radius: 5px; font-family: 'DM Sans', sans-serif; font-size: 13px; color: var(--text-primary, #f0ede8); outline: none; cursor: pointer; appearance: none; background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%237a7670' stroke-width='2'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E"); background-repeat: no-repeat; background-position: right 12px center; }
  .bl-stats-row { display: flex; justify-content: space-between; align-items: baseline; margin-top: 14px; }
  .bl-stats-label { font-family: 'DM Sans', sans-serif; font-size: 12px; color: var(--text-tertiary, #7a7670); }
  .bl-stats-count { font-family: 'Fraunces', serif; font-size: 1.8rem; font-weight: 700; color: var(--text-brand, #8fbf8f); line-height: 1; }
  @media (max-width: 900px) {
    .bl-grid { display: block; height: auto; min-height: auto; overflow: visible; }
    .bl-sidebar { display: none; }
    .bl-main { height: auto; overflow: visible; padding: 12px 14px 20px; }
  }
`;

const statusOptions = [
  { value: 'all', label: 'All' },
  { value: 'published', label: 'Published' },
  { value: 'review', label: 'In Review' },
  { value: 'draft', label: 'Drafts' },
  { value: 'archived', label: 'Archived' },
];

const getStatusStyle = (status) => {
  if (status === 'review') return { background: 'rgba(200,140,40,.12)', color: 'rgba(200,160,70,.9)', borderColor: 'rgba(200,140,40,.25)' };
  if (status === 'draft') return { background: 'rgba(100,100,180,.12)', color: 'rgba(130,130,200,.9)', borderColor: 'rgba(100,100,180,.25)' };
  if (status === 'archived') return { background: 'rgba(180,80,80,.12)', color: 'rgba(220,120,120,.95)', borderColor: 'rgba(180,80,80,.25)' };
  return {};
};

const formatDate = (blog) => {
  const value = blog.publishedAt || blog.createdAt;
  if (!value) return 'Unknown date';
  return new Date(value).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
};

const statusLabel = (status) => {
  if (status === 'review') return 'In Review';
  if (status === 'draft') return 'Draft';
  if (status === 'archived') return 'Archived';
  return 'Published';
};

const SectionLabel = ({ children }) => (
  <div className="eyebrow">
    <div className="eyebrow-bar" />
    <span className="eyebrow-text">{children}</span>
  </div>
);

const UserBlogs = () => {
  const navigate = useNavigate();
  const observeReveal = useBatchIntersectionObserver({ threshold: 0.08, rootMargin: '140px 0px' });
  const [blogs, setBlogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isFetching, setIsFetching] = useState(false);
  const [error, setError] = useState(null);
  const [selectedStatus, setSelectedStatus] = useState('all');
  const [searchInput, setSearchInput] = useState('');
  const [openMenuId, setOpenMenuId] = useState(null);
  const requestSeqRef = useRef(0);
  const hasLoadedRef = useRef(false);
  const { addTask, completeTask } = useLoaderActions();

  const fetchBlogs = useCallback(async ({ statusOverride, silent = false } = {}) => {
    const requestId = requestSeqRef.current + 1;
    requestSeqRef.current = requestId;
    const taskId = `user-blogs:list:${requestId}`;
    addTask(taskId);
    try {
      if (!silent) {
        if (!hasLoadedRef.current) setLoading(true);
        else setIsFetching(true);
      }
      setError(null);
      const effectiveStatus = statusOverride ?? selectedStatus;
      const params = effectiveStatus === 'all' ? {} : { status: effectiveStatus };
      const response = await blogApi.getUserBlogs(params);
      if (requestId !== requestSeqRef.current) return;
      if (!response?.blogs) {
        setError('Failed to fetch user blogs');
        return;
      }
      setBlogs(response.blogs);
      hasLoadedRef.current = true;
    } catch (err) {
      if (requestId !== requestSeqRef.current) return;
      setError(err.message || 'Failed to fetch user blogs');
    } finally {
      completeTask(taskId);
      if (requestId === requestSeqRef.current) {
        setLoading(false);
        setIsFetching(false);
      }
    }
  }, [selectedStatus, addTask, completeTask]);

  useEffect(() => {
    fetchBlogs();
  }, [fetchBlogs]);

  const counts = useMemo(() => ({
    all: blogs.length,
    published: blogs.filter((blog) => blog.status === 'published').length,
    review: blogs.filter((blog) => blog.status === 'review').length,
    draft: blogs.filter((blog) => blog.status === 'draft').length,
    archived: blogs.filter((blog) => blog.status === 'archived').length,
  }), [blogs]);

  const filteredBlogs = useMemo(() => {
    const statusFiltered = selectedStatus === 'all' ? blogs : blogs.filter((blog) => blog.status === selectedStatus);
    const term = searchInput.trim().toLowerCase();
    if (!term) return statusFiltered;
    return statusFiltered.filter((blog) => (
      blog.title?.toLowerCase().includes(term)
      || blog.excerpt?.toLowerCase().includes(term)
      || blog.category?.toLowerCase().includes(term)
    ));
  }, [blogs, selectedStatus, searchInput]);

  const handleRequestApproval = async (blog, event) => {
    event.stopPropagation();
    try {
      await blogApi.requestBlogApproval(blog._id);
      await fetchBlogs({ silent: true });
    } catch (err) {
      setError(err.message || 'Failed to request approval');
    }
  };

  const refreshUserBlogs = async () => {
    await fetchBlogs({ silent: true });
  };

  const handleArchiveToggle = async (blog, event) => {
    event.stopPropagation();
    try {
      const nextStatus = blog.status === 'archived' ? 'draft' : 'archived';
      await blogApi.updateBlogStatus(blog._id, nextStatus);
      await refreshUserBlogs();
    } catch (err) {
      setError(err.message || 'Failed to update blog status');
    }
  };

  useEffect(() => {
    const handleClickOutside = () => setOpenMenuId(null);
    window.addEventListener('click', handleClickOutside);
    return () => window.removeEventListener('click', handleClickOutside);
  }, []);

  if (error) {
    return (
      <div className="flex items-center justify-center px-6 py-16" style={{ minHeight: '100vh' }}>
        <style>{USER_BLOGS_STYLES}</style>
        <p className="text-secondary text-sm">{error}</p>
      </div>
    );
  }

  return (
    <div className="bl-grid">
      <style>{USER_BLOGS_STYLES}</style>

      <main className="bl-main">
        <div className="bl-main-inner">
          {isFetching && (
            <div className="text-xs text-tertiary font-mono uppercase tracking-wide mb-2">Updating posts...</div>
          )}
          {loading ? (
            <>
              {Array.from({ length: 6 }).map((_, index) => (
                <article key={`user-blog-skeleton-${index}`} className="bl-card animate-pulse">
                  <div className="bl-thumb bg-surface-secondary" />
                  <div className="bl-card-body">
                    <div className="h-3 w-24 rounded bg-surface-secondary" />
                    <div className="h-5 w-3/4 rounded bg-surface-secondary" />
                    <div className="h-4 w-full rounded bg-surface-secondary" />
                    <div className="h-4 w-1/2 rounded bg-surface-secondary" />
                  </div>
                </article>
              ))}
            </>
          ) : filteredBlogs.length === 0 ? (
            <div className="bl-empty io-reveal" data-io-animation="fade" ref={observeReveal('userblogs-empty')}>
              <SectionLabel>No Results</SectionLabel>
              <span className="bl-stats-label">No posts available in this status.</span>
              <Button
                variant="primary"
                size="sm"
                style={{ width: 200 }}
                onClick={() => navigate('/blog/create')}
              >
                Write New Blog
              </Button>
            </div>
          ) : (
            filteredBlogs.map((blog) => (
              <article
                key={blog._id}
                ref={observeReveal(`userblog-card-${blog._id}`)}
                className="bl-card io-reveal"
                data-io-animation="slide"
                onClick={() => navigate(`/blog/edit/${blog._id}`, { state: { fromMyBlogs: true } })}
              >
                {blog.featuredImage && (
                  <div className="bl-thumb">
                    <img src={blog.featuredImage?.url || blog.featuredImage} alt={blog.featuredImage?.alt || blog.title} />
                  </div>
                )}
                <div className="bl-card-body">
                  <div className="bl-meta">
                    <span className="bl-category">My Post</span>
                    <span className="bl-dot">.</span>
                    <span className="bl-readtime">{blog.readingTime || 3} min</span>
                    <span className="bl-status-badge" style={getStatusStyle(blog.status)}>{statusLabel(blog.status)}</span>
                  </div>
                  <h2 className="bl-title">{blog.title}</h2>
                  <p className="bl-excerpt">{blog.excerpt}</p>
                  <div className="bl-author-row">
                    <span className="bl-date">{formatDate(blog)}</span>
                    <div className="bl-menu-wrap" onClick={(event) => event.stopPropagation()}>
                      <button
                        type="button"
                        className="bl-menu-trigger"
                        aria-label="Open post actions"
                        onClick={(event) => {
                          event.stopPropagation();
                          setOpenMenuId((prev) => (prev === blog._id ? null : blog._id));
                        }}
                      >
                        &#8942;
                      </button>
                      {openMenuId === blog._id && (
                        <div className="bl-menu-panel">
                          <button type="button" className="bl-menu-item" onClick={() => navigate(`/blog/edit/${blog._id}`, { state: { fromMyBlogs: true } })}>
                            Edit
                          </button>
                          {blog.slug && (
                            <button type="button" className="bl-menu-item" onClick={() => navigate(`/blog/${blog.slug}`, { state: { fromMyBlogs: true } })}>
                              View
                            </button>
                          )}
                          {blog.status === 'draft' && (
                            <button type="button" className="bl-menu-item" onClick={(event) => handleRequestApproval(blog, event)}>
                              Request Approval
                            </button>
                          )}
                          <button type="button" className="bl-menu-item" onClick={(event) => handleArchiveToggle(blog, event)}>
                            {blog.status === 'archived' ? 'Unarchive' : 'Archive'}
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </article>
            ))
          )}
        </div>
      </main>

      <aside className="bl-sidebar">
        <BlogSidepanel
          sectionRef={observeReveal('userblogs-sidebar-actions')}
          actions={[
            {
              key: 'write',
              label: 'Write New Blog',
              variant: 'primary',
              onClick: () => navigate('/blog/create'),
            },
            {
              key: 'all-blogs',
              label: 'All Blogs',
              variant: 'outline',
              onClick: () => navigate('/blog'),
            },
          ]}
        />

        <div className="bl-sb-section io-reveal" data-io-animation="fade" ref={observeReveal('userblogs-sidebar-search')}>
          <SectionLabel>Search</SectionLabel>
          <SearchBar
            value={searchInput}
            onChange={setSearchInput}
            placeholder="Search my posts..."
            className="mt-3"
            iconClassName="text-tertiary"
            defaultWidth="w-full"
            focusedWidth="w-full"
          />
        </div>

        <div className="bl-sb-section io-reveal" data-io-animation="fade" ref={observeReveal('userblogs-sidebar-filter')}>
          <SectionLabel>Filter</SectionLabel>
          <div className="mt-3">
            <Dropdown
              value={selectedStatus}
              onChange={setSelectedStatus}
              options={statusOptions.map(status => ({
                value: status.value,
                label: `${status.label} (${counts[status.value]})`
              }))}
              size="sm"
            />
          </div>
        </div>

        <div className="bl-sb-section io-reveal" data-io-animation="fade" ref={observeReveal('userblogs-sidebar-stats')}>
          <SectionLabel>Stats</SectionLabel>
          <div className="bl-stats-row">
            <span className="bl-stats-label">Total posts</span>
            <span className="bl-stats-count">{counts.all}</span>
          </div>
        </div>
      </aside>
    </div>
  );
};

export default UserBlogs;
