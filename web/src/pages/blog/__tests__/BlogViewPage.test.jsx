import React from 'react';
import { fireEvent, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderWithRouter } from '../../../test/testUtils';
import BlogViewPage from '../BlogViewPage';

const mocks = vi.hoisted(() => ({
  navigate: vi.fn(),
  useParams: vi.fn(),
  useLocation: vi.fn(),
  blogApi: {
    getBlogBySlug: vi.fn(),
    getBlogById: vi.fn(),
    getCommentsByBlogId: vi.fn(),
    getCommentReplies: vi.fn(),
    approveAndPublishBlog: vi.fn(),
    getBlogMetrics: vi.fn(),
    createComment: vi.fn(),
    updateComment: vi.fn(),
    deleteComment: vi.fn(),
  },
  auth: {
    user: null,
  },
}));

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mocks.navigate,
    useParams: () => mocks.useParams(),
    useLocation: () => mocks.useLocation(),
  };
});

vi.mock('../../../services/blogService', () => ({
  default: mocks.blogApi,
}));

vi.mock('../../../hooks/useAuth', () => ({
  useAuth: () => ({ user: mocks.auth.user }),
}));

vi.mock('../../../components/common/Loading', () => {
  const LoadingMock = ({ onComplete }) => {
    React.useEffect(() => {
      onComplete?.();
    }, [onComplete]);
    return <div>Loading</div>;
  };
  return { default: LoadingMock };
});

vi.mock('../../../components/common/ProfilePicture', () => ({
  default: ({ currentPhotoURL = '' }) => <div data-testid="profile-picture">{currentPhotoURL}</div>,
}));

vi.mock('../../../components/common/KebabMenu', () => ({
  default: ({ items = [], buttonLabel = 'Comment actions' }) => (
    <div>
      <button type="button">{buttonLabel}</button>
      {items.map((item) => (
        <button key={item.label} type="button" onClick={item.onClick}>
          {item.label}
        </button>
      ))}
    </div>
  ),
}));

const baseBlog = {
  _id: 'blog-1',
  slug: 'herbal-basics',
  title: 'Herbal Basics',
  excerpt: 'Blog excerpt',
  content: 'First paragraph.\n\nSecond paragraph.',
  category: 'general',
  status: 'review',
  author: {
    _id: 'author-1',
    displayName: 'Author Name',
  },
  createdAt: '2026-01-01T00:00:00.000Z',
};

describe('BlogViewPage', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.useParams.mockReturnValue({ slug: 'herbal-basics' });
    mocks.useLocation.mockReturnValue({ search: '' });
    mocks.auth.user = null;
    mocks.blogApi.getBlogBySlug.mockResolvedValue(baseBlog);
    mocks.blogApi.getBlogById.mockResolvedValue(baseBlog);
    mocks.blogApi.getCommentsByBlogId.mockResolvedValue({
      data: {
        entries: [],
        pagination: {
          page: 1,
          limit: 10,
          total: 0,
          totalPages: 1,
          hasNextPage: false,
          hasPrevPage: false,
        },
      },
    });
    mocks.blogApi.getCommentReplies.mockResolvedValue({ data: [] });
    mocks.blogApi.approveAndPublishBlog.mockResolvedValue({
      ...baseBlog,
      status: 'published',
    });
    mocks.blogApi.getBlogMetrics.mockResolvedValue({ data: { views: 12 } });
    mocks.blogApi.createComment.mockResolvedValue({ _id: 'comment-1' });
    mocks.blogApi.updateComment.mockResolvedValue({ data: { _id: 'comment-1' } });
    mocks.blogApi.deleteComment.mockResolvedValue({ success: true });
  });

  it('falls back to blog id query when slug lookup fails', async () => {
    mocks.useParams.mockReturnValue({ slug: 'missing-slug' });
    mocks.useLocation.mockReturnValue({ search: '?id=blog-1' });
    mocks.blogApi.getBlogBySlug.mockRejectedValue(new Error('Not found'));

    renderWithRouter(<BlogViewPage />);

    await waitFor(() => {
      expect(mocks.blogApi.getBlogBySlug).toHaveBeenCalledWith('missing-slug');
      expect(mocks.blogApi.getBlogById).toHaveBeenCalledWith('blog-1');
      expect(screen.getByText('Herbal Basics')).toBeInTheDocument();
    });
  });

  it('loads blog by slug, loads comments, and dispatches breadcrumb label event', async () => {
    const breadcrumbListener = vi.fn();
    window.addEventListener('blog-breadcrumb-label', breadcrumbListener);

    renderWithRouter(<BlogViewPage />);

    await waitFor(() => {
      expect(screen.getByText('Herbal Basics')).toBeInTheDocument();
      expect(mocks.blogApi.getBlogBySlug).toHaveBeenCalledWith('herbal-basics');
      expect(mocks.blogApi.getCommentsByBlogId).toHaveBeenCalledWith('blog-1', {
        page: 1,
        limit: 10,
        includeReplies: false,
      });
      expect(breadcrumbListener).toHaveBeenCalled();
    });

    window.removeEventListener('blog-breadcrumb-label', breadcrumbListener);
  });

  it('allows moderator/admin to approve and publish review blogs', async () => {
    mocks.auth.user = { _id: 'mod-1', role: 'moderator' };

    renderWithRouter(<BlogViewPage />);

    await waitFor(() => {
      expect(screen.getByText('Herbal Basics')).toBeInTheDocument();
    });

    fireEvent.click(screen.getAllByRole('button', { name: /approve/i })[0]);

    await waitFor(() => {
      expect(mocks.blogApi.approveAndPublishBlog).toHaveBeenCalledWith('blog-1');
      expect(screen.getAllByText('published').length).toBeGreaterThan(0);
    });
  });

  it('submits a new comment for authenticated users', async () => {
    mocks.auth.user = { _id: 'user-1', role: 'user' };
    mocks.blogApi.getCommentsByBlogId
      .mockResolvedValueOnce({
        data: {
          entries: [],
          pagination: {
            page: 1,
            limit: 10,
            total: 0,
            totalPages: 1,
            hasNextPage: false,
            hasPrevPage: false,
          },
        },
      })
      .mockResolvedValueOnce({
        data: {
          entries: [
            {
              _id: 'comment-1',
              content: 'Great post!',
              createdAt: '2026-01-02T00:00:00.000Z',
              author: { _id: 'user-1', displayName: 'Reader', role: 'user' },
              replies: [],
              replyCount: 0,
            },
          ],
          pagination: {
            page: 1,
            limit: 10,
            total: 1,
            totalPages: 1,
            hasNextPage: false,
            hasPrevPage: false,
          },
        },
      });

    renderWithRouter(<BlogViewPage />);

    await waitFor(() => {
      expect(screen.getByText('Herbal Basics')).toBeInTheDocument();
    });

    const commentBox = screen.getByPlaceholderText(/Share your thoughts/i);
    fireEvent.change(commentBox, { target: { value: ' Great post! ' } });
    fireEvent.click(screen.getByRole('button', { name: 'Post Comment' }));

    await waitFor(() => {
      expect(mocks.blogApi.createComment).toHaveBeenCalledWith({
        blogId: 'blog-1',
        content: 'Great post!',
      });
      expect(commentBox).toHaveValue('');
      expect(screen.getByText('Great post!')).toBeInTheDocument();
    });
  });

  it('shows sign-in prompt for anonymous users in comments section', async () => {
    renderWithRouter(<BlogViewPage />);

    await waitFor(() => {
      expect(screen.getByText('Sign in to join the discussion.')).toBeInTheDocument();
    });
  });

  it('submits a reply for a parent comment', async () => {
    mocks.auth.user = { _id: 'user-1', role: 'user' };
    mocks.blogApi.getCommentsByBlogId
      .mockResolvedValueOnce({
        data: {
          entries: [
            {
              _id: 'comment-1',
              content: 'Parent comment',
              createdAt: '2026-01-02T00:00:00.000Z',
              author: { _id: 'author-2', displayName: 'Other User', role: 'user' },
              replies: [],
              replyCount: 0,
            },
          ],
          pagination: {
            page: 1,
            limit: 10,
            total: 1,
            totalPages: 1,
            hasNextPage: false,
            hasPrevPage: false,
          },
        },
      });
    mocks.blogApi.getCommentReplies.mockResolvedValueOnce({
      data: [
        {
          _id: 'reply-1',
          content: 'Thanks for sharing',
          createdAt: '2026-01-02T00:00:00.000Z',
          author: { _id: 'user-1', displayName: 'Reader', role: 'user' },
          replies: [],
        },
      ],
    });

    renderWithRouter(<BlogViewPage />);

    await waitFor(() => {
      expect(screen.getByText('Parent comment')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: 'Reply' }));
    fireEvent.change(screen.getByPlaceholderText(/Write a reply/i), {
      target: { value: ' Thanks for sharing ' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Post Reply' }));

    await waitFor(() => {
      expect(mocks.blogApi.createComment).toHaveBeenCalledWith({
        blogId: 'blog-1',
        content: 'Thanks for sharing',
        parentId: 'comment-1',
      });
      expect(mocks.blogApi.getCommentReplies).toHaveBeenCalledWith('comment-1', { limit: 10, includeNested: true });
      expect(screen.getByText('Thanks for sharing')).toBeInTheDocument();
    });
  });

  it('edits an existing comment authored by current user', async () => {
    mocks.auth.user = { _id: 'user-1', role: 'user' };
    mocks.blogApi.getCommentsByBlogId
      .mockResolvedValueOnce({
        data: {
          entries: [
            {
              _id: 'comment-1',
              content: 'Original content',
              createdAt: '2026-01-02T00:00:00.000Z',
              author: { _id: 'user-1', displayName: 'Reader', role: 'user' },
              replies: [],
              replyCount: 0,
            },
          ],
          pagination: {
            page: 1,
            limit: 10,
            total: 1,
            totalPages: 1,
            hasNextPage: false,
            hasPrevPage: false,
          },
        },
      })
      .mockResolvedValueOnce({
        data: {
          entries: [
            {
              _id: 'comment-1',
              content: 'Updated content',
              createdAt: '2026-01-02T00:00:00.000Z',
              author: { _id: 'user-1', displayName: 'Reader', role: 'user' },
              replies: [],
              replyCount: 0,
            },
          ],
          pagination: {
            page: 1,
            limit: 10,
            total: 1,
            totalPages: 1,
            hasNextPage: false,
            hasPrevPage: false,
          },
        },
      });

    renderWithRouter(<BlogViewPage />);

    await waitFor(() => {
      expect(screen.getByText('Original content')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: 'Edit' }));
    fireEvent.change(screen.getByDisplayValue('Original content'), {
      target: { value: ' Updated content ' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => {
      expect(mocks.blogApi.updateComment).toHaveBeenCalledWith('comment-1', {
        content: 'Updated content',
      });
      expect(screen.getByText('Updated content')).toBeInTheDocument();
    });
  });

  it('removes a comment and renders removal placeholder', async () => {
    mocks.auth.user = { _id: 'user-1', role: 'admin' };
    mocks.blogApi.getCommentsByBlogId
      .mockResolvedValueOnce({
        data: {
          entries: [
            {
              _id: 'comment-1',
              content: 'Comment to delete',
              createdAt: '2026-01-02T00:00:00.000Z',
              author: { _id: 'author-2', displayName: 'Other User', role: 'user' },
              replies: [],
              replyCount: 0,
            },
          ],
          pagination: {
            page: 1,
            limit: 10,
            total: 1,
            totalPages: 1,
            hasNextPage: false,
            hasPrevPage: false,
          },
        },
      })
      .mockResolvedValueOnce({
        data: {
          entries: [
            {
              _id: 'comment-1',
              content: '',
              removalNote: 'Comment removed by admin/moderator',
              isDeleted: true,
              createdAt: '2026-01-02T00:00:00.000Z',
              author: { _id: 'author-2', displayName: 'Other User', role: 'user' },
              replies: [],
              replyCount: 0,
            },
          ],
          pagination: {
            page: 1,
            limit: 10,
            total: 1,
            totalPages: 1,
            hasNextPage: false,
            hasPrevPage: false,
          },
        },
      });

    renderWithRouter(<BlogViewPage />);

    await waitFor(() => {
      expect(screen.getByText('Comment to delete')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: 'Remove' }));

    await waitFor(() => {
      expect(mocks.blogApi.deleteComment).toHaveBeenCalledWith('comment-1');
      expect(screen.getByText('Comment removed by admin/moderator')).toBeInTheDocument();
    });
  });

  it('toggles nested replies visibility', async () => {
    mocks.auth.user = { _id: 'user-1', role: 'user' };
    mocks.blogApi.getCommentsByBlogId.mockResolvedValue({
      data: {
        entries: [
          {
            _id: 'comment-1',
            content: 'Parent comment',
            createdAt: '2026-01-02T00:00:00.000Z',
            author: { _id: 'author-2', displayName: 'Other User', role: 'user' },
            replies: [],
            replyCount: 1,
          },
        ],
        pagination: {
          page: 1,
          limit: 10,
          total: 1,
          totalPages: 1,
          hasNextPage: false,
          hasPrevPage: false,
        },
      },
    });
    mocks.blogApi.getCommentReplies.mockResolvedValueOnce({
      data: [
        {
          _id: 'reply-1',
          content: 'Nested reply',
          createdAt: '2026-01-02T00:00:00.000Z',
          author: { _id: 'user-1', displayName: 'Reader', role: 'user' },
          replies: [],
        },
      ],
    });

    renderWithRouter(<BlogViewPage />);

    await waitFor(() => {
      expect(screen.getByText('Show Replies (1)')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: 'Show Replies (1)' }));
    await waitFor(() => {
      expect(screen.getByText('Nested reply')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: 'Hide Replies (1)' }));
    expect(screen.queryByText('Nested reply')).not.toBeInTheDocument();
  });
});
