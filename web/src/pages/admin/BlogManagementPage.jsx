import React, { useCallback, useEffect, useState } from 'react';
import ConfirmationModal from '../../components/modals/ConfirmationModal';
import blogApi from '../../services/blogService';
import { useToast } from '../../hooks/useToast';

const STATUS_OPTIONS = [
  { value: 'all',       label: 'All' },
  { value: 'review',    label: 'Review Requests' },
  { value: 'draft',     label: 'Draft' },
  { value: 'published', label: 'Published' },
  { value: 'archived',  label: 'Archived' },
];

const MODERATION_PRESETS = {
  published: [
    'Content verified and approved',
    'Meets publishing and safety guidelines',
    'Approved after editorial review',
  ],
  draft: [
    'Needs factual corrections',
    'Requires citation or source updates',
    'Does not meet content quality standards yet',
  ],
  archived: [
    'Outdated information',
    'Superseded by newer post',
    'Archived due to policy update',
  ],
  review: [
    'Queued for review',
    'Sent back for moderation review',
    'Requires secondary reviewer check',
  ],
};

/* ─── Status badge tokens ─── */
const STATUS_STYLES = {
  review:   { background: 'var(--color-intent-warning-weak)', color: 'var(--text-warning)',  borderColor: 'var(--border-warning)' },
  draft:    { background: 'var(--color-intent-info-weak)',    color: 'var(--text-secondary)', borderColor: 'var(--border-primary)' },
  archived: { background: 'var(--color-intent-danger-weak)',  color: 'var(--icon-danger)',    borderColor: 'var(--border-danger)' },
  published:{ background: 'var(--color-intent-success-weak)', color: 'var(--text-success)',   borderColor: 'var(--border-success)' },
};
const getStatusStyle = (status) => STATUS_STYLES[(status || 'draft').toLowerCase()] || {};

/* ─── Action button accent colours (token-based) ─── */
const ACTION_BTN = {
  approve: { borderColor: 'var(--border-success)',  color: 'var(--text-success)' },
  reject:  { borderColor: 'var(--border-warning)',  color: 'var(--text-warning)' },
  archive: { borderColor: 'var(--border-danger)',   color: 'var(--icon-danger)' },
  restore: { borderColor: 'var(--border-primary)',  color: 'var(--text-secondary)' },
  review:  { borderColor: 'var(--border-primary)',  color: 'var(--text-secondary)' },
};

const BLOG_ADMIN_STYLES = `
  .bm-grid { display: grid; grid-template-columns: 1fr 272px; align-items: start; min-height: 100vh; background: var(--base-secondary); }
  .bm-main { min-width: 0; padding: 0 24px 56px; }
  .bm-main-inner { max-width: 860px; margin: 0 auto; }

  /* Eyebrow */
  .eyebrow { display: flex; align-items: center; gap: 8px; }
  .eyebrow-bar { width: 10px; height: 1.5px; background: var(--border-brand); flex-shrink: 0; }
  .eyebrow-text { font-family: var(--font-mono); font-size: 9px; font-weight: 600; letter-spacing: .18em; text-transform: uppercase; color: var(--text-secondary); }

  /* Topbar */
  .bm-topbar { position: sticky; top: 0; z-index: 10; background: var(--base-secondary); border-bottom: 1.5px solid var(--border-primary); box-shadow: 0 1px 0 0 var(--border-brand); display: flex; align-items: center; justify-content: space-between; padding: 12px 0; margin-bottom: 20px; }
  .bm-section-count { font-family: var(--font-mono); font-size: 9px; letter-spacing: .1em; color: var(--text-tertiary); text-transform: uppercase; }

  /* Cards list */
  .bm-cards { display: flex; flex-direction: column; gap: 10px; }

  /* Single card */
  .bm-card { display: flex; gap: 14px; padding: 16px 18px; background: var(--surface-primary); border: 1.5px solid var(--border-primary); border-left: 3px solid var(--border-weak); border-radius: 6px; transition: border-left-color 150ms; }
  .bm-card:hover { border-left-color: var(--border-brand); }

  .bm-thumb { flex-shrink: 0; width: 96px; height: 68px; border-radius: 4px; background: var(--surface-secondary); border: 1px solid var(--border-primary); overflow: hidden; }
  .bm-thumb img { width: 100%; height: 100%; object-fit: cover; display: block; }

  .bm-card-body { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 5px; }

  .bm-meta { display: flex; align-items: center; gap: 7px; }
  .bm-category { font-family: var(--font-mono); font-size: 9px; font-weight: 600; letter-spacing: .16em; text-transform: uppercase; color: var(--text-accent); }
  .bm-dot { color: var(--border-primary); font-size: 10px; }
  .bm-readtime { font-family: var(--font-mono); font-size: 9px; letter-spacing: .06em; color: var(--text-tertiary); }
  .bm-status-badge { margin-left: auto; font-family: var(--font-mono); font-size: 9px; font-weight: 600; letter-spacing: .1em; text-transform: uppercase; padding: 2px 7px; border-radius: 3px; border: 1px solid; flex-shrink: 0; }

  .bm-title { font-family: var(--font-ui); font-size: 1rem; font-weight: 600; line-height: 1.35; color: var(--text-primary); }
  .bm-excerpt { font-family: var(--font-ui); font-size: 12px; color: var(--text-tertiary); line-height: 1.65; overflow: hidden; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; }

  .bm-author-row { display: flex; align-items: center; gap: 7px; flex-wrap: wrap; }
  .bm-author-name { font-family: var(--font-ui); font-size: 11px; color: var(--text-secondary); }
  .bm-date { font-family: var(--font-mono); font-size: 9px; letter-spacing: .06em; color: var(--text-tertiary); }
  .bm-reason { font-family: var(--font-ui); font-size: 11px; color: var(--text-tertiary); font-style: italic; }

  /* History */
  .bm-history-toggle { margin-top: 4px; background: transparent; border: none; padding: 0; cursor: pointer; color: var(--text-accent); font-family: var(--font-mono); font-size: 9px; letter-spacing: .1em; text-transform: uppercase; }
  .bm-history-wrap { margin-top: 8px; border-top: 1px solid var(--border-primary); padding-top: 8px; display: flex; flex-direction: column; gap: 6px; }
  .bm-history-item { background: var(--surface-secondary); border: 1.5px solid var(--border-primary); border-left: 3px solid var(--border-weak); border-radius: 4px; padding: 8px 10px; }
  .bm-history-line { font-family: var(--font-ui); font-size: 11px; color: var(--text-tertiary); line-height: 1.5; }
  .bm-history-line strong { color: var(--text-primary); font-weight: 500; }

  /* Card actions */
  .bm-card-actions { margin-left: auto; display: flex; flex-wrap: wrap; gap: 6px; justify-content: flex-end; align-self: flex-start; flex-shrink: 0; }
  .bm-btn { font-family: var(--font-mono); font-size: 9px; font-weight: 600; letter-spacing: .12em; text-transform: uppercase; padding: 6px 10px; border-radius: 4px; background: transparent; cursor: pointer; border: 1.5px solid; transition: opacity 150ms; }
  .bm-btn:hover { opacity: .8; }
  .bm-btn:disabled { opacity: .4; cursor: default; }

  /* Empty / loading */
  .bm-empty { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 10px; min-height: 240px; border: 1.5px dashed var(--border-primary); border-radius: 6px; color: var(--text-tertiary); }

  /* Pagination */
  .bm-pagination { display: flex; align-items: center; justify-content: center; gap: 5px; margin-top: 28px; }
  .bm-page-btn { width: 32px; height: 32px; border-radius: 4px; font-family: var(--font-mono); font-size: 11px; cursor: pointer; transition: all .15s; border: 1.5px solid var(--border-primary); background: transparent; color: var(--text-tertiary); }
  .bm-page-btn.active { border-color: var(--border-brand); background: var(--interactive-brand-primary); color: var(--text-on-brand); font-weight: 700; }
  .bm-page-btn:disabled { opacity: .4; cursor: default; }

  /* Right sidebar */
  .bm-sidebar { position: sticky; top: 0; height: 100vh; background: var(--surface-primary); border-left: 1.5px solid var(--border-primary); border-top: 3px solid var(--border-brand); display: flex; flex-direction: column; overflow-y: auto; }
  .bm-sb-section { padding: 16px 14px 16px 16px; }
  .bm-sb-section + .bm-sb-section { border-top: 1px solid var(--border-primary); }

  /* Stat display */
  .bm-stats-row { display: flex; justify-content: space-between; align-items: baseline; margin-top: 12px; }
  .bm-stats-label { font-family: var(--font-mono); font-size: 9px; letter-spacing: .1em; text-transform: uppercase; color: var(--text-tertiary); }
  .bm-stats-count { font-family: var(--font-ui); font-size: 2rem; font-weight: 800; color: var(--text-accent); line-height: 1; }
  .bm-metric-row { display: flex; justify-content: space-between; margin-top: 7px; font-family: var(--font-mono); font-size: 9px; letter-spacing: .06em; color: var(--text-secondary); }

  /* Search input in sidebar */
  .bm-search-wrap { position: relative; margin-top: 10px; }
  .bm-search-icon { position: absolute; left: 10px; top: 50%; transform: translateY(-50%); color: var(--text-tertiary); pointer-events: none; }
  .bm-search-input { width: 100%; padding: 8px 12px 8px 32px; background: var(--surface-secondary); border: 1.5px solid var(--border-primary); border-left: 3px solid var(--border-weak); border-radius: 4px; font-family: var(--font-ui); font-size: 12px; color: var(--text-primary); outline: none; transition: border-left-color 150ms; box-sizing: border-box; }
  .bm-search-input:focus { border-left-color: var(--border-brand); }
  .bm-search-input::placeholder { color: var(--text-tertiary); }

  /* Filter select in sidebar */
  .bm-filter-select { width: 100%; margin-top: 10px; padding: 8px 30px 8px 10px; background: var(--surface-secondary); border: 1.5px solid var(--border-primary); border-left: 3px solid var(--border-weak); border-radius: 4px; font-family: var(--font-ui); font-size: 12px; color: var(--text-primary); outline: none; cursor: pointer; appearance: none; background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='11' height='11' viewBox='0 0 24 24' fill='none' stroke='%237a7670' stroke-width='2'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E"); background-repeat: no-repeat; background-position: right 10px center; transition: border-left-color 150ms; }
  .bm-filter-select:focus { border-left-color: var(--border-brand); }

  @media (max-width: 980px) {
    .bm-grid { display: block; }
    .bm-sidebar { position: static; height: auto; border-left: none; border-top: 1.5px solid var(--border-primary); }
    .bm-main { padding: 0 14px 24px; }
    .bm-card { flex-direction: column; }
    .bm-card-actions { margin-left: 0; justify-content: flex-start; width: 100%; }
  }
`;

/* ─── Helpers ─── */
const SectionLabel = ({ children }) => (
  <div className="eyebrow">
    <div className="eyebrow-bar" />
    <span className="eyebrow-text">{children}</span>
  </div>
);

const toTitleCase = (v = '') => v.charAt(0).toUpperCase() + v.slice(1);
const formatDate = (v) => {
  if (!v) return '';
  return new Date(v).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
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

/* ─────────────────────────────────────────
   Component
───────────────────────────────────────── */
const BlogManagementPage = () => {
  const toast = useToast();
  const [pageError, setPageError] = useState('');
  const [moderationError, setModerationError] = useState('');
  const [blogs, setBlogs] = useState([]);
  const [stats, setStats] = useState({ all: 0, draft: 0, review: 0, published: 0, archived: 0 });
  const [pagination, setPagination] = useState({ page: 1, limit: 10, totalPages: 1, total: 0 });
  const [filters, setFilters] = useState({ status: 'review', search: '' });
  const [searchInput, setSearchInput] = useState('');
  const [loading, setLoading] = useState(true);
  const [actionLoadingById, setActionLoadingById] = useState({});
  const [expandedHistoryById, setExpandedHistoryById] = useState({});
  const [moderationModal, setModerationModal] = useState({
    isOpen: false, blogId: null, status: '', actionLabel: '',
    successMessage: '', selectedPreset: '', customReason: '', useCustomReason: false,
  });

  const loadBlogs = useCallback(async (next = {}) => {
    setLoading(true);
    setPageError('');
    try {
      const effective = {
        page:   next.page   ?? pagination.page   ?? 1,
        limit:  pagination.limit || 10,
        status: next.status ?? filters.status,
        search: next.search ?? filters.search,
      };
      const response = await blogApi.getAdminBlogs(effective);
      setBlogs(response.blogs || []);
      setStats(response.stats || { all: 0, draft: 0, review: 0, published: 0, archived: 0 });
      setPagination(response.pagination || { page: 1, limit: 10, totalPages: 1, total: 0 });
      setFilters((prev) => ({ ...prev, status: effective.status, search: effective.search }));
    } catch (err) {
      setPageError(err?.message || 'Failed to load blogs');
    } finally {
      setLoading(false);
    }
  }, [filters.search, filters.status, pagination.limit, pagination.page]);

  useEffect(() => {
    loadBlogs({ page: 1, status: filters.status, search: filters.search });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const doModerationAction = async (blogId, status, successMessage, reasonPayload = {}) => {
    setActionLoadingById((prev) => ({ ...prev, [blogId]: true }));
    setPageError('');
    try {
      if (status === 'published') await blogApi.approveAndPublishBlog(blogId, reasonPayload);
      else await blogApi.moderateBlog(blogId, status, reasonPayload);
      toast.success(successMessage);
      await loadBlogs();
    } catch (err) {
      setPageError(err?.message || 'Failed moderation action');
    } finally {
      setActionLoadingById((prev) => ({ ...prev, [blogId]: false }));
    }
  };

  const openModerationModal = (blogId, status, actionLabel, successMessage) => {
    const presets = MODERATION_PRESETS[status] || [];
    setModerationModal({ isOpen: true, blogId, status, actionLabel, successMessage, selectedPreset: presets[0] || '', customReason: '', useCustomReason: false });
    setModerationError('');
  };

  const closeModerationModal = () => {
    setModerationModal((prev) => ({ ...prev, isOpen: false }));
    setModerationError('');
  };

  const confirmModerationAction = async () => {
    if (!moderationModal.blogId || !moderationModal.status) return;
    const customReason    = moderationModal.customReason.trim();
    const selectedPreset  = moderationModal.selectedPreset.trim();
    const useCustom       = moderationModal.useCustomReason;
    if (useCustom && !customReason)    { setModerationError('Please provide a custom moderation reason.'); return; }
    if (!useCustom && !selectedPreset) { setModerationError('Please select a preset moderation reason.'); return; }
    setModerationError('');
    const reasonPayload = useCustom
      ? { moderationReason: customReason,     moderationReasonType: 'custom', moderationReasonPreset: '' }
      : { moderationReason: selectedPreset,   moderationReasonType: 'preset', moderationReasonPreset: selectedPreset };
    await doModerationAction(moderationModal.blogId, moderationModal.status, moderationModal.successMessage, reasonPayload);
    closeModerationModal();
  };

  const selectedStatusLabel = STATUS_OPTIONS.find((o) => o.value === filters.status)?.label || 'All';
  const pageItems = buildPageItems(pagination.page || 1, pagination.totalPages || 1);

  const toggleHistory = (id) => setExpandedHistoryById((prev) => ({ ...prev, [id]: !prev[id] }));

  return (
    <>
      <style>{BLOG_ADMIN_STYLES}</style>
      <div className="bm-grid">

        {/* ── Main content ── */}
        <main className="bm-main">
          <div className="bm-main-inner">

            {/* Sticky topbar */}
            <div className="bm-topbar">
              <SectionLabel>Moderation Queue</SectionLabel>
              <span className="bm-section-count">{pagination.total || 0} entries</span>
            </div>

            {/* Page-level error */}
            {pageError && (
              <div style={{
                marginBottom: 14, padding: '10px 14px',
                background: 'var(--color-intent-danger-weak)',
                border: '1.5px solid var(--border-danger)',
                borderLeft: '3px solid var(--border-danger)',
                borderRadius: 6,
                fontFamily: 'var(--font-ui)', fontSize: 12, color: 'var(--icon-danger)',
              }}>
                {pageError}
              </div>
            )}

            {/* Loading */}
            {loading && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {[1, 2, 3].map((i) => (
                  <div key={i} style={{ height: 110, borderRadius: 6, background: 'var(--surface-secondary)', border: '1.5px solid var(--border-primary)', animation: 'pulse 1.5s infinite' }} />
                ))}
              </div>
            )}

            {/* Empty */}
            {!loading && blogs.length === 0 && (
              <div className="bm-empty">
                <SectionLabel>No Results</SectionLabel>
                <span style={{ fontFamily: 'var(--font-ui)', fontSize: 13, color: 'var(--text-tertiary)' }}>
                  No blog posts found for the current filters.
                </span>
              </div>
            )}

            {/* Blog cards */}
            {!loading && blogs.length > 0 && (
              <>
                <div className="bm-cards">
                  {blogs.map((blog) => {
                    const isActionLoading   = Boolean(actionLoadingById[blog._id]);
                    const isHistoryExpanded = Boolean(expandedHistoryById[blog._id]);
                    const history = Array.isArray(blog.moderationHistory) ? [...blog.moderationHistory].reverse() : [];

                    return (
                      <article key={blog._id} className="bm-card">
                        {/* Thumbnail */}
                        {blog.featuredImage && (
                          <div className="bm-thumb">
                            <img src={blog.featuredImage?.url || blog.featuredImage} alt={blog.featuredImage?.alt || blog.title} />
                          </div>
                        )}

                        {/* Body */}
                        <div className="bm-card-body">
                          <div className="bm-meta">
                            <span className="bm-category">{(blog.category || 'general').replace(/_/g, ' ')}</span>
                            <span className="bm-dot">·</span>
                            <span className="bm-readtime">{getReadingTime(blog)}</span>
                            <span className="bm-status-badge" style={getStatusStyle(blog.status)}>
                              {toTitleCase(blog.status || 'draft')}
                            </span>
                          </div>

                          <div className="bm-title">{blog.title}</div>
                          <p className="bm-excerpt">{blog.excerpt}</p>

                          <div className="bm-author-row">
                            <span className="bm-author-name">By {blog.author?.displayName || 'Unknown'}</span>
                            <span className="bm-dot">·</span>
                            <span className="bm-date">{formatDate(blog.createdAt || blog.updatedAt)}</span>
                            {blog.moderation?.reason && (
                              <>
                                <span className="bm-dot">·</span>
                                <span className="bm-reason">"{blog.moderation.reason}"</span>
                              </>
                            )}
                          </div>

                          {/* Moderation history toggle */}
                          <button type="button" className="bm-history-toggle" onClick={() => toggleHistory(blog._id)}>
                            {isHistoryExpanded ? '▴ Hide history' : `▾ History (${history.length})`}
                          </button>

                          {isHistoryExpanded && (
                            <div className="bm-history-wrap">
                              {history.length === 0 ? (
                                <p className="bm-history-line">No moderation history yet.</p>
                              ) : history.map((entry, idx) => (
                                <div key={`${blog._id}-h-${idx}`} className="bm-history-item">
                                  <p className="bm-history-line">
                                    <strong>{entry.previousStatus || 'n/a'}</strong> → <strong>{entry.nextStatus || 'n/a'}</strong>
                                  </p>
                                  <p className="bm-history-line">Reason: <strong>{entry.reason || 'No reason provided'}</strong></p>
                                  <p className="bm-history-line">
                                    By {entry.actedBy?.displayName || entry.actedBy?.email || 'Unknown'} · {entry.actedAt ? new Date(entry.actedAt).toLocaleString() : 'Unknown time'}
                                  </p>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>

                        {/* Action buttons */}
                        <div className="bm-card-actions">
                          {blog.status === 'review' && (
                            <>
                              <button
                                type="button" disabled={isActionLoading} className="bm-btn"
                                style={ACTION_BTN.approve}
                                onClick={() => openModerationModal(blog._id, 'published', 'Approve & Publish', 'Blog approved and published')}
                              >
                                Approve
                              </button>
                              <button
                                type="button" disabled={isActionLoading} className="bm-btn"
                                style={ACTION_BTN.reject}
                                onClick={() => openModerationModal(blog._id, 'draft', 'Reject to Draft', 'Blog moved back to draft')}
                              >
                                Reject
                              </button>
                            </>
                          )}
                          {blog.status === 'published' && (
                            <button
                              type="button" disabled={isActionLoading} className="bm-btn"
                              style={ACTION_BTN.archive}
                              onClick={() => openModerationModal(blog._id, 'archived', 'Archive', 'Blog archived')}
                            >
                              Archive
                            </button>
                          )}
                          {blog.status === 'draft' && (
                            <button
                              type="button" disabled={isActionLoading} className="bm-btn"
                              style={ACTION_BTN.review}
                              onClick={() => openModerationModal(blog._id, 'review', 'Send to Review', 'Blog moved to review')}
                            >
                              Send to Review
                            </button>
                          )}
                          {blog.status === 'archived' && (
                            <button
                              type="button" disabled={isActionLoading} className="bm-btn"
                              style={ACTION_BTN.restore}
                              onClick={() => openModerationModal(blog._id, 'draft', 'Restore to Draft', 'Archived blog restored to draft')}
                            >
                              Restore
                            </button>
                          )}
                        </div>
                      </article>
                    );
                  })}
                </div>

                {/* Pagination */}
                {(pagination.totalPages || 1) > 1 && (
                  <div className="bm-pagination">
                    {pageItems.map((item, index) => (
                      <button
                        key={`${item}-${index}`}
                        type="button"
                        disabled={String(item).includes('ellipsis')}
                        onClick={() => typeof item === 'number' && loadBlogs({ page: item })}
                        className={`bm-page-btn${item === pagination.page ? ' active' : ''}`}
                      >
                        {String(item).includes('ellipsis') ? '…' : item}
                      </button>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        </main>

        {/* ── Right sidebar ── */}
        <aside className="bm-sidebar">

          {/* Queue summary */}
          <div className="bm-sb-section">
            <SectionLabel>Queue</SectionLabel>
            <div className="bm-stats-row">
              <span className="bm-stats-label">Pending review</span>
              <span className="bm-stats-count">{stats.review || 0}</span>
            </div>
            <div style={{ marginTop: 12 }}>
              <button
                type="button"
                onClick={() => loadBlogs({ page: 1 })}
                style={{
                  width: '100%', padding: '9px 14px', borderRadius: 4, cursor: 'pointer',
                  fontFamily: 'var(--font-mono)', fontSize: 9, fontWeight: 600, letterSpacing: '.14em', textTransform: 'uppercase',
                  border: '1.5px solid var(--border-brand)',
                  background: 'var(--interactive-brand-primary)',
                  color: 'var(--text-on-brand)',
                  transition: 'opacity 150ms',
                }}
                onMouseEnter={(e) => e.currentTarget.style.opacity = '.85'}
                onMouseLeave={(e) => e.currentTarget.style.opacity = '1'}
              >
                Refresh Queue
              </button>
            </div>
          </div>

          {/* Search */}
          <div className="bm-sb-section">
            <SectionLabel>Search</SectionLabel>
            <div className="bm-search-wrap">
              <svg className="bm-search-icon" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="11" cy="11" r="8" />
                <path strokeLinecap="round" d="m21 21-4.35-4.35" />
              </svg>
              <input
                type="text"
                className="bm-search-input"
                placeholder="Search title or excerpt…"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && loadBlogs({ page: 1, search: searchInput })}
              />
            </div>
            <div style={{ marginTop: 8 }}>
              <button
                type="button"
                onClick={() => loadBlogs({ page: 1, search: searchInput })}
                style={{
                  width: '100%', padding: '8px 12px', borderRadius: 4, cursor: 'pointer',
                  fontFamily: 'var(--font-mono)', fontSize: 9, fontWeight: 600, letterSpacing: '.14em', textTransform: 'uppercase',
                  border: '1.5px solid var(--border-primary)', background: 'transparent', color: 'var(--text-secondary)',
                  transition: 'border-color 150ms',
                }}
              >
                Apply Search
              </button>
            </div>
          </div>

          {/* Filter */}
          <div className="bm-sb-section">
            <SectionLabel>Filter by Status</SectionLabel>
            <select
              aria-label="Status filter"
              className="bm-filter-select"
              value={filters.status}
              onChange={(e) => loadBlogs({ page: 1, status: e.target.value })}
            >
              {STATUS_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label} ({stats[opt.value] ?? stats.all})
                </option>
              ))}
            </select>
          </div>

          {/* Stats breakdown */}
          <div className="bm-sb-section">
            <SectionLabel>Stats</SectionLabel>
            <div className="bm-stats-row">
              <span className="bm-stats-label">{selectedStatusLabel}</span>
              <span className="bm-stats-count">{stats[filters.status] ?? stats.all}</span>
            </div>
            <div style={{ marginTop: 10, borderTop: '1px solid var(--border-primary)', paddingTop: 10, display: 'flex', flexDirection: 'column', gap: 5 }}>
              {[
                { label: 'Published', key: 'published', color: 'var(--text-success)' },
                { label: 'Under Review', key: 'review',  color: 'var(--text-warning)' },
                { label: 'Draft',     key: 'draft',     color: 'var(--text-secondary)' },
                { label: 'Archived',  key: 'archived',  color: 'var(--icon-danger)' },
              ].map(({ label, key, color }) => (
                <div key={key} className="bm-metric-row">
                  <span style={{ color }}>{label}</span>
                  <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{stats[key] || 0}</span>
                </div>
              ))}
            </div>
          </div>
        </aside>
      </div>

      {/* ── Moderation modal ── */}
      <ConfirmationModal
        isOpen={moderationModal.isOpen}
        onClose={closeModerationModal}
        onConfirm={confirmModerationAction}
        title={moderationModal.actionLabel || 'Moderate Blog'}
        message="Select a preset reason or write a custom reason for this moderation action."
        confirmText="Apply"
        type="warning"
        loading={Boolean(actionLoadingById[moderationModal.blogId])}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {/* Preset option */}
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontFamily: 'var(--font-ui)', fontSize: 13, color: 'var(--text-primary)', cursor: 'pointer' }}>
            <input
              type="radio"
              checked={!moderationModal.useCustomReason}
              onChange={() => { setModerationModal((p) => ({ ...p, useCustomReason: false })); setModerationError(''); }}
            />
            Use a preset reason
          </label>
          {!moderationModal.useCustomReason && (
            <select
              value={moderationModal.selectedPreset}
              onChange={(e) => { setModerationModal((p) => ({ ...p, selectedPreset: e.target.value })); setModerationError(''); }}
              className="bm-filter-select"
              style={{ marginTop: 0 }}
            >
              {(MODERATION_PRESETS[moderationModal.status] || []).map((preset) => (
                <option key={preset} value={preset}>{preset}</option>
              ))}
            </select>
          )}

          {/* Custom option */}
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontFamily: 'var(--font-ui)', fontSize: 13, color: 'var(--text-primary)', cursor: 'pointer' }}>
            <input
              type="radio"
              checked={moderationModal.useCustomReason}
              onChange={() => { setModerationModal((p) => ({ ...p, useCustomReason: true })); setModerationError(''); }}
            />
            Write a custom reason
          </label>
          {moderationModal.useCustomReason && (
            <textarea
              value={moderationModal.customReason}
              onChange={(e) => { setModerationModal((p) => ({ ...p, customReason: e.target.value })); setModerationError(''); }}
              placeholder="Enter moderation reason…"
              maxLength={300}
              style={{
                width: '100%', minHeight: 80, resize: 'vertical', boxSizing: 'border-box',
                background: 'var(--surface-secondary)', border: '1.5px solid var(--border-primary)',
                borderLeft: '3px solid var(--border-weak)', borderRadius: 4,
                padding: '8px 10px', fontFamily: 'var(--font-ui)', fontSize: 12,
                color: 'var(--text-primary)', outline: 'none',
              }}
              onFocus={(e) => { e.currentTarget.style.borderLeftColor = 'var(--border-brand)'; }}
              onBlur={(e)  => { e.currentTarget.style.borderLeftColor = 'var(--border-weak)'; }}
            />
          )}

          {/* Error */}
          {moderationError && (
            <p style={{ fontFamily: 'var(--font-mono)', fontSize: 9, letterSpacing: '.06em', color: 'var(--icon-danger)', margin: 0 }}>
              {moderationError}
            </p>
          )}
        </div>
      </ConfirmationModal>
    </>
  );
};

export default BlogManagementPage;