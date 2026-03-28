import { describe, it, expect, vi, beforeEach } from 'vitest';
import { blogService } from '../../../../shared/services/blogService';

describe('blogService', () => {
  let api;
  let service;

  beforeEach(() => {
    api = {
      get: vi.fn(),
      post: vi.fn(),
      put: vi.fn(),
      patch: vi.fn(),
      delete: vi.fn(),
    };
    service = blogService(api);
  });

  it('builds published blogs query with pagination and category', async () => {
    api.get.mockResolvedValue({ success: true });

    await service.getPublishedBlogs({ page: 2, limit: 5, category: 'safety' });

    expect(api.get).toHaveBeenCalledWith('/blogs?page=2&limit=5&category=safety');
  });

  it('uses default getUserBlogs params when none are provided', async () => {
    api.get.mockResolvedValue({ success: true });

    await service.getUserBlogs();

    expect(api.get).toHaveBeenCalledWith('/blogs/user/blogs?page=1&limit=10&status=all');
  });

  it('sends moderation payload correctly for approve/publish action', async () => {
    api.patch.mockResolvedValue({ success: true });

    await service.approveAndPublishBlog('blog-1', { publishAt: 'now' });

    expect(api.patch).toHaveBeenCalledWith('/blogs/blog-1/approve-publish', { publishAt: 'now' });
  });
});
