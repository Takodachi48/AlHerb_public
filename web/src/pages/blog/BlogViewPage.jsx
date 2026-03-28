import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, CheckCircle, XCircle, Star, Archive } from 'lucide-react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import Button from '../../components/common/Button';
import IconToggleButton from '../../components/common/IconToggleButton';
import KebabMenu from '../../components/common/KebabMenu';
import Input from '../../components/common/Input';
import ProfilePicture from '../../components/common/ProfilePicture';
import Tooltip from '../../components/common/Tooltip';
import blogApi from '../../services/blogService';
import { useAuth } from '../../hooks/useAuth';
import useBatchIntersectionObserver from '../../hooks/useBatchIntersectionObserver';

const VIEW_STYLES = `
  .bv-root { min-height: 100%; height: auto; overflow: visible; background: var(--base-tertiary, #101315); }
  .bv-mobile-controls { display: none; }
  .bv-edit-btn { padding: 8px 12px; border-radius: 5px; border: 1px solid var(--border-secondary, rgba(255,255,255,.1)); background: transparent; color: var(--text-secondary, #b8b4ac); font-family: 'DM Sans', sans-serif; font-size: 10px; letter-spacing: .12em; text-transform: uppercase; font-weight: 600; cursor: pointer; }
  .bv-hero { width: 100%; aspect-ratio: 16/5; overflow: hidden; background: var(--surface-secondary, #222); position: relative; border-bottom: 1px solid var(--border-weak, rgba(255,255,255,.06)); }
  .bv-hero img { width: 100%; height: 100%; object-fit: cover; display: block; }
  .bv-hero-gradient { width: 100%; height: 100%; background: linear-gradient(135deg, #1e2e1e 0%, #2a2a2a 50%, #1a1e1a 100%); }
  .bv-hero-caption { position: absolute; left: 12px; bottom: 10px; padding: 3px 9px; border-radius: 3px; background: rgba(0,0,0,.45); color: var(--text-secondary, #b8b4ac); font-family: 'DM Sans', sans-serif; font-size: 10px; }
  .bv-body { height: auto; }
  .bv-grid {
    max-width: 1220px;
    margin: 0 auto;
    padding: 28px 22px 64px;
    display: grid;
    grid-template-columns: minmax(0, 1fr) 300px;
    gap: 24px;
    align-items: start;
  }
  .bv-main { height: auto; overflow: visible; padding-right: 0; padding-bottom: 0; min-width: 0; }
  .bv-article-header { margin-bottom: 26px; }
  .bv-cat-row { display: flex; align-items: center; gap: 10px; margin-bottom: 14px; }
  .bv-cat { font-family: 'DM Sans', sans-serif; font-size: 10px; font-weight: 600; letter-spacing: .18em; text-transform: uppercase; color: var(--text-brand, #8fbf8f); }
  .bl-dot { color: var(--border-primary, rgba(255,255,255,.12)); font-size: 12px; }
  .bv-h1 { font-family: 'Fraunces', Georgia, serif; font-size: clamp(1.6rem, 4vw, 2.35rem); line-height: 1.2; color: var(--text-primary, #f0ede8); margin-bottom: 18px; }
  .bv-byline { display: flex; align-items: center; gap: 12px; padding-bottom: 18px; border-bottom: 1px solid var(--border-weak, rgba(255,255,255,.06)); }
  .bv-avatar { width: 36px; height: 36px; border-radius: 50%; background: var(--surface-secondary, #222); border: 1px solid var(--border-weak, rgba(255,255,255,.06)); flex-shrink: 0; overflow: hidden; display: grid; place-items: center; color: var(--text-secondary, #b8b4ac); font-family: 'DM Sans', sans-serif; font-size: 12px; font-weight: 700; }
  .bv-avatar img { width: 100%; height: 100%; object-fit: cover; display: block; }
  .bv-author { font-family: 'DM Sans', sans-serif; font-size: 13px; color: var(--text-primary, #f0ede8); }
  .bv-date-text { font-family: 'DM Sans', sans-serif; font-size: 11px; color: var(--text-weak, #504e4a); margin-top: 2px; }
  .bv-tags { margin-top: 14px; display: flex; flex-wrap: wrap; gap: 8px; }
  .bv-tag { padding: 3px 11px; border-radius: 100px; border: 1px solid var(--border-secondary, rgba(255,255,255,.1)); color: var(--text-secondary, #b8b4ac); font-family: 'DM Sans', sans-serif; font-size: 11px; }
  .bv-prose { font-family: 'Lora', Georgia, serif; font-size: 1rem; line-height: 1.85; color: var(--text-primary, #f0ede8); }
  .bv-prose p { margin: 0 0 1.2em; white-space: pre-wrap; }
  .bv-sidebar {
    position: sticky;
    top: 16px;
    width: 100%;
    max-height: calc(100dvh - 6rem);
    display: flex;
    flex-direction: column;
    gap: 12px;
    overflow-y: auto;
    align-self: start;
  }
  .bv-sb-card { padding: 16px; border-radius: 8px; background: var(--surface-primary, #1a1a1a); border: 1px solid var(--border-secondary, rgba(255,255,255,.1)); }
  .eyebrow { display: flex; align-items: center; gap: 10px; }
  .eyebrow-bar { width: 3px; height: 14px; border-radius: 999px; background: var(--border-brand, #7fa87f); flex-shrink: 0; }
  .eyebrow-text { font-family: 'DM Sans', sans-serif; font-size: 10px; font-weight: 600; letter-spacing: .22em; text-transform: uppercase; color: var(--text-brand, #8fbf8f); }
  .bv-sb-author-inner { margin-top: 14px; display: flex; flex-direction: column; align-items: center; text-align: center; gap: 10px; }
  .bv-sb-avatar { width: 56px; height: 56px; border-radius: 50%; background: var(--surface-secondary, #222); border: 2px solid var(--border-weak, rgba(255,255,255,.06)); overflow: hidden; display: grid; place-items: center; color: var(--text-secondary, #b8b4ac); font-family: 'DM Sans', sans-serif; font-size: 16px; font-weight: 700; }
  .bv-sb-avatar img { width: 100%; height: 100%; object-fit: cover; }
  .bv-sb-name { font-family: 'Fraunces', Georgia, serif; font-size: 1rem; color: var(--text-primary, #f0ede8); }
  .bv-sb-role { font-family: 'DM Sans', sans-serif; font-size: 10px; letter-spacing: .16em; text-transform: uppercase; color: var(--text-brand, #8fbf8f); }
  .bv-info-row { display: flex; justify-content: space-between; align-items: baseline; gap: 8px; }
  .bv-info-row + .bv-info-row { margin-top: 10px; }
  .bv-info-label { font-family: 'DM Sans', sans-serif; font-size: 11px; color: var(--text-tertiary, #7a7670); }
  .bv-info-val { font-family: 'DM Sans', sans-serif; font-size: 12px; color: var(--text-secondary, #b8b4ac); text-align: right; }
  .bv-brand-btn, .bv-ghost-btn { width: 100%; border-radius: 5px; padding: 10px 12px; font-family: 'DM Sans', sans-serif; font-size: 11px; letter-spacing: .12em; text-transform: uppercase; font-weight: 600; cursor: pointer; }
  .bv-brand-btn { border: 1px solid var(--border-brand, #7fa87f); background: var(--interactive-brand-primary, #7fa87f); color: var(--text-on-brand, #0d160d); }
  .bv-ghost-btn { border: 1px solid var(--border-secondary, rgba(255,255,255,.1)); background: transparent; color: var(--text-secondary, #b8b4ac); margin-top: 8px; }
  .bv-ghost-btn-danger { border: 1px solid rgba(200,70,70,.3); color: rgba(200,90,90,.9); }
  .bv-status-chip { margin-top: 8px; text-align: center; border-radius: 4px; border: 1px solid var(--border-secondary, rgba(255,255,255,.1)); padding: 6px 8px; font-family: 'DM Sans', sans-serif; font-size: 10px; color: var(--text-tertiary, #7a7670); letter-spacing: .1em; text-transform: uppercase; }
  .bv-comments-header { margin: 36px 0 14px; display: flex; justify-content: space-between; align-items: center; gap: 8px; }
  .bv-comments-count { font-family: 'DM Sans', sans-serif; font-size: 12px; color: var(--text-tertiary, #7a7670); }
  .bv-new-comment { padding: 16px; background: var(--surface-primary, #1a1a1a); border: 1px solid var(--border-secondary, rgba(255,255,255,.1)); border-radius: 8px; margin-bottom: 24px; }
  .bv-new-comment-inner { display: flex; gap: 12px; align-items: flex-start; }
  .bv-comment-textarea { width: 100%; padding: 9px 11px; background: var(--surface-secondary, #222); border: 1px solid var(--border-secondary, rgba(255,255,255,.1)); border-radius: 5px; color: var(--text-primary, #f0ede8); font-family: 'DM Sans', sans-serif; font-size: 13px; resize: vertical; outline: none; }
  .bv-post-btn { margin-top: 10px; padding: 8px 12px; border-radius: 4px; border: 1px solid var(--border-brand, #7fa87f); background: var(--interactive-brand-primary, #7fa87f); color: var(--text-on-brand, #0d160d); font-family: 'DM Sans', sans-serif; font-size: 10px; letter-spacing: .12em; text-transform: uppercase; font-weight: 600; cursor: pointer; }
  .bv-post-btn:disabled { opacity: .6; cursor: default; }
  .bv-comment-card { position: relative; overflow: visible; padding: 14px; border-radius: 8px; background: var(--surface-primary, #1a1a1a); border: 1px solid var(--border-secondary, rgba(255,255,255,.1)); }
  .bv-comment-card + .bv-comment-card { margin-top: 10px; }
  .bv-comment-card.depth1 { margin-left: 24px; border-left: 2px solid var(--border-brand, #7fa87f); }
  .bv-comment-card.io-reveal.io-visible { transform: none; }
  .bv-comment-head { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; margin-bottom: 10px; }
  .bv-c-name { font-family: 'DM Sans', sans-serif; font-size: 13px; color: var(--text-primary, #f0ede8); }
  .bv-c-badge { font-family: 'DM Sans', sans-serif; font-size: 9px; font-weight: 700; letter-spacing: .11em; text-transform: uppercase; color: var(--text-brand, #8fbf8f); background: rgba(127,168,127,.12); border-radius: 3px; padding: 2px 7px; }
  .bv-c-op { background: rgba(127,168,127,.15); color: var(--text-brand, #8fbf8f); }
  .bv-c-time { margin-left: auto; font-family: 'DM Sans', sans-serif; font-size: 11px; color: var(--text-weak, #504e4a); }
  .bv-c-body { font-family: 'DM Sans', sans-serif; font-size: 13px; color: var(--text-secondary, #b8b4ac); line-height: 1.7; white-space: pre-wrap; }
  .bv-c-body-removed { font-style: italic; color: var(--text-tertiary, #7a7670); }
  .bv-c-actions { display: flex; align-items: center; gap: 12px; margin-top: 12px; }
  .bv-c-like-wrap { display: inline-flex; align-items: center; gap: 6px; }
  .bv-c-like-count { font-family: 'DM Sans', sans-serif; font-size: 11px; color: var(--text-secondary, #b8b4ac); min-width: 10px; }
  .bv-social-actions { margin-top: 12px; display: flex; gap: 8px; }
  .bv-social-icon-group { flex: 1; min-width: 0; display: inline-flex; align-items: center; justify-content: center; gap: 8px; border: 1px solid var(--border-secondary, rgba(255,255,255,.1)); border-radius: 6px; padding: 6px 8px; }
  .bv-social-count { font-family: 'DM Sans', sans-serif; font-size: 11px; color: var(--text-secondary, #b8b4ac); min-width: 10px; text-align: left; }
  .bv-c-reply-btn, .bv-c-show-replies { background: none; border: none; color: var(--text-brand, #8fbf8f); font-family: 'DM Sans', sans-serif; font-size: 11px; cursor: pointer; padding: 0; }
  .bv-c-show-replies { color: var(--text-tertiary, #7a7670); }
  .bv-c-manage { margin-left: auto; display: flex; gap: 8px; }
  .bv-c-edit-btn, .bv-c-del-btn { padding: 4px 12px; border-radius: 3px; font-family: 'DM Sans', sans-serif; font-size: 10px; letter-spacing: .12em; text-transform: uppercase; cursor: pointer; background: transparent; }
  .bv-c-edit-btn { border: 1px solid var(--border-secondary, rgba(255,255,255,.1)); color: var(--text-secondary, #b8b4ac); }
  .bv-c-del-btn { border: 1px solid rgba(200,70,70,.3); color: rgba(200,90,90,.9); }
  @media (max-width: 960px) {
    .bv-root { height: auto; min-height: 0; overflow: visible; }
    .bv-mobile-controls {
      display: flex;
      gap: 8px;
      align-items: center;
      padding: 10px 14px;
      background: var(--base-primary, #0f0f0f);
      border-bottom: 1px solid var(--border-weak, rgba(255,255,255,.06));
      position: sticky;
      top: 0;
      z-index: 15;
    }
    .bv-mobile-btn {
      padding: 8px 10px;
      border-radius: 6px;
      font-family: 'DM Sans', sans-serif;
      font-size: 10px;
      letter-spacing: .1em;
      text-transform: uppercase;
      font-weight: 600;
      cursor: pointer;
    }
    .bv-mobile-btn-primary { border: 1px solid var(--border-brand, #7fa87f); background: var(--interactive-brand-primary, #7fa87f); color: var(--text-on-brand, #0d160d); }
    .bv-mobile-btn-ghost { border: 1px solid var(--border-secondary, rgba(255,255,255,.1)); background: transparent; color: var(--text-secondary, #b8b4ac); }
    .bv-mobile-status { margin-left: auto; font-family: 'DM Sans', sans-serif; font-size: 10px; letter-spacing: .1em; text-transform: uppercase; color: var(--text-tertiary, #7a7670); }
    .bv-body { height: auto; }
    .bv-grid { height: auto; padding: 16px 16px 60px; display: block; }
    .bv-main { height: auto; overflow: visible; padding-right: 0; padding-bottom: 0; }
    .bv-sidebar { position: static; width: 100%; order: -1; overflow: visible; max-height: none; margin-bottom: 16px; }
    .bv-comment-card.depth1 { margin-left: 12px; }
  }
`;

const SectionLabel = ({ children }) => (
  <div className="eyebrow">
    <div className="eyebrow-bar" />
    <span className="eyebrow-text">{children}</span>
  </div>
);

const formatDate = (value) => {
  if (!value) return 'Unknown';
  return new Date(value).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
};

const normalizeComments = (comments = [], { markRepliesLoaded = false } = {}) => comments.map((item) => {
  const isRemoved = Boolean(item?.isDeleted || item?.isRemoved);
  const fallbackRemovalNote = isRemoved
    ? (item?.removedBy === 'admin' || item?.removedBy === 'moderator'
      ? 'Comment removed by admin/moderator'
      : 'Comment removed by user')
    : '';
  const normalizedReplies = normalizeComments(item.replies || [], { markRepliesLoaded: true });
  const replyCount = Number(item?.replyCount ?? normalizedReplies.length ?? 0);

  return {
    ...item,
    likeCount: Number(item?.likeCount || 0),
    isLiked: Boolean(item?.isLiked),
    removalNote: item?.removalNote || fallbackRemovalNote,
    replyCount,
    replies: normalizedReplies,
    repliesLoaded: markRepliesLoaded,
  };
});

const BlogViewPage = () => {
  const { slug } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const observeReveal = useBatchIntersectionObserver({ threshold: 0.08, rootMargin: '140px 0px' });
  const [blog, setBlog] = useState(null);
  const [comments, setComments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [commentText, setCommentText] = useState('');
  const [replyingToId, setReplyingToId] = useState(null);
  const [replyText, setReplyText] = useState('');
  const [editingCommentId, setEditingCommentId] = useState(null);
  const [editingCommentText, setEditingCommentText] = useState('');
  const [submittingComment, setSubmittingComment] = useState(false);
  const [submittingReply, setSubmittingReply] = useState(false);
  const [expandedReplies, setExpandedReplies] = useState({});
  const [togglingLike, setTogglingLike] = useState(false);
  const [togglingBookmark, setTogglingBookmark] = useState(false);
  const [togglingFeatured, setTogglingFeatured] = useState(false);
  const [commentLikeBusy, setCommentLikeBusy] = useState({});
  const [metrics, setMetrics] = useState(null);
  const [commentsPage, setCommentsPage] = useState(1);
  const [commentsHasNext, setCommentsHasNext] = useState(false);
  const [commentsLoading, setCommentsLoading] = useState(false);
  const [repliesLoading, setRepliesLoading] = useState({});
  const [adminTooltip, setAdminTooltip] = useState(null);
  const adminTooltipRef = useRef(null);

  const canModerate = user?.role === 'admin' || user?.role === 'moderator';
  const canFeature = user?.role === 'admin';
  const canEditBlog = user && blog?.author?._id === user._id;

  const loadComments = async (blogId, page = 1, append = false) => {
    try {
      setCommentsLoading(true);
      const response = await blogApi.getCommentsByBlogId(blogId, {
        page,
        limit: 10,
        includeReplies: false,
      });
      const payload = response?.data || response || {};
      const entries = normalizeComments(payload.entries || []);
      const pagination = payload.pagination || {};
      setComments((prev) => (append ? [...prev, ...entries] : entries));
      setCommentsPage(Number(pagination.page || page));
      setCommentsHasNext(Boolean(pagination.hasNextPage));
      if (!append) {
        setExpandedReplies({});
      }
    } catch {
      if (!append) {
        setComments([]);
        setCommentsHasNext(false);
      }
    } finally {
      setCommentsLoading(false);
    }
  };

  const updateCommentTree = (items, commentId, updater) => items.map((item) => {
    if (item._id === commentId) {
      return updater(item);
    }
    if (Array.isArray(item.replies) && item.replies.length > 0) {
      return {
        ...item,
        replies: updateCommentTree(item.replies, commentId, updater),
      };
    }
    return item;
  });

  const loadReplies = async (commentId) => {
    if (!commentId || repliesLoading[commentId]) return;
    setRepliesLoading((prev) => ({ ...prev, [commentId]: true }));
    try {
      const response = await blogApi.getCommentReplies(commentId, { limit: 10, includeNested: true });
      const payload = response?.data || response || [];
      const normalizedReplies = normalizeComments(payload || [], { markRepliesLoaded: true });
      setComments((prev) => updateCommentTree(prev, commentId, (item) => ({
        ...item,
        replies: normalizedReplies,
        repliesLoaded: true,
        replyCount: Math.max(Number(item.replyCount || 0), normalizedReplies.length),
      })));
    } catch {
      // no-op for reply load failures
    } finally {
      setRepliesLoading((prev) => ({ ...prev, [commentId]: false }));
    }
  };

  useEffect(() => {
    const fetchBlog = async () => {
      try {
        setLoading(true);
        setError(null);
        const query = new URLSearchParams(location.search);
        const blogId = query.get('id');
        let response = null;

        if (slug) {
          try {
            response = await blogApi.getBlogBySlug(slug);
          } catch {
            response = null;
          }
        }

        // Admin/moderation fallback: review items may not resolve cleanly by slug.
        if ((!response?._id) && blogId) {
          try {
            response = await blogApi.getBlogById(blogId);
          } catch {
            response = null;
          }
        }

        if (!response?._id) {
          setError('Blog not found');
          return;
        }

        setBlog(response);
        if (response?.title) {
          window.dispatchEvent(new CustomEvent('blog-breadcrumb-label', { detail: { title: response.title } }));
        }
        setCommentsPage(1);
        await loadComments(response._id, 1, false);
      } catch (err) {
        setError(err.message || 'Failed to fetch blog');
      } finally {
        setLoading(false);
      }
    };
    if (slug) fetchBlog();
  }, [slug, location.search]);

  useEffect(() => {
    const loadMetrics = async () => {
      if (!blog?._id) {
        setMetrics(null);
        return;
      }
      try {
        const response = await blogApi.getBlogMetrics(blog._id);
        setMetrics(response?.data || response || null);
      } catch {
        setMetrics(null);
      }
    };
    loadMetrics();
  }, [blog?._id]);

  const commentCount = useMemo(() => {
    const countNested = (items) => items.reduce((sum, item) => {
      const replyCount = Number(item.replyCount ?? 0);
      if (Array.isArray(item.replies) && item.replies.length > 0) {
        return sum + 1 + countNested(item.replies);
      }
      return sum + 1 + replyCount;
    }, 0);
    return countNested(comments);
  }, [comments]);

  const handleApproveAndPublish = async () => {
    if (!blog?._id) return;
    try {
      const response = await blogApi.approveAndPublishBlog(blog._id);
      const updated = response?._id ? response : response?.data;
      if (updated?._id) setBlog(updated);
    } catch {
      // keep view usable even if approval fails
    }
  };

  const handleToggleBlogLike = async () => {
    if (!user || !blog?._id || togglingLike) return;
    const prevLiked = Boolean(blog.isLiked);
    const prevCount = Number(blog.likeCount || 0);

    setTogglingLike(true);
    setBlog((prev) => ({
      ...prev,
      isLiked: !prevLiked,
      likeCount: prevLiked ? Math.max(0, prevCount - 1) : prevCount + 1,
    }));

    try {
      const response = await blogApi.toggleBlogLike(blog._id);
      const payload = response?.data || response;
      setBlog((prev) => ({
        ...prev,
        isLiked: Boolean(payload?.liked),
        likeCount: Number(payload?.likesCount || 0),
        isBookmarked: payload?.isBookmarked ?? prev.isBookmarked,
        bookmarkCount: payload?.bookmarkCount ?? prev.bookmarkCount,
      }));
    } catch {
      setBlog((prev) => ({
        ...prev,
        isLiked: prevLiked,
        likeCount: prevCount,
      }));
    } finally {
      setTogglingLike(false);
    }
  };

  const handleToggleBlogBookmark = async () => {
    if (!user || !blog?._id || togglingBookmark) return;
    const prevBookmarked = Boolean(blog.isBookmarked);
    const prevCount = Number(blog.bookmarkCount || 0);

    setTogglingBookmark(true);
    setBlog((prev) => ({
      ...prev,
      isBookmarked: !prevBookmarked,
      bookmarkCount: prevBookmarked ? Math.max(0, prevCount - 1) : prevCount + 1,
    }));

    try {
      const response = await blogApi.toggleBlogBookmark(blog._id);
      const payload = response?.data || response;
      setBlog((prev) => ({
        ...prev,
        isBookmarked: Boolean(payload?.bookmarked),
        bookmarkCount: Number(payload?.bookmarkCount || 0),
        isLiked: payload?.isLiked ?? prev.isLiked,
        likeCount: payload?.likesCount ?? prev.likeCount,
      }));
    } catch {
      setBlog((prev) => ({
        ...prev,
        isBookmarked: prevBookmarked,
        bookmarkCount: prevCount,
      }));
    } finally {
      setTogglingBookmark(false);
    }
  };

  const handleCreateComment = async () => {
    const content = commentText.trim();
    if (!user || !blog?._id || !content) return;
    try {
      setSubmittingComment(true);
      await blogApi.createComment({ blogId: blog._id, content });
      setCommentText('');
      setCommentsPage(1);
      await loadComments(blog._id, 1, false);
    } finally {
      setSubmittingComment(false);
    }
  };

  const handleReply = async (parentId) => {
    const content = replyText.trim();
    if (!user || !blog?._id || !parentId || !content) return;
    try {
      setSubmittingReply(true);
      await blogApi.createComment({ blogId: blog._id, content, parentId });
      setReplyText('');
      setReplyingToId(null);
      setExpandedReplies((prev) => ({ ...prev, [parentId]: true }));
      await loadReplies(parentId);
    } finally {
      setSubmittingReply(false);
    }
  };

  const handleSaveEdit = async () => {
    const content = editingCommentText.trim();
    if (!editingCommentId || !content) return;
    await blogApi.updateComment(editingCommentId, { content });
    setEditingCommentId(null);
    setEditingCommentText('');
    setCommentsPage(1);
    await loadComments(blog._id, 1, false);
  };

  const canManageComment = (comment) => {
    if (!user) return false;
    return comment.author?._id === user._id || user.role === 'admin' || user.role === 'moderator';
  };

  const handleToggleFeatured = async () => {
    if (!canFeature || !blog?._id || togglingFeatured) return;
    const nextFeatured = !blog.featured;
    setTogglingFeatured(true);
    setBlog((prev) => ({ ...prev, featured: nextFeatured }));
    try {
      const response = await blogApi.setBlogFeatured(blog._id, nextFeatured);
      const payload = response?.data || response;
      setBlog((prev) => ({ ...prev, featured: Boolean(payload?.featured) }));
    } catch {
      setBlog((prev) => ({ ...prev, featured: !nextFeatured }));
    } finally {
      setTogglingFeatured(false);
    }
  };

  const handleToggleArchive = async () => {
    if (!canModerate || !blog?._id) return;
    const nextStatus = blog.status === 'archived' ? 'draft' : 'archived';
    const prevStatus = blog.status;
    setBlog((prev) => ({ ...prev, status: nextStatus }));
    try {
      const response = await blogApi.updateBlogStatus(blog._id, nextStatus);
      const payload = response?.data || response;
      if (payload?.status) {
        setBlog((prev) => ({ ...prev, status: payload.status }));
      }
    } catch {
      setBlog((prev) => ({ ...prev, status: prevStatus }));
    }
  };

  const isOp = (comment) => comment.author?._id && blog?.author?._id && comment.author._id === blog.author._id;
  const roleLabel = (role) => (!role ? 'User' : `${role.charAt(0).toUpperCase()}${role.slice(1)}`);
  const roleColor = (role) => (role === 'moderator' ? 'rgba(180,130,220,.9)' : 'var(--text-brand, #8fbf8f)');

  const toggleCommentLikeLocal = (commentId, liked, likeCount, items) => {
    return items.map((item) => {
      if (item._id === commentId) {
        return {
          ...item,
          isLiked: liked,
          likeCount,
        };
      }

      if (Array.isArray(item.replies) && item.replies.length > 0) {
        return {
          ...item,
          replies: toggleCommentLikeLocal(commentId, liked, likeCount, item.replies),
        };
      }

      return item;
    });
  };

  const findCommentLikeState = (commentId, items) => {
    for (const item of items) {
      if (item._id === commentId) {
        return {
          isLiked: Boolean(item.isLiked),
          likeCount: Number(item.likeCount || 0),
        };
      }

      if (Array.isArray(item.replies) && item.replies.length > 0) {
        const nested = findCommentLikeState(commentId, item.replies);
        if (nested) return nested;
      }
    }
    return null;
  };

  const handleToggleCommentLike = async (commentId) => {
    if (!user || !commentId || commentLikeBusy[commentId]) return;
    const previous = findCommentLikeState(commentId, comments);
    if (!previous) return;

    const optimisticLiked = !previous.isLiked;
    const optimisticCount = optimisticLiked
      ? previous.likeCount + 1
      : Math.max(0, previous.likeCount - 1);

    setCommentLikeBusy((prev) => ({ ...prev, [commentId]: true }));
    setComments((prev) => toggleCommentLikeLocal(commentId, optimisticLiked, optimisticCount, prev));

    try {
      const response = await blogApi.toggleCommentLike(commentId);
      const payload = response?.data || response;
      if (payload?.commentId) {
        setComments((prev) => toggleCommentLikeLocal(payload.commentId, Boolean(payload.liked), Number(payload.likeCount || 0), prev));
      }
    } catch {
      setComments((prev) => toggleCommentLikeLocal(commentId, previous.isLiked, previous.likeCount, prev));
    } finally {
      setCommentLikeBusy((prev) => ({ ...prev, [commentId]: false }));
    }
  };

  const renderComment = (comment, depth = 0) => {
    const replies = comment.replies || [];
    const replyCount = Number(comment.replyCount ?? replies.length ?? 0);
    const hasReplies = replyCount > 0;
    const repliesOpen = expandedReplies[comment._id] === true;
    const repliesLoaded = Boolean(comment.repliesLoaded);
    const isEditing = editingCommentId === comment._id;
    const isRemoved = Boolean(comment.isDeleted || comment.isRemoved);
    const removalText = comment.removalNote || 'Comment removed by user';
    const commentRevealKey = depth > 0 ? `reply-${comment._id}` : `comment-${comment._id}`;
    return (
      <div
        key={comment._id}
        ref={observeReveal(commentRevealKey)}
        className={`bv-comment-card ${depth > 0 ? 'depth1' : ''} io-reveal`}
        data-io-animation="fade"
      >
        <div className="bv-comment-head">
          <ProfilePicture size="xs" currentPhotoURL={comment.author?.photoURL} />
          <span className="bv-c-name">{comment.author?.displayName || 'Unknown User'}</span>
          <span className="bv-c-badge" style={{ color: roleColor(comment.author?.role) }}>{roleLabel(comment.author?.role)}</span>
          {isOp(comment) && <span className="bv-c-badge bv-c-op">OP</span>}
          <span className="bv-c-time">{new Date(comment.createdAt).toLocaleString()}</span>
        </div>

        {isEditing && !isRemoved ? (
          <div>
            <Input multiline className="bv-comment-textarea" rows={3} value={editingCommentText} onChange={(event) => setEditingCommentText(event.target.value)} />
            <div className="bv-c-actions">
              <Button type="button" variant="ghost" className="bv-c-edit-btn" onClick={handleSaveEdit}>Save</Button>
              <Button type="button" variant="ghost" className="bv-c-edit-btn" onClick={() => { setEditingCommentId(null); setEditingCommentText(''); }}>Cancel</Button>
            </div>
          </div>
        ) : (
          <p className={`bv-c-body ${isRemoved ? 'bv-c-body-removed' : ''}`}>{isRemoved ? removalText : comment.content}</p>
        )}

        <div className="bv-c-actions">
          {user && !isRemoved && (
            <div className="bv-c-like-wrap">
              <IconToggleButton
                preset="like"
                toggled={Boolean(comment.isLiked)}
                onClick={() => handleToggleCommentLike(comment._id)}
                disabled={Boolean(commentLikeBusy[comment._id])}
                loading={Boolean(commentLikeBusy[comment._id])}
                ariaLabel={comment.isLiked ? 'Unlike comment' : 'Like comment'}
                size="sm"
              />
              <span className="bv-c-like-count">{Number(comment.likeCount || 0)}</span>
            </div>
          )}
          {user && !isRemoved && <Button type="button" variant="ghost" className="bv-c-reply-btn p-0 min-h-0 h-auto" onClick={() => { setReplyingToId(comment._id); setReplyText(''); }}>Reply</Button>}
          {hasReplies && (
            <Button
              type="button"
              variant="ghost"
              className="bv-c-show-replies p-0 min-h-0 h-auto"
              onClick={() => {
                const nextOpen = !repliesOpen;
                setExpandedReplies((prev) => ({ ...prev, [comment._id]: nextOpen }));
                if (nextOpen && !repliesLoaded) {
                  loadReplies(comment._id);
                }
              }}
            >
              {repliesOpen
                ? `Hide Replies (${repliesLoaded ? replies.length : replyCount})`
                : `Show Replies (${repliesLoaded ? replies.length : replyCount})`}
            </Button>
          )}
          {canManageComment(comment) && !isRemoved && (
            <div className="bv-c-manage">
              <KebabMenu
                buttonLabel="Comment actions"
                items={[
                  ...(comment.author?._id === user?._id ? [{
                    label: 'Edit',
                    onClick: () => {
                      setEditingCommentId(comment._id);
                      setEditingCommentText(comment.content);
                    },
                  }] : []),
                  {
                    label: 'Remove',
                    intent: 'danger',
                    onClick: async () => {
                      await blogApi.deleteComment(comment._id);
                      setCommentsPage(1);
                      await loadComments(blog._id, 1, false);
                    },
                  },
                ]}
              />
            </div>
          )}
        </div>

        {replyingToId === comment._id && (
          <div style={{ marginTop: 10 }}>
            <Input
              multiline
              className="bv-comment-textarea"
              rows={2}
              placeholder="Write a reply..."
              value={replyText}
              onChange={(event) => setReplyText(event.target.value)}
            />
            <Button type="button" variant="primary" className="bv-post-btn" style={{ marginRight: 8 }} onClick={() => handleReply(comment._id)} disabled={submittingReply || !replyText.trim()}>
              Post Reply
            </Button>
            <Button type="button" variant="ghost" className="bv-c-edit-btn" onClick={() => { setReplyingToId(null); setReplyText(''); }}>Cancel</Button>
          </div>
        )}

        {repliesOpen && (
          <div style={{ marginTop: 10 }}>
            {repliesLoading[comment._id] && <p className="bv-comments-count">Loading replies...</p>}
            {!repliesLoading[comment._id] && replies.length > 0 && replies.map((reply) => renderComment(reply, depth + 1))}
            {!repliesLoading[comment._id] && replies.length === 0 && repliesLoaded && (
              <p className="bv-comments-count">No replies yet.</p>
            )}
          </div>
        )}
      </div>
    );
  };

  if (error || !blog) {
    if (loading) {
      return null;
    }
    return (
      <div className="bv-root flex items-center justify-center px-4">
        <style>{VIEW_STYLES}</style>
        <div className="bv-sb-card max-w-md w-full text-center">
          <h1 className="text-lg text-primary mb-2">Blog Not Found</h1>
          <p className="text-secondary text-sm mb-4">{error || 'The requested blog could not be loaded.'}</p>
          <Button type="button" variant="primary" className="bv-brand-btn" onClick={() => navigate('/blog')}>Back to Blogs</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="bv-root">
      <style>{VIEW_STYLES}</style>

      <div className="bv-hero">
        {blog.featuredImage?.url ? <img src={blog.featuredImage.url} alt={blog.featuredImage?.alt || blog.title} /> : <div className="bv-hero-gradient" />}
        {blog.featuredImage?.caption && <div className="bv-hero-caption">{blog.featuredImage.caption}</div>}
      </div>
      <div className="bv-mobile-controls">
        {canEditBlog && (
          <Button type="button" variant="ghost" className="bv-mobile-btn bv-mobile-btn-ghost" onClick={() => navigate(`/blog/edit/${blog._id}`)}>
            Edit Post
          </Button>
        )}
        {canModerate && blog.status === 'review' && (
          <Button type="button" variant="primary" className="bv-mobile-btn bv-mobile-btn-primary" onClick={handleApproveAndPublish}>
            Approve
          </Button>
        )}
        <span className="bv-mobile-status">{blog.status || 'draft'}</span>
      </div>

      <div className="bv-body">
        <div className="bv-grid">
          <main className="bv-main">
            <header className="bv-article-header io-reveal" data-io-animation="fade" ref={observeReveal('blogview-header')}>
              <div className="bv-cat-row">
                <span className="bv-cat">{(blog.category || 'general').replace(/_/g, ' ')}</span>
                <span className="bl-dot">.</span>
                <span className="bv-date-text">{blog.readingTime || 5} min</span>
                {blog.status && (
                  <>
                    <span className="bl-dot">.</span>
                    <span className="bv-date-text">{blog.status}</span>
                  </>
                )}
              </div>
              <h1 className="bv-h1">{blog.title}</h1>
              <div className="bv-byline">
                <ProfilePicture size="sm" currentPhotoURL={blog.author?.photoURL} />
                <div>
                  <div className="bv-author">{blog.author?.displayName || 'Unknown Author'}</div>
                  <div className="bv-date-text">{formatDate(blog.publishedAt || blog.createdAt)}</div>
                </div>
              </div>
              {blog.tags?.length > 0 && (
                <div className="bv-tags">
                  {blog.tags.map((tag) => <span key={tag} className="bv-tag">#{tag}</span>)}
                </div>
              )}
            </header>

            <div className="bv-prose io-reveal" data-io-animation="slide" ref={observeReveal('blogview-prose')}>
              {(blog.content || '').split('\n\n').map((paragraph, index) => <p key={`${paragraph.slice(0, 10)}-${index}`}>{paragraph}</p>)}
            </div>

            <div className="bv-comments-header io-reveal" data-io-animation="fade" ref={observeReveal('blogview-comments-header')}>
              <SectionLabel>Comments</SectionLabel>
              <span className="bv-comments-count">{commentCount} comments</span>
            </div>

            {user ? (
              <div className="bv-new-comment io-reveal" data-io-animation="slide" ref={observeReveal('blogview-new-comment')}>
                <div className="bv-new-comment-inner">
                  <ProfilePicture size="sm" />
                  <div style={{ flex: 1 }}>
                    <Input multiline className="bv-comment-textarea" rows={3} placeholder="Share your thoughts or experiences..." value={commentText} onChange={(event) => setCommentText(event.target.value)} />
                    <Button type="button" variant="primary" className="bv-post-btn" onClick={handleCreateComment} disabled={submittingComment || !commentText.trim()}>
                      {submittingComment ? 'Posting...' : 'Post Comment'}
                    </Button>
                  </div>
                </div>
              </div>
            ) : (
              <p className="bv-comments-count" style={{ marginBottom: 16 }}>Sign in to join the discussion.</p>
            )}

            <div className="io-reveal" data-io-animation="fade" ref={observeReveal('blogview-comments-list')}>
              {comments.length > 0 ? comments.map((comment) => renderComment(comment)) : <p className="bv-comments-count">No comments yet.</p>}
            </div>
            {commentsHasNext && (
              <div style={{ marginTop: 14 }}>
                <Button
                  type="button"
                  variant="ghost"
                  className="bv-ghost-btn"
                  onClick={() => loadComments(blog._id, commentsPage + 1, true)}
                  disabled={commentsLoading}
                >
                  {commentsLoading ? 'Loading...' : 'Load more comments'}
                </Button>
              </div>
            )}
          </main>

          <aside className="bv-sidebar">
            <div className="bv-sb-card io-reveal" data-io-animation="fade" ref={observeReveal('blogview-sidebar-author')}>
              <SectionLabel>Author</SectionLabel>
              <div className="bv-sb-author-inner">
                <ProfilePicture size="lg" currentPhotoURL={blog.author?.photoURL} />
                <div>
                  <div className="bv-sb-name">{blog.author?.displayName || 'Unknown Author'}</div>
                  <div className="bv-sb-role">{roleLabel(blog.author?.role || 'user')}</div>
                </div>
              </div>
            </div>

            <div className="bv-sb-card io-reveal" data-io-animation="fade" ref={observeReveal('blogview-sidebar-info')}>
              <SectionLabel>Post Info</SectionLabel>
              <div style={{ marginTop: 14 }}>
                <div className="bv-info-row"><span className="bv-info-label">Category</span><span className="bv-info-val">{(blog.category || 'general').replace(/_/g, ' ')}</span></div>
                <div className="bv-info-row"><span className="bv-info-label">Reading time</span><span className="bv-info-val">{blog.readingTime || 5} min</span></div>
                <div className="bv-info-row"><span className="bv-info-label">Published</span><span className="bv-info-val">{formatDate(blog.publishedAt || blog.createdAt)}</span></div>
                <div className="bv-info-row"><span className="bv-info-label">Views</span><span className="bv-info-val">{Number(metrics?.views ?? blog?.analytics?.views ?? 0)}</span></div>
                <div className="bv-info-row"><span className="bv-info-label">Comments</span><span className="bv-info-val">{commentCount}</span></div>
                <div className="bv-info-row"><span className="bv-info-label">Likes</span><span className="bv-info-val">{Number(blog.likeCount || 0)}</span></div>
                <div className="bv-info-row"><span className="bv-info-label">Saved</span><span className="bv-info-val">{Number(blog.bookmarkCount || 0)}</span></div>
                <div className="bv-info-row"><span className="bv-info-label">Featured</span><span className="bv-info-val">{blog.featured ? 'Yes' : 'No'}</span></div>
              </div>
              {canModerate && (
                <div
                  ref={adminTooltipRef}
                  style={{ display: 'flex', justifyContent: 'space-evenly', marginTop: 12, width: '100%', position: 'relative' }}
                  onMouseLeave={() => setAdminTooltip(null)}
                >
                  {blog.status === 'review' && (
                    <button
                      type="button"
                      onClick={handleApproveAndPublish}
                      style={{ border: 'none', background: 'transparent', cursor: 'pointer', padding: 4 }}
                      aria-label="Approve and publish"
                      onMouseEnter={(event) => {
                        const containerRect = adminTooltipRef.current?.getBoundingClientRect();
                        const targetRect = event.currentTarget.getBoundingClientRect();
                        if (!containerRect) return;
                        setAdminTooltip({
                          label: 'Approve',
                          x: targetRect.left - containerRect.left + targetRect.width / 2,
                          y: targetRect.top - containerRect.top,
                          bottomY: targetRect.bottom - containerRect.top,
                        });
                      }}
                    >
                      <CheckCircle size={20} color="var(--interactive-success)" />
                    </button>
                  )}
                  {blog.status === 'review' && (
                    <button
                      type="button"
                      onClick={() => {}} // Placeholder for reject
                      style={{ border: 'none', background: 'transparent', cursor: 'pointer', padding: 4 }}
                      aria-label="Reject post"
                      onMouseEnter={(event) => {
                        const containerRect = adminTooltipRef.current?.getBoundingClientRect();
                        const targetRect = event.currentTarget.getBoundingClientRect();
                        if (!containerRect) return;
                        setAdminTooltip({
                          label: 'Reject',
                          x: targetRect.left - containerRect.left + targetRect.width / 2,
                          y: targetRect.top - containerRect.top,
                          bottomY: targetRect.bottom - containerRect.top,
                        });
                      }}
                    >
                      <XCircle size={20} color="var(--interactive-danger)" />
                    </button>
                  )}
                  {canFeature && (
                    <button
                      type="button"
                      onClick={handleToggleFeatured}
                      style={{ border: 'none', background: 'transparent', cursor: 'pointer', padding: 4 }}
                      aria-label={blog.featured ? 'Remove from featured' : 'Add to featured'}
                      onMouseEnter={(event) => {
                        const containerRect = adminTooltipRef.current?.getBoundingClientRect();
                        const targetRect = event.currentTarget.getBoundingClientRect();
                        if (!containerRect) return;
                        setAdminTooltip({
                          label: blog.featured ? 'Remove featured' : 'Feature',
                          x: targetRect.left - containerRect.left + targetRect.width / 2,
                          y: targetRect.top - containerRect.top,
                          bottomY: targetRect.bottom - containerRect.top,
                        });
                      }}
                    >
                      <Star size={20} fill={blog.featured ? "var(--accent-indicator)" : "none"} color={blog.featured ? "var(--accent-indicator)" : "var(--text-tertiary)"} />
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={handleToggleArchive}
                    style={{ border: 'none', background: 'transparent', cursor: 'pointer', padding: 4 }}
                    aria-label={blog.status === 'archived' ? 'Restore from archive' : 'Archive post'}
                    onMouseEnter={(event) => {
                      const containerRect = adminTooltipRef.current?.getBoundingClientRect();
                      const targetRect = event.currentTarget.getBoundingClientRect();
                      if (!containerRect) return;
                      setAdminTooltip({
                        label: blog.status === 'archived' ? 'Restore' : 'Archive',
                        x: targetRect.left - containerRect.left + targetRect.width / 2,
                        y: targetRect.top - containerRect.top,
                        bottomY: targetRect.bottom - containerRect.top,
                      });
                    }}
                  >
                    <Archive size={20} color={blog.status === 'archived' ? "var(--interactive-success)" : "var(--text-tertiary)"} />
                  </button>
                  {adminTooltip && (
                    <Tooltip
                      x={adminTooltip.x}
                      y={adminTooltip.y}
                      containerRef={adminTooltipRef}
                      placement="top"
                      align="center"
                      estimatedWidth={120}
                      estimatedHeight={36}
                      offset={8}
                      items={[{ label: adminTooltip.label }]}
                    />
                  )}
                </div>
              )}
              {user && (
                <div className="bv-social-actions">
                  <div className="bv-social-icon-group">
                    <IconToggleButton
                      preset="like-outline"
                      toggled={Boolean(blog.isLiked)}
                      onClick={handleToggleBlogLike}
                      disabled={togglingLike}
                      loading={togglingLike}
                      ariaLabel={blog.isLiked ? 'Unlike blog' : 'Like blog'}
                      size="sm"
                    />
                    <span className="bv-social-count">{Number(blog.likeCount || 0)}</span>
                  </div>
                  <div className="bv-social-icon-group">
                    <IconToggleButton
                      preset="bookmark-outline"
                      toggled={Boolean(blog.isBookmarked)}
                      onClick={handleToggleBlogBookmark}
                      disabled={togglingBookmark}
                      loading={togglingBookmark}
                      ariaLabel={blog.isBookmarked ? 'Remove bookmark' : 'Bookmark blog'}
                      size="sm"
                    />
                    <span className="bv-social-count">{Number(blog.bookmarkCount || 0)}</span>
                  </div>
                </div>
              )}
              {canEditBlog && (
                <Button type="button" variant="ghost" className="bv-edit-btn" style={{ marginTop: 12, width: '100%' }} onClick={() => navigate(`/blog/edit/${blog._id}`)}>
                  Edit Post
                </Button>
              )}
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
};

export default BlogViewPage;