import { useState, useEffect, useCallback } from 'react';
import blogApi from '../services/blogService';
import { imageService } from '../services/imageService';

const extractImageUrl = (response) => {
  if (!response) return null;
  return response?.data?.url || response?.url || null;
};

/**
 * Custom hook for blog editor functionality
 * Provides shared state and handlers for blog creation/editing
 */
export const useBlogEditor = (initialBlog = null) => {
  const [loading, setLoading] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [error, setError] = useState(null);
  const [categories, setCategories] = useState([]);
  const [hasChanges, setHasChanges] = useState(false);

  const [formData, setFormData] = useState({
    title: initialBlog?.title || '',
    excerpt: initialBlog?.excerpt || '',
    content: initialBlog?.content || '',
    category: initialBlog?.category || '',
    tags: initialBlog?.tags || '',
    status: initialBlog?.status || 'draft',
    featuredImage: initialBlog?.featuredImage || {
      url: '',
      caption: '',
      alt: ''
    },
    seo: {
      metaTitle: initialBlog?.seo?.metaTitle || '',
      metaDescription: initialBlog?.seo?.metaDescription || '',
      keywords: initialBlog?.seo?.keywords || ''
    }
  });

  // Fetch categories on mount
  useEffect(() => {
    const fetchCategories = async () => {
      try {
        const response = await blogApi.getCategories();
        if (response.success) {
          setCategories(response.data);
        }
      } catch (err) {
        console.error('Failed to fetch categories:', err);
        setError('Failed to load categories');
      }
    };

    fetchCategories();
  }, []);

  // Track changes
  useEffect(() => {
    const hasFormChanges = JSON.stringify(formData) !== JSON.stringify(initialBlog || {});
    setHasChanges(hasFormChanges);
  }, [formData, initialBlog]);

  // Input change handler
  const handleInputChange = useCallback((e) => {
    const { name, value } = e.target;
    
    setFormData(prev => {
      const newData = { ...prev };
      
      // Handle nested paths (e.g., seo.metaTitle)
      if (name.includes('.')) {
        const [parent, child] = name.split('.');
        newData[parent] = {
          ...newData[parent],
          [child]: value
        };
      } else {
        newData[name] = value;
      }
      
      return newData;
    });
  }, []);

  // Image upload handler
  const handleImageUpload = useCallback(async (file) => {
    if (!file) return;

    try {
      setUploadingImage(true);
      setError(null);
      
      const response = await imageService.uploadBlogImage(file, 'blog-editor-featured');
      const imageUrl = extractImageUrl(response);
      if (!imageUrl) {
        throw new Error('No image URL returned from upload');
      }
      
      setFormData(prev => ({
        ...prev,
        featuredImage: {
          url: imageUrl,
          caption: response?.data?.caption || response?.caption || '',
          alt: response?.data?.alt || response?.alt || ''
        }
      }));
    } catch (err) {
      console.error('Image upload failed:', err);
      setError('Failed to upload image: ' + err.message);
    } finally {
      setUploadingImage(false);
    }
  }, []);

  // Image remove handler
  const handleImageRemove = useCallback(() => {
    setFormData(prev => ({
      ...prev,
      featuredImage: {
        url: '',
        caption: '',
        alt: ''
      }
    }));
  }, []);

  // Form validation
  const validateForm = useCallback(() => {
    const errors = {};
    
    if (!formData.title.trim()) {
      errors.title = 'Title is required';
    }
    
    if (formData.title.length > 200) {
      errors.title = 'Title must be less than 200 characters';
    }
    
    if (!formData.content.trim()) {
      errors.content = 'Content is required';
    }
    
    if (!formData.category) {
      errors.category = 'Category is required';
    }
    
    if (formData.excerpt.length > 500) {
      errors.excerpt = 'Excerpt must be less than 500 characters';
    }
    
    if (formData.seo.metaTitle.length > 60) {
      errors.seoMetaTitle = 'SEO title must be less than 60 characters';
    }
    
    if (formData.seo.metaDescription.length > 160) {
      errors.seoMetaDescription = 'SEO description must be less than 160 characters';
    }
    
    return Object.keys(errors).length === 0 ? null : errors;
  }, [formData]);

  // Form submission
  const handleSubmit = useCallback(async (isDraft = false) => {
    try {
      const validationErrors = validateForm();
      if (validationErrors) {
        setError('Please fix validation errors before submitting');
        return;
      }

      setLoading(true);
      setError(null);

      const submissionData = {
        ...formData,
        status: isDraft ? 'draft' : 'published',
        tags: formData.tags.split(',').map(tag => tag.trim()).filter(tag => tag)
      };

      let response;
      if (initialBlog && initialBlog._id) {
        response = await blogApi.updateBlog(initialBlog._id, submissionData);
      } else {
        response = await blogApi.createBlog(submissionData);
      }

      if (response.success) {
        // Reset form or navigate based on context
        if (!initialBlog) {
          setFormData({
            title: '',
            excerpt: '',
            content: '',
            category: '',
            tags: '',
            status: 'draft',
            featuredImage: { url: '', caption: '', alt: '' },
            seo: { metaTitle: '', metaDescription: '', keywords: '' }
          });
        }
        return { success: true, data: response.data };
      } else {
        setError(response.message || 'Failed to save blog');
        return { success: false, error: response.message };
      }
    } catch (err) {
      console.error('Blog submission failed:', err);
      setError('Failed to save blog: ' + err.message);
      return { success: false, error: err.message };
    } finally {
      setLoading(false);
    }
  }, [formData, validateForm, initialBlog]);

  // Reset form
  const resetForm = useCallback(() => {
    setFormData({
      title: '',
      excerpt: '',
      content: '',
      category: '',
      tags: '',
      status: 'draft',
      featuredImage: { url: '', caption: '', alt: '' },
      seo: { metaTitle: '', metaDescription: '', keywords: '' }
    });
    setError(null);
    setHasChanges(false);
  }, []);

  // Load blog data for editing
  const loadBlogData = useCallback(async (blogId) => {
    try {
      setLoading(true);
      const response = await blogApi.getBlogById(blogId);
      
      if (response.success) {
        setFormData({
          ...response.data,
          tags: response.data.tags ? response.data.tags.join(', ') : ''
        });
      } else {
        setError('Failed to load blog data');
      }
    } catch (err) {
      console.error('Failed to load blog:', err);
      setError('Failed to load blog: ' + err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  return {
    // State
    formData,
    loading,
    uploadingImage,
    error,
    categories,
    hasChanges,
    
    // Handlers
    handleInputChange,
    handleImageUpload,
    handleImageRemove,
    handleSubmit,
    resetForm,
    loadBlogData,
    validateForm
  };
};
