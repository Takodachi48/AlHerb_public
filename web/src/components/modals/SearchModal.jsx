import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../../hooks/useAuth';
import { herbService } from '../../services/herbService';
import { blogApi as blogService } from '../../services/blogService';
import Loading from '../common/Loading';
import SearchBar from '../common/SearchBar';

/* ── Icons ── */
const SearchIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <circle cx="11" cy="11" r="8"/>
    <line x1="21" y1="21" x2="16.65" y2="16.65"/>
  </svg>
);
const ArrowIcon = () => (
  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <polyline points="9 18 15 12 9 6"/>
  </svg>
);
const PageIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"
    style={{ color: 'var(--text-tertiary)' }}>
    <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/>
    <polyline points="14 2 14 8 20 8"/>
    <line x1="8" y1="13" x2="16" y2="13"/>
    <line x1="8" y1="17" x2="12" y2="17"/>
  </svg>
);
const HerbIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth="1.6" strokeLinecap="round" aria-hidden="true"
    style={{ color: 'var(--text-brand)' }}>
    <path d="M17,8C8,10 5.9,16.17 3.82,21.34L5.71,22L6.66,19.7C7.14,19.87 7.64,20 8,20C19,20 22,3 22,3C21,5 14,5.25 9,6.25C4,7.25 2,11.5 2,13.5C2,15.5 3.75,17.25 3.75,17.25C7,8 17,8 17,8Z"/>
  </svg>
);
const BlogIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"
    style={{ color: 'var(--text-accent)' }}>
    <path d="M12 20h9"/>
    <path d="M16.5 3.5a2.121 2.121 0 013 3L7 19l-4 1 1-4L16.5 3.5z"/>
  </svg>
);

const TYPE_ICONS  = { page: <PageIcon />, herb: <HerbIcon />, blog: <BlogIcon /> };
const TYPE_LABELS = { page: 'Pages', herb: 'Herbs', blog: 'Blog' };

const normalizeText = (value = '') => String(value).toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
const collapseText = (value = '') => normalizeText(value).replace(/\s+/g, '');
const tokenize = (value = '') => normalizeText(value).split(/\s+/).filter(Boolean);

const buildPageSearchBlob = (page) => [
  page.name,
  page.path,
  page.description,
  ...(Array.isArray(page.aliases) ? page.aliases : []),
  ...(Array.isArray(page.keywords) ? page.keywords : []),
].filter(Boolean).join(' ');

const pageMatchesQuery = (page, query) => {
  const normalizedQuery = normalizeText(query);
  const compactQuery = collapseText(query);
  if (!normalizedQuery) return false;

  const tokens = tokenize(query);
  const blob = buildPageSearchBlob(page);
  const normalizedBlob = normalizeText(blob);
  const compactBlob = collapseText(blob);
  const blobTokens = tokenize(blob);

  const tokenMatch = tokens.every((token) => (
    blobTokens.some((candidate) => candidate.startsWith(token) || candidate.includes(token))
  ));
  return normalizedBlob.includes(normalizedQuery) || compactBlob.includes(compactQuery) || tokenMatch;
};

const scorePageMatch = (page, query) => {
  const name = normalizeText(page.name);
  const path = normalizeText(page.path);
  const q = normalizeText(query);
  const compactName = collapseText(page.name);
  const compactQ = collapseText(query);
  if (compactName === compactQ) return 0;
  if (name.startsWith(q)) return 1;
  if (path.includes(q)) return 2;
  return 3;
};

/* ── Group divider ── */
const GroupDivider = ({ label }) => (
  <div className="search-group-divider">
    <div className="search-group-divider-line" />
    <span className="search-group-divider-label">{label}</span>
    <div className="search-group-divider-line" />
  </div>
);

/* ── Single result row ── */
const ResultRow = ({ result, index, onClick }) => (
  <motion.button
    type="button"
    initial={{ opacity: 0, x: -5 }}
    animate={{ opacity: 1, x: 0 }}
    transition={{ delay: index * 0.025, duration: 0.16, ease: 'easeOut' }}
    onClick={onClick}
    className="search-result-row"
  >
    {/* Icon badge */}
    <span className="search-result-icon">
      {TYPE_ICONS[result.type] ?? <PageIcon />}
    </span>

    {/* Text */}
    <span className="search-result-text">
      <span className="search-result-name">
        {result.name}
        {result.scientificName && (
          <span className="search-result-scientific">{result.scientificName}</span>
        )}
      </span>
      {(result.description || result.excerpt) && (
        <span className="search-result-desc">
          {result.description || result.excerpt}
        </span>
      )}
    </span>

    {/* Path breadcrumb */}
    <span className="search-result-path">
      {result.path.replace(/^\//, '').split('/')[0] || 'home'}
    </span>

    {/* Arrow */}
    <span className="search-result-arrow">
      <ArrowIcon />
    </span>
  </motion.button>
);

/* ── Grouped result list ── */
const GroupedResults = ({ results, onNavigate }) => {
  const groups = useMemo(() => {
    const map = {};
    results.forEach(r => { (map[r.type] ??= []).push(r); });
    return Object.entries(map);
  }, [results]);

  let globalIdx = 0;

  return (
    <>
      {groups.map(([type, items]) => (
        <div key={type}>
          <GroupDivider label={TYPE_LABELS[type] || type} />
          {items.map((result) => {
            const idx = globalIdx++;
            return (
              <ResultRow
                key={`${result.type}-${result.path}-${idx}`}
                result={result}
                index={idx}
                onClick={() => onNavigate(result.path)}
              />
            );
          })}
        </div>
      ))}
    </>
  );
};

/* ══════════════════════════════════════════════════════════════
   SEARCH MODAL
══════════════════════════════════════════════════════════════ */
const SearchModal = ({ isOpen, onClose }) => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const inputRef = useRef(null);

  const [searchQuery, setSearchQuery] = useState('');
  const [results,     setResults]     = useState([]);
  const [loading,     setLoading]     = useState(false);

  const isAdmin = user?.role === 'admin';

  const pages = useMemo(() => {
    const base = [
      {
        name: 'Home',
        path: '/home',
        type: 'page',
        aliases: ['homepage', 'home page', 'dashboard home'],
        keywords: ['welcome', 'overview'],
      },
      {
        name: 'Herbs',
        path: '/herbs',
        type: 'page',
        aliases: ['herbspage', 'herbs page', 'herb list'],
        keywords: ['plants', 'materia medica', 'catalog'],
      },
      {
        name: 'Recommendations',
        path: '/recommendation',
        type: 'page',
        aliases: ['recommendation page', 'herb recommendations'],
        keywords: ['advice', 'suggestions'],
      },
      {
        name: 'Safety Checker',
        path: '/safety',
        type: 'page',
        aliases: ['herb safety', 'safety page'],
        keywords: ['interactions', 'contraindications'],
      },
      {
        name: 'Compare Herbs',
        path: '/compare',
        type: 'page',
        aliases: ['comparison', 'herb compare'],
        keywords: ['side by side'],
      },
      {
        name: 'Map',
        path: '/map',
        type: 'page',
        aliases: ['herb map', 'location map'],
        keywords: ['nearby', 'locations'],
      },
      {
        name: 'Plant ID',
        path: '/image-processing',
        type: 'page',
        aliases: ['image processing', 'image classifier', 'scan plant'],
        keywords: ['identify', 'camera'],
      },
      {
        name: 'Blog',
        path: '/blog',
        type: 'page',
        aliases: ['blog page', 'articles'],
        keywords: ['posts', 'news', 'research'],
      },
      {
        name: 'My Blogs',
        path: '/blog/my-blogs',
        type: 'page',
        aliases: ['my posts', 'user blogs'],
        keywords: ['drafts', 'authored posts'],
      },
      {
        name: 'Settings',
        path: '/settings',
        type: 'page',
        aliases: ['account settings', 'profile settings'],
        keywords: ['preferences', 'account'],
      },
    ];
    if (isAdmin) base.push(
      {
        name: 'Dashboard',
        path: '/admin/dashboard',
        type: 'page',
        aliases: ['admin dashboard'],
        keywords: ['overview', 'admin home'],
      },
      {
        name: 'Analytics',
        path: '/admin/analytics',
        type: 'page',
        aliases: ['analytics page', 'monitoring'],
        keywords: ['metrics', 'reporting'],
      },
      {
        name: 'Herb Management',
        path: '/admin/herbs',
        type: 'page',
        aliases: ['herb admin', 'manage herbs'],
        keywords: ['herb management', 'herb editor'],
      },
      {
        name: 'Phytochemicals',
        path: '/admin/phytochemicals',
        type: 'page',
        aliases: ['phytochemical management'],
        keywords: ['compounds', 'chemical profile'],
      },
      {
        name: 'Herb Locations',
        path: '/admin/herb-locations',
        type: 'page',
        aliases: ['locations', 'herb location management'],
        keywords: ['map points', 'geo locations'],
      },
      {
        name: 'Users',
        path: '/admin/users',
        type: 'page',
        aliases: ['user management'],
        keywords: ['accounts', 'roles'],
      },
      {
        name: 'Blog Management',
        path: '/admin/blog',
        type: 'page',
        aliases: ['admin blog', 'moderation'],
        keywords: ['posts', 'review'],
      },
      {
        name: 'Assets',
        path: '/admin/assets',
        type: 'page',
        aliases: ['landing assets'],
        keywords: ['media', 'design assets'],
      },
      {
        name: 'ML Management',
        path: '/admin/ml-model',
        type: 'page',
        aliases: ['dataset', 'ml model'],
        keywords: ['training', 'models'],
      },
    );
    return base;
  }, [isAdmin]);

  const performSearch = async (query) => {
    const q = query.trim().toLowerCase();
    if (!q) { setResults([]); return; }
    setLoading(true);
    try {
      const filteredPages = pages
        .filter((page) => pageMatchesQuery(page, q))
        .sort((a, b) => scorePageMatch(a, q) - scorePageMatch(b, q));
      let herbs = [], blogs = [];

      if (q.length > 1) {
        try {
          const r = await herbService.searchHerbs(q);
          herbs = r.data?.map(h => ({
            name: h.name, scientificName: h.scientificName,
            description: h.family || h.category || '',
            path: `/herbs/${h.slug}`, type: 'herb',
          })) || [];
        } catch {}

        try {
          const r = await blogService.searchBlogs(q);
          blogs = r.data?.map(b => ({
            name: b.title,
            excerpt: b.excerpt || b.summary || '',
            path: `/blog/${b.slug}`,
            type: 'blog',
          })) || [];
        } catch {}
      }

      const deduped = [];
      const seen = new Set();
      [...filteredPages, ...herbs, ...blogs].forEach((item) => {
        const key = `${item.type}:${item.path}`;
        if (seen.has(key)) return;
        seen.add(key);
        deduped.push(item);
      });
      setResults(deduped);
    } catch {
      setResults([]);
    } finally {
      setLoading(false);
    }
  };

  /* Reset on close */
  useEffect(() => {
    if (!isOpen) { setSearchQuery(''); setResults([]); }
    else setTimeout(() => inputRef.current?.focus(), 80);
  }, [isOpen]);

  /* Escape key */
  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') onClose(); };
    if (isOpen) document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [isOpen, onClose]);

  /* Debounced search */
  useEffect(() => {
    const id = setTimeout(() => {
      if (searchQuery.trim()) { setResults([]); performSearch(searchQuery); }
      else setResults([]);
    }, 300);
    return () => clearTimeout(id);
  }, [searchQuery, pages]);

  const handleNavigate = (path) => { navigate(path); onClose(); };

  const showResults = results.length > 0;
  const showLoading = loading && results.length === 0;
  const showEmpty   = !loading && searchQuery.trim() && results.length === 0;

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          key="search-backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={  { opacity: 0 }}
          transition={{ duration: 0.18 }}
          className="search-backdrop"
          onClick={onClose}
        >
          <motion.div
            key="search-panel"
            initial={{ opacity: 0, y: -12, scale: 0.98 }}
            animate={{ opacity: 1, y: 0,   scale: 1    }}
            exit={  { opacity: 0, y: -8,   scale: 0.98 }}
            transition={{ duration: 0.22, ease: [0.23, 1, 0.32, 1] }}
            className="search-modal-wrap"
            onClick={(e) => e.stopPropagation()}
          >

            {/* ── Search input box ── */}
            <div className="search-modal-box">
              <div className="search-modal-strip">
                <div className="search-modal-strip-line" />
                <span className="search-modal-strip-label">Global Search</span>
                <div className="search-modal-strip-line" />
              </div>

              <div className="search-modal-input-row">
                <SearchBar
                  value={searchQuery}
                  onChange={(val) => setSearchQuery(val)}
                  placeholder="Search pages, herbs, blog posts…"
                  showIcon={true}
                  className="w-full"
                  inputRef={inputRef}
                  variant="full"
                />
              </div>

              <div className="search-modal-rule" />
            </div>

            {/* ── Results ── */}
            <AnimatePresence mode="wait">

              {showLoading && (
                <motion.div
                  key="loading"
                  initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                  transition={{ duration: 0.14 }}
                  className="search-results-panel scrollbar-thin"
                >
                  <div className="search-state">
                    <Loading size="large" text="Searching…" />
                  </div>
                </motion.div>
              )}

              {showEmpty && (
                <motion.div
                  key="empty"
                  initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                  transition={{ duration: 0.14 }}
                  className="search-results-panel scrollbar-thin"
                >
                  <div className="search-state">
                    <p className="search-state-title">No results for "{searchQuery}"</p>
                    <p className="search-state-sub">Try a different term or browse the navigation</p>
                  </div>
                </motion.div>
              )}

              {showResults && (
                <motion.div
                  key="results"
                  initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                  transition={{ duration: 0.16 }}
                  className="search-results-panel scrollbar-thin"
                >
                  <div className="search-results-inner">
                    <GroupedResults results={results} onNavigate={handleNavigate} />
                  </div>

                  {/* Count footer */}
                  <div className="search-count-bar">
                    <div className="search-count-bar-line" />
                    <span className="search-count-label">
                      {results.length} result{results.length !== 1 ? 's' : ''}
                    </span>
                    <div className="search-count-bar-line" />
                  </div>
                </motion.div>
              )}

            </AnimatePresence>

          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default SearchModal;
