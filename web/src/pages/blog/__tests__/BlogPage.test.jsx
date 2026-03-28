import React from 'react';
import { fireEvent, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderWithRouter } from '../../../test/testUtils';
import BlogPage from '../BlogPage';

const mocks = vi.hoisted(() => ({
  navigate: vi.fn(),
  blogApi: {
    getPublishedBlogs: vi.fn(),
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
  };
});

vi.mock('../../../services/blogService', () => ({
  default: mocks.blogApi,
}));

vi.mock('../../../hooks/useAuth', () => ({
  useAuth: () => ({ user: mocks.auth.user }),
}));

vi.mock('../../../components/common/ProfilePicture', () => ({
  default: ({ currentPhotoURL = '' }) => <div data-testid="profile-picture">{currentPhotoURL}</div>,
}));

vi.mock('../../../components/common/Dropdown', () => ({
  default: ({ value, onChange, options = [] }) => (
    <select
      aria-label="Category filter mobile"
      value={value}
      onChange={(event) => onChange(event.target.value)}
    >
      {options.map((option) => (
        <option key={option.value} value={option.value}>{option.label}</option>
      ))}
    </select>
  ),
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

const makeResponse = (blogs, pagination = { page: 1, limit: 10, total: blogs.length, pages: 1 }) => ({
  data: {
    blogs,
    pagination,
  },
});

describe('BlogPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.auth.user = null;
    mocks.blogApi.getPublishedBlogs.mockResolvedValue(
      makeResponse([
        {
          _id: 'blog-1',
          slug: 'herbal-basics',
          title: 'Herbal Basics',
          excerpt: 'Basic intro',
          category: 'general',
          author: { displayName: 'Alice' },
          publishedAt: '2026-01-01T00:00:00.000Z',
        },
      ])
    );
  });

  it('loads published blogs on mount with default pagination params', async () => {
    renderWithRouter(<BlogPage />);

    await waitFor(() => {
      expect(mocks.blogApi.getPublishedBlogs).toHaveBeenCalledWith({ page: 1, limit: 10 });
      expect(screen.getByText('Herbal Basics')).toBeInTheDocument();
    });
  });

  it('changes category and refetches with category filter', async () => {
    mocks.blogApi.getPublishedBlogs.mockResolvedValue(
      makeResponse([
        { _id: '2', slug: 'b', title: 'Safety A', excerpt: 'y', category: 'safety', author: { displayName: 'Alice' }, publishedAt: '2026-01-01T00:00:00.000Z' },
      ])
    );

    renderWithRouter(<BlogPage />);

    await waitFor(() => {
      expect(screen.getByText('Safety A')).toBeInTheDocument();
    });

    fireEvent.change(screen.getAllByLabelText('Category filter mobile')[0], {
      target: { value: 'safety' },
    });

    await waitFor(() => {
      expect(mocks.blogApi.getPublishedBlogs).toHaveBeenLastCalledWith({
        page: 1,
        limit: 10,
        category: 'safety',
      });
    });
  });

  it('filters loaded blogs by search input', async () => {
    mocks.blogApi.getPublishedBlogs.mockResolvedValue(
      makeResponse([
        { _id: '1', slug: 'herbal-basics', title: 'Herbal Basics', excerpt: 'Basics', category: 'general', author: { displayName: 'Alice' }, publishedAt: '2026-01-01T00:00:00.000Z' },
        { _id: '2', slug: 'advanced-herbs', title: 'Advanced Herbs', excerpt: 'Advanced', category: 'research', author: { displayName: 'Bob' }, publishedAt: '2026-01-01T00:00:00.000Z' },
      ])
    );

    renderWithRouter(<BlogPage />);

    await waitFor(() => {
      expect(screen.getByText('Herbal Basics')).toBeInTheDocument();
      expect(screen.getByText('Advanced Herbs')).toBeInTheDocument();
    });

    fireEvent.change(screen.getAllByPlaceholderText(/Search.*blog posts/i)[0], {
      target: { value: 'advanced' },
    });

    expect(screen.queryByText('Herbal Basics')).not.toBeInTheDocument();
    expect(screen.getByText('Advanced Herbs')).toBeInTheDocument();
  });

  it('shows login overlay for anonymous write action and navigates to login', async () => {
    renderWithRouter(<BlogPage />);

    await waitFor(() => {
      expect(screen.getByText('Herbal Basics')).toBeInTheDocument();
    });

    fireEvent.click(screen.getAllByRole('button', { name: /write/i })[0]);
    expect(screen.getByText('Login Required')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Sign In' }));
    expect(mocks.navigate).toHaveBeenCalledWith('/login');
  });
});
