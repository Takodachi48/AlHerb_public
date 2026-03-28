/**
 * Blog API service
 * Handles all blog-related API calls
 */

export const blogService = (api) => ({
  // Get published blogs with pagination and filtering
  getPublishedBlogs: async (params = {}) => {
    const { page = 1, limit = 10, category } = params;
    const queryParams = new URLSearchParams({
      page: page.toString(),
      limit: limit.toString(),
    });
    
    if (category) {
      queryParams.append('category', category);
    }

    return api.get(`/blogs?${queryParams.toString()}`);
  },

  // Get blog by slug
  getBlogBySlug: async (slug) => {
    return api.get(`/blogs/slug/${slug}`);
  },

  // Get blog by ID
  getBlogById: async (id) => {
    return api.get(`/blogs/${id}`);
  },

  // Create new blog
  createBlog: async (blogData) => {
    return api.post('/blogs', blogData);
  },

  // Update blog
  updateBlog: async (id, blogData) => {
    return api.put(`/blogs/${id}`, blogData);
  },

  // Request approval for publishing
  requestBlogApproval: async (id) => {
    return api.patch(`/blogs/${id}/request-approval`);
  },

  // Admin/moderator: approve and publish
  approveAndPublishBlog: async (id, payload = {}) => {
    return api.patch(`/blogs/${id}/approve-publish`, payload);
  },

  // Delete blog
  deleteBlog: async (id) => {
    return api.delete(`/blogs/${id}`);
  },

  // Get user's blogs
  getUserBlogs: async (params = {}) => {
    const { page = 1, limit = 10, status = 'all' } = params;
    const queryParams = new URLSearchParams({
      page: page.toString(),
      limit: limit.toString(),
      status,
    });

    return api.get(`/blogs/user/blogs?${queryParams.toString()}`);
  },

  // Admin: get all blogs with filters
  getAdminBlogs: async (params = {}) => {
    const { page = 1, limit = 10, status = 'all', search = '' } = params;
    const queryParams = new URLSearchParams({
      page: page.toString(),
      limit: limit.toString(),
      status,
    });

    if (search?.trim()) {
      queryParams.append('search', search.trim());
    }

    return api.get(`/blogs/admin/list?${queryParams.toString()}`);
  },

  // Admin/moderator: moderate blog status
  moderateBlog: async (id, status, payload = {}) => {
    return api.patch(`/blogs/${id}/moderate`, { status, ...payload });
  },

  updateBlogStatus: async (id, status) => {
    return api.patch(`/blogs/${id}/status`, { status });
  },

  setBlogFeatured: async (id, featured) => {
    return api.patch(`/blogs/${id}/featured`, { featured: Boolean(featured) });
  },

  // Search blogs
  searchBlogs: async (query) => {
    return api.get('/blogs/search', { params: { q: query } });
  },

  // Blog categories
  getCategories: async () => {
    return api.get('/blogs/categories');
  },

  getTrendingBlogs: async (params = {}) => {
    const { limit = 10 } = params;
    return api.get('/blogs/trending', { params: { limit } });
  },

  getFeaturedBlogs: async (params = {}) => {
    const { limit = 10 } = params;
    return api.get('/blogs/featured', { params: { limit } });
  },

  getBlogMetrics: async (blogId) => {
    return api.get(`/blogs/${blogId}/metrics`);
  },

  // Comments
  getCommentsByBlogId: async (blogId, params = {}) => {
    return api.get(`/comments/blog/${blogId}`, { params });
  },

  getCommentReplies: async (commentId, params = {}) => {
    return api.get(`/comments/${commentId}/replies`, { params });
  },

  toggleBlogLike: async (blogId) => {
    return api.post(`/blogs/${blogId}/like`);
  },

  toggleBlogBookmark: async (blogId) => {
    return api.post(`/blogs/${blogId}/bookmark`);
  },

  getSavedBlogs: async (params = {}) => {
    const { page = 1, limit = 10 } = params;
    return api.get('/blogs/saved', { params: { page, limit } });
  },

  createComment: async (payload) => {
    return api.post('/comments', payload);
  },

  updateComment: async (commentId, payload) => {
    return api.put(`/comments/${commentId}`, payload);
  },

  deleteComment: async (commentId) => {
    return api.delete(`/comments/${commentId}`);
  },

  toggleCommentLike: async (commentId) => {
    return api.post(`/comments/${commentId}/like`);
  },
});

export default blogService;
