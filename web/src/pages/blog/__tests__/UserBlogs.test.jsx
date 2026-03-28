import React from 'react';
import { fireEvent, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderWithRouter } from '../../../test/testUtils';
import UserBlogs from '../UserBlogs';

const mocks = vi.hoisted(() => ({
  navigate: vi.fn(),
  blogApi: {
    getUserBlogs: vi.fn(),
    requestBlogApproval: vi.fn(),
    updateBlogStatus: vi.fn(),
  },
}));

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mocks.navigate,
  };
});

vi.mock('../../../services/blogService', () => ({
  default: mocks.blogApi,
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

const blogsFixture = [
  {
    _id: 'blog-1',
    title: 'Draft Blog',
    excerpt: 'Draft excerpt',
    status: 'draft',
    createdAt: '2026-01-01T00:00:00.000Z',
    slug: 'draft-blog',
  },
  {
    _id: 'blog-2',
    title: 'Published Blog',
    excerpt: 'Published excerpt',
    status: 'published',
    publishedAt: '2026-01-02T00:00:00.000Z',
    slug: 'published-blog',
  },
];

describe('UserBlogs', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.blogApi.getUserBlogs.mockResolvedValue({ blogs: blogsFixture });
    mocks.blogApi.requestBlogApproval.mockResolvedValue({ success: true });
    mocks.blogApi.updateBlogStatus.mockResolvedValue({ success: true });
  });

  it('fetches user blogs on mount with default params', async () => {
    renderWithRouter(<UserBlogs />);

    await waitFor(() => {
      expect(mocks.blogApi.getUserBlogs).toHaveBeenCalledWith({});
      expect(screen.getByText('Draft Blog')).toBeInTheDocument();
      expect(screen.getByText('Published Blog')).toBeInTheDocument();
    });
  });

  it('applies status filter and refetches with selected status', async () => {
    mocks.blogApi.getUserBlogs
      .mockResolvedValueOnce({ blogs: blogsFixture })
      .mockResolvedValueOnce({ blogs: [blogsFixture[0]] });

    renderWithRouter(<UserBlogs />);

    await waitFor(() => {
      expect(screen.getByText('Published Blog')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: /all \(\d+\)/i }));
    fireEvent.click(screen.getByRole('option', { name: /drafts \(\d+\)/i }));

    await waitFor(() => {
      expect(mocks.blogApi.getUserBlogs).toHaveBeenLastCalledWith({ status: 'draft' });
      expect(screen.getByText('Draft Blog')).toBeInTheDocument();
      expect(screen.queryByText('Published Blog')).not.toBeInTheDocument();
    });
  });

  it('requests approval for draft blog and refreshes current list', async () => {
    mocks.blogApi.getUserBlogs
      .mockResolvedValueOnce({ blogs: blogsFixture })
      .mockResolvedValueOnce({
        blogs: [{ ...blogsFixture[0], status: 'review' }],
      });

    renderWithRouter(<UserBlogs />);

    await waitFor(() => {
      expect(screen.getByText('Draft Blog')).toBeInTheDocument();
    });

    fireEvent.click(screen.getAllByRole('button', { name: 'Open post actions' })[0]);
    fireEvent.click(screen.getByRole('button', { name: 'Request Approval' }));

    await waitFor(() => {
      expect(mocks.blogApi.requestBlogApproval).toHaveBeenCalledWith('blog-1');
      expect(mocks.blogApi.getUserBlogs).toHaveBeenLastCalledWith({});
      expect(screen.getByText('In Review')).toBeInTheDocument();
    });
  });

  it('navigates for write, edit and view actions', async () => {
    renderWithRouter(<UserBlogs />);

    await waitFor(() => {
      expect(screen.getByText('Draft Blog')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: 'Write New Blog' }));
    expect(mocks.navigate).toHaveBeenCalledWith('/blog/create');

    fireEvent.click(screen.getAllByRole('button', { name: 'Open post actions' })[0]);
    fireEvent.click(screen.getByRole('button', { name: 'Edit' }));
    expect(mocks.navigate).toHaveBeenCalledWith('/blog/edit/blog-1', {
      state: { fromMyBlogs: true },
    });

    fireEvent.click(document.body);
    fireEvent.click(screen.getAllByRole('button', { name: 'Open post actions' })[0]);
    fireEvent.click(screen.getByRole('button', { name: 'View' }));
    expect(mocks.navigate).toHaveBeenCalledWith('/blog/draft-blog', {
      state: { fromMyBlogs: true },
    });
  });
});
