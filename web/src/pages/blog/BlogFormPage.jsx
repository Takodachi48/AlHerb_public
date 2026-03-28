import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import Button from '../../components/common/Button';
import Input from '../../components/common/Input';
import Dropdown from '../../components/common/Dropdown';
import ImageUpload from '../../components/common/ImageUpload';
import blogApi from '../../services/blogService';
import { imageService } from '../../services/imageService';
import { useAuth } from '../../hooks/useAuth';

const FORM_STYLES = `
  .bf-root { min-height: 100%; height: auto; overflow: visible; background: var(--base-tertiary, #101315); }
  .bf-mobile-controls { display: none; }
  .bf-body { max-width: 1120px; margin: 0 auto; height: auto; padding: 24px 16px 56px; }
  .bf-grid { display: grid; grid-template-columns: minmax(0,1fr) 280px; gap: 18px; align-items: start; }
  .bf-main { display: flex; flex-direction: column; gap: 14px; min-width: 0; height: auto; overflow: visible; padding-right: 0; padding-bottom: 0; }
  .bf-sidebar {
    display: flex;
    flex-direction: column;
    gap: 14px;
    position: sticky;
    top: 16px;
    width: 100%;
    max-height: calc(100dvh - 6rem);
    overflow-y: auto;
    align-self: start;
  }
  .bf-card { background: var(--surface-primary, #1a1a1a); border: 1px solid var(--border-secondary, rgba(255,255,255,.1)); border-radius: 10px; padding: 16px; }
  .bf-card-heading { margin-bottom: 14px; display: flex; align-items: center; justify-content: space-between; gap: 8px; }
  .eyebrow { display: flex; align-items: center; gap: 10px; }
  .eyebrow-bar { width: 3px; height: 14px; border-radius: 999px; background: var(--border-brand, #7fa87f); flex-shrink: 0; }
  .eyebrow-text { font-family: 'DM Sans', sans-serif; font-size: 10px; font-weight: 600; letter-spacing: .22em; text-transform: uppercase; color: var(--text-brand, #8fbf8f); }
  .bf-optional { font-family: 'DM Sans', sans-serif; font-size: 10px; color: var(--text-tertiary, #7a7670); letter-spacing: .12em; text-transform: uppercase; }
  .bf-label-row { display: flex; align-items: baseline; justify-content: space-between; margin-bottom: 6px; }
  .bf-label { font-family: 'DM Sans', sans-serif; font-size: 12px; color: var(--text-primary, #f0ede8); }
  .bf-required { color: var(--icon-danger, #e66); margin-left: 4px; }
  .bf-hint { font-family: 'DM Sans', sans-serif; font-size: 11px; color: var(--text-tertiary, #7a7670); }
  .bf-input, .bf-select, .bf-textarea { width: 100%; border: 1px solid var(--border-secondary, rgba(255,255,255,.1)); background: var(--surface-secondary, #222); color: var(--text-primary, #f0ede8); border-radius: 7px; padding: 10px 12px; font-family: 'DM Sans', sans-serif; font-size: 13px; outline: none; }
  .bf-textarea { resize: vertical; min-height: 96px; }
  .bf-input:focus, .bf-select:focus, .bf-textarea:focus { border-color: var(--border-brand, #7fa87f); }
  .bf-grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
  .bf-editor-wrap { border: 1px solid var(--border-secondary, rgba(255,255,255,.1)); border-radius: 8px; overflow: hidden; background: var(--surface-secondary, #222); }
  .bf-toolbar { border-bottom: 1px solid var(--border-weak, rgba(255,255,255,.06)); padding: 8px 10px; display: flex; gap: 6px; flex-wrap: wrap; }
  .bf-tool-btn { width: 28px; height: 24px; border: 1px solid var(--border-secondary, rgba(255,255,255,.1)); background: transparent; color: var(--text-secondary, #b8b4ac); border-radius: 4px; font-family: 'DM Sans', sans-serif; font-size: 11px; }
  .bf-dropzone { border: 1px dashed var(--border-secondary, rgba(255,255,255,.1)); border-radius: 8px; min-height: 130px; display: grid; place-items: center; text-align: center; padding: 16px; cursor: pointer; background: var(--surface-secondary, #222); }
  .bf-dropzone:hover { border-color: var(--border-brand, #7fa87f); }
  .bf-dz-title { font-family: 'DM Sans', sans-serif; font-size: 13px; color: var(--text-primary, #f0ede8); margin-top: 8px; }
  .bf-dz-sub { font-family: 'DM Sans', sans-serif; font-size: 11px; color: var(--text-tertiary, #7a7670); margin-top: 4px; }
  .bf-preview { border-radius: 8px; overflow: hidden; border: 1px solid var(--border-weak, rgba(255,255,255,.06)); margin-top: 10px; position: relative; }
  .bf-preview img { width: 100%; height: 220px; object-fit: cover; display: block; }
  .bf-remove { position: absolute; top: 8px; right: 8px; width: 28px; height: 28px; border-radius: 6px; border: 1px solid rgba(200,70,70,.4); background: rgba(20,20,20,.85); color: rgba(220,120,120,.95); cursor: pointer; }
  .bf-status-desc { margin-top: 8px; font-family: 'DM Sans', sans-serif; font-size: 11px; color: var(--text-tertiary, #7a7670); line-height: 1.6; }
  .bf-pub-btns { margin-top: 12px; display: flex; flex-direction: column; gap: 8px; }
  .bf-btn-primary, .bf-btn-ghost { width: 100%; padding: 10px 12px; border-radius: 7px; font-family: 'DM Sans', sans-serif; font-size: 11px; letter-spacing: .12em; text-transform: uppercase; font-weight: 600; cursor: pointer; }
  .bf-btn-primary { border: 1px solid var(--border-brand, #7fa87f); background: var(--interactive-brand-primary, #7fa87f); color: var(--text-on-brand, #0d160d); }
  .bf-btn-ghost { border: 1px solid var(--border-secondary, rgba(255,255,255,.1)); background: transparent; color: var(--text-secondary, #b8b4ac); }
  .bf-error { border: 1px solid rgba(220,90,90,.35); background: rgba(220,90,90,.08); color: var(--text-primary, #f0ede8); border-radius: 8px; padding: 10px 12px; font-family: 'DM Sans', sans-serif; font-size: 12px; }
  @media (max-width: 980px) {
    .bf-root { height: auto; min-height: 0; overflow: visible; }
    .bf-body { height: auto; padding: 16px; }
    .bf-grid { display: block; height: auto; }
    .bf-main { height: auto; overflow: visible; padding-right: 0; padding-bottom: 0; }
    .bf-sidebar { display: none; position: static; max-height: none; }
    .bf-grid-2 { grid-template-columns: 1fr; }
    .bf-mobile-controls {
      display: grid;
      grid-template-columns: minmax(0, 1fr) auto auto;
      gap: 8px;
      align-items: center;
      padding: 10px 14px;
      background: var(--base-primary, #0f0f0f);
      border-bottom: 1px solid var(--border-weak, rgba(255,255,255,.06));
      position: sticky;
      top: 0;
      z-index: 15;
    }
    .bf-mobile-status { margin: 0; min-width: 0; }
    .bf-mobile-btn { padding: 8px 10px; border-radius: 6px; font-family: 'DM Sans', sans-serif; font-size: 10px; letter-spacing: .1em; text-transform: uppercase; font-weight: 600; }
    .bf-mobile-publish { border: 1px solid var(--border-brand, #7fa87f); background: var(--interactive-brand-primary, #7fa87f); color: var(--text-on-brand, #0d160d); }
    .bf-mobile-cancel { border: 1px solid var(--border-secondary, rgba(255,255,255,.1)); background: transparent; color: var(--text-secondary, #b8b4ac); }
  }
`;

const extractImageUrl = (response) => {
  if (!response) return null;
  return response?.data?.url || response?.url || null;
};

const formatStatusLabel = (status) => {
  const value = String(status || 'draft').trim().toLowerCase();
  if (value === 'review') return 'In Review';
  if (value === 'published') return 'Published';
  if (value === 'archived') return 'Archived';
  return 'Draft';
};

const BlogFormPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const isEdit = !!id;
  const canDirectPublish = user?.role === 'admin' || user?.role === 'moderator';

  const [loading, setLoading] = useState(isEdit);
  const [submitting, setSubmitting] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [error, setError] = useState(null);
  const [categories, setCategories] = useState([]);
  const [blog, setBlog] = useState(null);

  const [formData, setFormData] = useState({
    title: '',
    excerpt: '',
    content: '',
    category: '',
    tags: '',
    status: 'draft',
    featuredImage: { url: '', caption: '', alt: '' },
    seo: { metaTitle: '', metaDescription: '', keywords: '' },
  });
  const [featuredImages, setFeaturedImages] = useState([]);

  useEffect(() => {
    blogApi.getCategories()
      .then((r) => { if (r.success) setCategories(r.data); })
      .catch((err) => console.error('Failed to fetch categories:', err));
  }, []);

  useEffect(() => {
    if (!isEdit) return;
    const fetchBlog = async () => {
      try {
        setLoading(true);
        const response = await blogApi.getBlogById(id);
        if (response._id) {
          setBlog(response);
          setFormData({
            title: response.title || '',
            excerpt: response.excerpt || '',
            content: response.content || '',
            category: response.category || '',
            tags: response.tags ? response.tags.join(', ') : '',
            status: response.status === 'published' ? 'draft' : (response.status || 'draft'),
            featuredImage: {
              url: response.featuredImage?.url || '',
              caption: response.featuredImage?.caption || '',
              alt: response.featuredImage?.alt || '',
            },
            seo: {
              metaTitle: response.seo?.metaTitle || '',
              metaDescription: response.seo?.metaDescription || '',
              keywords: response.seo?.keywords ? response.seo.keywords.join(', ') : '',
            },
          });
        } else {
          setError('Blog not found');
        }
      } catch (err) {
        setError(err.message || 'Failed to fetch blog');
      } finally {
        setLoading(false);
      }
    };
    fetchBlog();
  }, [id, isEdit, canDirectPublish]);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    if (name.includes('.')) {
      const [parent, child] = name.split('.');
      setFormData((prev) => ({ ...prev, [parent]: { ...prev[parent], [child]: value } }));
    } else {
      setFormData((prev) => ({ ...prev, [name]: value }));
    }
  };

  const handleDropdownChange = (name, value) => {
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleFeaturedImagesChange = async (nextImages) => {
    if (!nextImages.length) {
      setFeaturedImages([]);
      setFormData((prev) => ({ ...prev, featuredImage: { url: '', caption: '', alt: '' } }));
      return;
    }

    const [next] = nextImages;
    if (!next?.file) {
      setFeaturedImages(nextImages);
      return;
    }

    if (uploadingImage) return;
    if (next.file.size > 8 * 1024 * 1024) { setError('Image size must be less than 8MB'); return; }
    if (!['image/jpeg', 'image/jpg', 'image/png', 'image/webp'].includes(next.file.type)) {
      setError('Only JPEG, PNG, and WebP images are allowed'); return;
    }

    setFeaturedImages(nextImages);
    setUploadingImage(true);
    setError(null);
    try {
      const response = await imageService.uploadBlogImage(next.file, 'blog-featured');
      const url = extractImageUrl(response);
      if (url) {
        setFormData((prev) => ({ ...prev, featuredImage: { ...prev.featuredImage, url } }));
        setFeaturedImages([{ url, name: next.name || 'Featured image' }]);
      } else {
        setError(response?.message || 'Failed to upload image');
      }
    } catch (err) {
      setError(err.message || 'Failed to upload image');
    } finally {
      setUploadingImage(false);
    }
  };

  useEffect(() => {
    setFeaturedImages((prev) => {
      if (formData.featuredImage.url) {
        if (prev.length === 1 && prev[0].url === formData.featuredImage.url) return prev;
        return [{ url: formData.featuredImage.url, name: formData.featuredImage.alt || 'Featured image' }];
      }
      return prev.length ? [] : prev;
    });
  }, [formData.featuredImage.url, formData.featuredImage.alt]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const title = formData.title.trim();
      const excerpt = formData.excerpt.trim();
      const content = formData.content.trim();
      const category = String(formData.category || '').trim();

      if (!title) throw new Error('Title is required');
      if (title.length < 3 || title.length > 200) throw new Error('Title must be between 3 and 200 characters');
      if (!excerpt) throw new Error('Excerpt is required');
      if (excerpt.length < 10 || excerpt.length > 300) throw new Error('Excerpt must be between 10 and 300 characters');
      if (!content || content.length < 10) throw new Error('Content must be at least 10 characters');
      if (!category) throw new Error('Category is required');

      const blogData = {
        title,
        excerpt,
        content,
        category,
        tags: formData.tags.split(',').map((t) => t.trim()).filter(Boolean),
        status: canDirectPublish ? formData.status : (formData.status === 'published' ? 'review' : formData.status),
        seo: {
          ...formData.seo,
          keywords: formData.seo.keywords.split(',').map((k) => k.trim()).filter(Boolean),
        },
      };

      if (formData.featuredImage.url) {
        blogData.featuredImage = {
          url: formData.featuredImage.url,
          caption: formData.featuredImage.caption,
          alt: formData.featuredImage.alt,
        };
      }

      const editingPublished = isEdit && blog?.status === 'published';
      let response;
      if (editingPublished) {
        // Preserve live published post and create a new draft revision.
        const revisionPayload = { ...blogData, status: 'draft', revisionOf: id };
        response = await blogApi.createBlog(revisionPayload);

        if (formData.status === 'review') {
          const createdId = response?._id || response?.id || response?.data?._id;
          if (createdId) {
            await blogApi.requestBlogApproval(createdId);
          }
        }
      } else if (isEdit) {
        response = await blogApi.updateBlog(id, blogData);
      } else {
        response = await blogApi.createBlog(blogData);
      }

      if (response._id || response.title) {
        navigate(isEdit ? '/blog/my-blogs' : '/blog');
      } else {
        setError(`Failed to ${isEdit ? 'update' : 'create'} blog`);
      }
    } catch (err) {
      setError(err.message || `Failed to ${isEdit ? 'update' : 'create'} blog`);
    } finally {
      setSubmitting(false);
    }
  };

  if (error && !blog && isEdit) {
    return (
      <div className="bf-root flex items-center justify-center px-4">
        <style>{FORM_STYLES}</style>
        <div className="bf-card max-w-md w-full text-center">
          <h1 className="text-lg font-bold text-primary mb-2">Error Loading Blog</h1>
          <p className="text-secondary text-sm mb-6">{error}</p>
          <Button
            type="button"
            variant="primary"
            onClick={() => navigate('/blog/my-blogs')}
            className="bf-btn-primary"
          >
            Back to My Blogs
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="bf-root">
      <style>{FORM_STYLES}</style>
      <div className="bf-mobile-controls">
        <div className="bf-select bf-mobile-status" aria-live="polite">{formatStatusLabel(formData.status)}</div>
        <Button
          type="submit"
          form="blog-form"
          disabled={submitting || uploadingImage}
          variant="primary"
          className="bf-mobile-btn bf-mobile-publish"
        >
          Save
        </Button>
        <Button
          type="button"
          variant="ghost"
          className="bf-mobile-btn bf-mobile-cancel"
          onClick={() => navigate(isEdit ? '/blog/my-blogs' : '/blog')}
        >
          Cancel
        </Button>
      </div>

      <div className="bf-body">
        {error && <div className="bf-error">{error}</div>}

        <form id="blog-form" onSubmit={handleSubmit} className="bf-grid" noValidate>
          <div className="bf-main">
            <div className="bf-card">
              <div className="bf-card-heading">
                <div className="eyebrow"><div className="eyebrow-bar" /><span className="eyebrow-text">Core Content</span></div>
              </div>

              <div className="bf-label-row">
                <label className="bf-label">Title<span className="bf-required">*</span></label>
                <span className="bf-hint">3-200 chars</span>
              </div>
              <Input
                id="title"
                type="text"
                name="title"
                value={formData.title}
                onChange={handleInputChange}
                className="bf-input"
                placeholder="Enter an engaging title for your blog post"
              />

              <div className="bf-label-row mt-3">
                <label className="bf-label">Excerpt<span className="bf-required">*</span></label>
                <span className="bf-hint">{formData.excerpt.length}/300</span>
              </div>
              <Input
                multiline
                name="excerpt"
                value={formData.excerpt}
                onChange={handleInputChange}
                rows={3}
                maxLength={300}
                className="bf-textarea"
                placeholder="Write a compelling summary that will appear in blog listings"
              />

              <div className="bf-grid-2 mt-3">
                <div>
                  <div className="bf-label-row"><label className="bf-label">Category<span className="bf-required">*</span></label></div>
                  <Dropdown
                    value={formData.category}
                    onChange={(value) => handleDropdownChange('category', value)}
                    options={[
                      { value: '', label: 'Select a category' },
                      ...categories.map((cat) => ({
                        value: cat,
                        label: cat.replace('_', ' ').replace(/\b\w/g, (l) => l.toUpperCase()),
                      })),
                    ]}
                    size="sm"
                    customClasses={{ input: 'bf-select' }}
                  />
                </div>
                <div>
                  <div className="bf-label-row"><label className="bf-label">Tags</label></div>
                  <Input
                    type="text"
                    name="tags"
                    value={formData.tags}
                    onChange={handleInputChange}
                    className="bf-input"
                    placeholder="herbs, medicine, wellness"
                  />
                  <p className="bf-hint mt-1">Separate with commas</p>
                </div>
              </div>
            </div>

            <div className="bf-card">
              <div className="bf-card-heading">
                <div className="eyebrow"><div className="eyebrow-bar" /><span className="eyebrow-text">Content</span></div>
              </div>
              <div className="bf-editor-wrap">
                <div className="bf-toolbar">
                  <Button type="button" variant="ghost" className="bf-tool-btn">B</Button>
                  <Button type="button" variant="ghost" className="bf-tool-btn">I</Button>
                  <Button type="button" variant="ghost" className="bf-tool-btn">H2</Button>
                  <Button type="button" variant="ghost" className="bf-tool-btn">H3</Button>
                </div>
                <Input
                  multiline
                  name="content"
                  value={formData.content}
                  onChange={handleInputChange}
                  rows={16}
                  className="bf-textarea"
                  style={{ border: 'none', borderRadius: 0 }}
                  placeholder="Write your blog content here..."
                />
              </div>
            </div>

            <div className="bf-card">
              <div className="bf-card-heading">
                <div className="eyebrow"><div className="eyebrow-bar" /><span className="eyebrow-text">Featured Image</span></div>
              </div>
              <ImageUpload
                currentImages={featuredImages}
                onImagesChange={handleFeaturedImagesChange}
                maxImages={1}
                uploading={uploadingImage}
              />

              {(formData.featuredImage.url || featuredImages.length > 0) && (
                <div className="bf-grid-2 mt-3">
                  <Input
                    type="text"
                    name="featuredImage.caption"
                    value={formData.featuredImage.caption}
                    onChange={handleInputChange}
                    className="bf-input"
                    placeholder="Caption (optional)"
                  />
                  <Input
                    type="text"
                    name="featuredImage.alt"
                    value={formData.featuredImage.alt}
                    onChange={handleInputChange}
                    className="bf-input"
                    placeholder="Alt text for accessibility"
                  />
                </div>
              )}
            </div>

            <div className="bf-card">
              <div className="bf-card-heading">
                <div className="eyebrow"><div className="eyebrow-bar" /><span className="eyebrow-text">SEO Settings</span></div>
                <span className="bf-optional">Optional</span>
              </div>

              <div className="bf-label-row">
                <label className="bf-label">Meta Title</label>
                <span className="bf-hint">{formData.seo.metaTitle.length}/60</span>
              </div>
              <Input
                type="text"
                name="seo.metaTitle"
                value={formData.seo.metaTitle}
                onChange={handleInputChange}
                maxLength={60}
                className="bf-input"
                placeholder="Custom title for search engines"
              />

              <div className="bf-label-row mt-3">
                <label className="bf-label">Meta Description</label>
                <span className="bf-hint">{formData.seo.metaDescription.length}/160</span>
              </div>
              <Input
                multiline
                name="seo.metaDescription"
                value={formData.seo.metaDescription}
                onChange={handleInputChange}
                rows={2}
                maxLength={160}
                className="bf-textarea"
                placeholder="Brief description for search results"
              />

              <div className="bf-label-row mt-3"><label className="bf-label">Keywords</label></div>
              <Input
                type="text"
                name="seo.keywords"
                value={formData.seo.keywords}
                onChange={handleInputChange}
                className="bf-input"
                placeholder="herbal medicine, natural remedies, wellness"
              />
            </div>
          </div>

          <aside className="bf-sidebar">
            <div className="bf-card">
              <div className="eyebrow"><div className="eyebrow-bar" /><span className="eyebrow-text">Publish</span></div>
              <div className="bf-label-row mt-3"><label className="bf-label">Status</label></div>
              <div className="bf-select" aria-live="polite">{formatStatusLabel(formData.status)}</div>
              <p className="bf-status-desc">
                {isEdit && blog?.status === 'published'
                  ? 'Editing a published post creates a new draft revision. The live version remains unchanged until approval.'
                  : 'Save as draft to continue editing, or request approval when ready for review.'}
              </p>
              <div className="bf-pub-btns">
                <Button type="submit" variant="primary" disabled={submitting || uploadingImage} className="bf-btn-primary">
                  {submitting
                    ? (isEdit ? 'Saving...' : 'Creating...')
                    : (isEdit && blog?.status === 'published' ? 'Save Revision Draft' : (isEdit ? 'Update Post' : 'Publish Post'))}
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  className="bf-btn-ghost"
                  onClick={() => navigate(isEdit ? '/blog/my-blogs' : '/blog')}
                >
                  Cancel
                </Button>
              </div>
            </div>
          </aside>
        </form>
      </div>
    </div>
  );
};

export default BlogFormPage;
