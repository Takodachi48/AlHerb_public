import React from 'react';
import { fireEvent, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderWithRouter } from '../../../test/testUtils';
import BlogFormPage from '../BlogFormPage';

const mocks = vi.hoisted(() => ({
  navigate: vi.fn(),
  useParams: vi.fn(),
  blogApi: {
    getCategories: vi.fn(),
    getBlogById: vi.fn(),
    createBlog: vi.fn(),
    updateBlog: vi.fn(),
  },
  imageService: {
    uploadBlogImage: vi.fn(),
  },
  auth: {
    user: { _id: 'user-1', role: 'user' },
  },
}));

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mocks.navigate,
    useParams: () => mocks.useParams(),
  };
});

vi.mock('../../../services/blogService', () => ({
  default: mocks.blogApi,
}));

vi.mock('../../../services/imageService', () => ({
  imageService: mocks.imageService,
}));

vi.mock('../../../hooks/useAuth', () => ({
  useAuth: () => ({ user: mocks.auth.user }),
}));

describe('BlogFormPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.useParams.mockReturnValue({});
    mocks.blogApi.getCategories.mockResolvedValue({
      success: true,
      data: ['general', 'safety'],
    });
    mocks.blogApi.createBlog.mockResolvedValue({ _id: 'blog-1' });
  });

  it('loads categories on mount', async () => {
    renderWithRouter(<BlogFormPage />);

    await waitFor(() => {
      expect(mocks.blogApi.getCategories).toHaveBeenCalledTimes(1);
      expect(screen.getByRole('option', { name: 'General' })).toBeInTheDocument();
      expect(screen.getByRole('option', { name: 'Safety' })).toBeInTheDocument();
    });
  });

  it('shows validation error when required fields are missing', async () => {
    renderWithRouter(<BlogFormPage />);

    await waitFor(() => {
      expect(mocks.blogApi.getCategories).toHaveBeenCalledTimes(1);
    });

    fireEvent.click(screen.getByRole('button', { name: 'Publish Post' }));

    await waitFor(() => {
      expect(screen.getByText('Title is required')).toBeInTheDocument();
      expect(mocks.blogApi.createBlog).not.toHaveBeenCalled();
    });
  });

  it('creates a blog and normalizes status/tags/keywords for non-admin users', async () => {
    const { container } = renderWithRouter(<BlogFormPage />);

    await waitFor(() => {
      expect(screen.getByRole('option', { name: 'General' })).toBeInTheDocument();
    });

    fireEvent.change(screen.getByPlaceholderText('Enter an engaging title for your blog post'), {
      target: { value: 'My Test Blog' },
    });
    fireEvent.change(screen.getByPlaceholderText('Write a compelling summary that will appear in blog listings'), {
      target: { value: 'This is a valid excerpt for blog testing.' },
    });
    fireEvent.change(container.querySelector('textarea[name="content"]'), {
      target: { value: 'This is my full blog content for testing.' },
    });
    fireEvent.change(screen.getByPlaceholderText('herbs, medicine, wellness'), {
      target: { value: ' one, two , ,three ' },
    });
    fireEvent.change(screen.getByPlaceholderText('herbal medicine, natural remedies, wellness'), {
      target: { value: ' key1, key2 ' },
    });

    const categorySelect = container.querySelector('select[name="category"]');
    const statusSelect = container.querySelector('select[name="status"]');
    fireEvent.change(categorySelect, { target: { value: 'general' } });
    fireEvent.change(statusSelect, { target: { value: 'review' } });

    fireEvent.click(screen.getByRole('button', { name: 'Publish Post' }));

    await waitFor(() => {
      expect(mocks.blogApi.createBlog).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'My Test Blog',
          category: 'general',
          status: 'review',
          tags: ['one', 'two', 'three'],
          seo: expect.objectContaining({
            keywords: ['key1', 'key2'],
          }),
        })
      );
      expect(mocks.navigate).toHaveBeenCalledWith('/blog');
    });
  });
});
