import React, { useState } from 'react';
import Card from '../common/Card';
import Button from '../common/Button';
import Dropdown from '../common/Dropdown';
import ImageUpload from '../common/ImageUpload';

/**
 * Shared Blog Editor Form Component
 * Reusable form for creating and editing blogs
 */
const BlogEditorForm = ({
  formData,
  loading,
  uploadingImage,
  error,
  categories,
  hasChanges,
  onInputChange,
  onImageUpload,
  onImageRemove,
  onSubmit,
  onCancel,
  isEdit = false,
  submitButtonText = 'Publish Blog'
}) => {
  const [localError, setLocalError] = useState(error);

  // Handle form submission
  const handleSubmit = async (e) => {
    e.preventDefault();
    setLocalError(null);

    const result = await onSubmit(false); // false means not a draft
    if (!result.success) {
      setLocalError(result.error);
    }
  };

  // Handle draft save
  const handleSaveDraft = async () => {
    setLocalError(null);

    const result = await onSubmit(true); // true means save as draft
    if (!result.success) {
      setLocalError(result.error);
    }
  };

  // Clear error when formData changes
  React.useEffect(() => {
    setLocalError(error);
  }, [error]);

  return (
    <div className="max-w-4xl mx-auto">
      <Card className="p-8">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-bold text-strong">
            {isEdit ? 'Edit Blog Post' : 'Create New Blog Post'}
          </h1>

          <div className="flex gap-3">
            <Button
              variant="ghost"
              onClick={onCancel}
              disabled={loading}
            >
              Cancel
            </Button>

            <Button
              variant="outline"
              onClick={handleSaveDraft}
              disabled={loading || !hasChanges}
            >
              {loading ? 'Saving...' : 'Save Draft'}
            </Button>

            <Button
              onClick={handleSubmit}
              disabled={loading}
              className="bg-interactive-brand-primary text-on-brand hover:bg-interactive-brand-primary-hover"
            >
              {loading ? 'Publishing...' : submitButtonText}
            </Button>
          </div>
        </div>

        {localError && (
          <div className="mb-6 p-4 bg-surface-danger border border-danger rounded-lg">
            <p className="text-danger text-sm">{localError}</p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Basic Information */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-secondary mb-2">
                Title *
              </label>
              <input
                type="text"
                name="title"
                value={formData.title}
                onChange={onInputChange}
                required
                maxLength={200}
                className="w-full px-4 py-3 border border-primary bg-surface-primary text-primary rounded-lg focus:ring-2 focus:ring-border-focus focus:border-transparent"
                placeholder="Enter blog title..."
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-secondary mb-2">
                Category *
              </label>
              <Dropdown
                name="category"
                value={formData.category}
                onChange={onInputChange}
                options={[
                  { value: '', label: 'Select category...' },
                  { value: 'general', label: 'General' },
                  { value: 'herb_profiles', label: 'Herb Profiles' },
                  { value: 'remedies', label: 'Remedies' },
                  { value: 'research', label: 'Research' },
                  { value: 'safety', label: 'Safety' },
                  { value: 'gardening', label: 'Gardening' },
                  { value: 'foraging', label: 'Foraging' },
                  { value: 'recipes', label: 'Recipes' },
                  { value: 'news', label: 'News' },
                  { value: 'interviews', label: 'Interviews' }
                ]}
                className="w-full"
              />
            </div>
          </div>

          {/* Excerpt */}
          <div>
            <label className="block text-sm font-medium text-secondary mb-2">
              Excerpt
            </label>
            <textarea
              name="excerpt"
              value={formData.excerpt}
              onChange={onInputChange}
              rows={3}
              maxLength={500}
              className="w-full px-4 py-3 border border-primary bg-surface-primary text-primary rounded-lg focus:ring-2 focus:ring-border-focus focus:border-transparent"
              placeholder="Brief summary of your blog post..."
            />
            <p className="text-xs text-tertiary mt-1">
              {formData.excerpt.length}/500 characters
            </p>
          </div>

          {/* Featured Image */}
          <div>
            <label className="block text-sm font-medium text-secondary mb-2">
              Featured Image
            </label>
            <ImageUpload
              onImageSelect={onImageUpload}
              onImageRemove={onImageRemove}
              currentImage={formData.featuredImage}
              uploading={uploadingImage}
              accept="image/*"
              className="w-full"
            />
          </div>

          {/* Tags */}
          <div>
            <label className="block text-sm font-medium text-secondary mb-2">
              Tags
            </label>
            <input
              type="text"
              name="tags"
              value={formData.tags}
              onChange={onInputChange}
              className="w-full px-4 py-3 border border-primary bg-surface-primary text-primary rounded-lg focus:ring-2 focus:ring-border-focus focus:border-transparent"
              placeholder="Enter tags separated by commas..."
            />
            <p className="text-xs text-tertiary mt-1">
              Separate tags with commas (e.g., herbal medicine, natural remedies, health)
            </p>
          </div>

          {/* Content */}
          <div>
            <label className="block text-sm font-medium text-secondary mb-2">
              Content *
            </label>
            <textarea
              name="content"
              value={formData.content}
              onChange={onInputChange}
              rows={15}
              required
              className="w-full px-4 py-3 border border-primary bg-surface-primary text-primary rounded-lg focus:ring-2 focus:ring-border-focus focus:border-transparent"
              placeholder="Write your blog content here..."
            />
          </div>

          {/* SEO Settings */}
          <div className="border-t border-primary pt-6">
            <h3 className="text-lg font-semibold text-strong mb-4">SEO Settings</h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-secondary mb-2">
                  SEO Title
                </label>
                <input
                  type="text"
                  name="seo.metaTitle"
                  value={formData.seo.metaTitle}
                  onChange={onInputChange}
                  maxLength={60}
                  className="w-full px-4 py-3 border border-primary bg-surface-primary text-primary rounded-lg focus:ring-2 focus:ring-border-focus focus:border-transparent"
                  placeholder="SEO title (max 60 chars)..."
                />
                <p className="text-xs text-tertiary mt-1">
                  {formData.seo.metaTitle.length}/60 characters
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-secondary mb-2">
                  SEO Description
                </label>
                <textarea
                  name="seo.metaDescription"
                  value={formData.seo.metaDescription}
                  onChange={onInputChange}
                  rows={3}
                  maxLength={160}
                  className="w-full px-4 py-3 border border-primary bg-surface-primary text-primary rounded-lg focus:ring-2 focus:ring-border-focus focus:border-transparent"
                  placeholder="SEO description (max 160 chars)..."
                />
                <p className="text-xs text-tertiary mt-1">
                  {formData.seo.metaDescription.length}/160 characters
                </p>
              </div>
            </div>
          </div>
        </form>
      </Card>
    </div>
  );
};

export default BlogEditorForm;
