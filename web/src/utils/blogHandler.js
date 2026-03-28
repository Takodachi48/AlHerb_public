import { imageService } from '../services/imageService';

const extractImageUrl = (response) => {
  if (!response) return null;
  return response?.data?.url || response?.url || null;
};

/**
 * Shared blog validation and image upload handler
 * Eliminates duplicate validation and image upload logic
 */
class BlogHandler {
  /**
   * Default blog form structure
   */
  static getDefaultFormData() {
    return {
      title: '',
      excerpt: '',
      content: '',
      category: 'general',
      tags: '',
      status: 'draft',
      featuredImage: {
        url: '',
        caption: '',
        alt: ''
      },
      seo: {
        metaTitle: '',
        metaDescription: '',
        keywords: ''
      }
    };
  }

  /**
   * Validate blog form data
   */
  static validateFormData(formData) {
    const errors = {};

    // Title validation
    if (!formData.title || formData.title.trim().length === 0) {
      errors.title = 'Title is required';
    } else if (formData.title.trim().length < 3) {
      errors.title = 'Title must be at least 3 characters';
    } else if (formData.title.trim().length > 200) {
      errors.title = 'Title must be less than 200 characters';
    }

    // Content validation
    if (!formData.content || formData.content.trim().length === 0) {
      errors.content = 'Content is required';
    } else if (formData.content.trim().length < 50) {
      errors.content = 'Content must be at least 50 characters';
    }

    // Excerpt validation
    if (formData.excerpt && formData.excerpt.trim().length > 500) {
      errors.excerpt = 'Excerpt must be less than 500 characters';
    }

    // Tags validation
    if (formData.tags) {
      const tags = formData.tags.split(',').map(tag => tag.trim()).filter(tag => tag.length > 0);
      if (tags.length > 10) {
        errors.tags = 'Maximum 10 tags allowed';
      }
    }

    // SEO validation
    if (formData.seo.metaTitle && formData.seo.metaTitle.length > 60) {
      errors.seoMetaTitle = 'SEO title must be less than 60 characters';
    }

    if (formData.seo.metaDescription && formData.seo.metaDescription.length > 160) {
      errors.seoMetaDescription = 'SEO description must be less than 160 characters';
    }

    return {
      isValid: Object.keys(errors).length === 0,
      errors
    };
  }

  /**
   * Handle image upload with loading state
   */
  static async handleImageUpload(file, setUploadingImage, setImageCallback) {
    if (!file) {
      return null;
    }

    try {
      setUploadingImage(true);
      const response = await imageService.uploadBlogImage(file, 'blog-handler-featured');
      const imageUrl = extractImageUrl(response);
      
      if (imageUrl) {
        setImageCallback({
          url: imageUrl,
          caption: response?.data?.caption || response?.caption || '',
          alt: response?.data?.alt || response?.alt || ''
        });
      } else {
        throw new Error(response?.message || 'Image upload failed');
      }
    } catch (error) {
      console.error('Image upload error:', error);
      throw error;
    } finally {
      setUploadingImage(false);
    }
  }

  /**
   * Prepare form data for submission
   */
  static prepareSubmissionData(formData) {
    const submissionData = {
      title: formData.title.trim(),
      excerpt: formData.excerpt.trim(),
      content: formData.content.trim(),
      category: formData.category,
      status: formData.status,
      featuredImage: formData.featuredImage.url ? {
        url: formData.featuredImage.url,
        caption: formData.featuredImage.caption,
        alt: formData.featuredImage.alt
      } : null,
      seo: {
        metaTitle: formData.seo.metaTitle.trim(),
        metaDescription: formData.seo.metaDescription.trim(),
        keywords: formData.seo.keywords.trim()
      }
    };

    // Parse tags
    if (formData.tags) {
      submissionData.tags = formData.tags
        .split(',')
        .map(tag => tag.trim())
        .filter(tag => tag.length > 0);
    }

    return submissionData;
  }

  /**
   * Handle form submission
   */
  static async submitForm(formData, isEdit = false, blogId = null) {
    try {
      const submissionData = this.prepareSubmissionData(formData);
      
      if (isEdit && blogId) {
        return await blogApi.updateBlog(blogId, submissionData);
      } else {
        return await blogApi.createBlog(submissionData);
      }
    } catch (error) {
      console.error('Blog submission error:', error);
      throw error;
    }
  }

  /**
   * Handle form state changes
   */
  static handleInputChange(e, formData, setFormData) {
    const { name, value } = e.target;
    
    if (name.includes('.')) {
      // Handle nested properties (featuredImage.url, seo.metaTitle, etc.)
      const [parent, child] = name.split('.');
      setFormData(prev => ({
        ...prev,
        [parent]: {
          ...prev[parent],
          [child]: value
        }
      }));
    } else {
      setFormData(prev => ({
        ...prev,
        [name]: value
      }));
    }
  }

  /**
   * Reset form to default state
   */
  static resetForm(setFormData) {
    setFormData(this.getDefaultFormData());
  }
}

export default BlogHandler;
