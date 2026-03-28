import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import BlogEditorForm from '../BlogEditorForm';

vi.mock('../../common/ImageUpload', () => ({
  default: ({ onImageSelect, onImageRemove }) => (
    <div>
      <button type="button" onClick={() => onImageSelect?.({ name: 'mock.png' })}>
        Mock Upload
      </button>
      <button type="button" onClick={() => onImageRemove?.()}>
        Mock Remove
      </button>
    </div>
  ),
}));

vi.mock('../../common/Dropdown', () => ({
  default: ({ name, value, onChange, options = [] }) => (
    <select
      aria-label="Category"
      name={name}
      value={value}
      onChange={(e) => onChange?.(e)}
    >
      {options.map((option) => (
        <option key={option.value || 'empty'} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  ),
}));

const buildProps = (overrides = {}) => ({
  formData: {
    title: 'Draft title',
    category: 'general',
    excerpt: 'Short excerpt',
    featuredImage: null,
    tags: 'tag1, tag2',
    content: 'Body content',
    seo: {
      metaTitle: '',
      metaDescription: '',
    },
  },
  loading: false,
  uploadingImage: false,
  error: null,
  categories: [],
  hasChanges: true,
  onInputChange: vi.fn(),
  onImageUpload: vi.fn(),
  onImageRemove: vi.fn(),
  onSubmit: vi.fn().mockResolvedValue({ success: true }),
  onCancel: vi.fn(),
  ...overrides,
});

describe('BlogEditorForm', () => {
  it('submits as publish flow when clicking publish button', async () => {
    const props = buildProps();
    render(<BlogEditorForm {...props} submitButtonText="Publish Blog" />);

    fireEvent.click(screen.getByRole('button', { name: 'Publish Blog' }));

    await waitFor(() => {
      expect(props.onSubmit).toHaveBeenCalledWith(false);
    });
  });

  it('disables Save Draft when there are no changes', () => {
    const props = buildProps({ hasChanges: false });
    render(<BlogEditorForm {...props} />);

    expect(screen.getByRole('button', { name: 'Save Draft' })).toBeDisabled();
  });

  it('shows inline error when saving draft fails', async () => {
    const props = buildProps({
      onSubmit: vi.fn().mockResolvedValue({
        success: false,
        error: 'Could not save draft',
      }),
    });
    render(<BlogEditorForm {...props} />);

    fireEvent.click(screen.getByRole('button', { name: 'Save Draft' }));

    await waitFor(() => {
      expect(props.onSubmit).toHaveBeenCalledWith(true);
      expect(screen.getByText('Could not save draft')).toBeInTheDocument();
    });
  });
});
