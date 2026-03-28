import React, { useState, useRef } from 'react';

const VALID_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
const MAX_BYTES = 8 * 1024 * 1024;

const UploadIcon = () => (
  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 5v14M5 12l7-7 7 7" />
  </svg>
);

const XIcon = () => (
  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="1.8">
    <path strokeLinecap="round" d="M6 18L18 6M6 6l12 12" />
  </svg>
);

const ImageUpload = ({
  currentImages = [],
  onImagesChange,
  maxImages = 5,
  uploading = false,
  className = '',
  buttonOnly = false,
}) => {
  const [drag, setDrag] = useState(false);
  const fileInputRef = useRef(null);
  const isSingleImageMode = maxImages === 1;
  const hasSingleImageInDropzone = !buttonOnly && isSingleImageMode && currentImages.length === 1;

  const handleFiles = (files) => {
    const valid = files.filter((f) => VALID_TYPES.includes(f.type));
    if (!valid.length) {
      alert('Please select JPEG, PNG, GIF, or WebP files.');
      return;
    }

    const oversized = valid.filter((f) => f.size > MAX_BYTES);
    if (oversized.length) {
      alert('Some files exceed 8 MB.');
      return;
    }

    const next = [...currentImages];
    for (const file of valid) {
      if (next.length >= maxImages) {
        alert(`Max ${maxImages} images.`);
        break;
      }
      next.push({ file, preview: URL.createObjectURL(file), name: file.name, size: file.size });
    }

    onImagesChange(next);
  };

  const remove = (i) => onImagesChange(currentImages.filter((_, idx) => idx !== i));

  return (
    <div className={`flex flex-col gap-4 ${className}`}>
      {/* Preview grid */}
      {currentImages.length > 0 && !hasSingleImageInDropzone && (
        <div>
          <span className="label block mb-2">Images ({currentImages.length}/{maxImages})</span>
          <div className="grid grid-cols-3 gap-2">
            {currentImages.map((img, i) => (
              <div key={i} className="relative group card" style={{ padding: 0, overflow: 'hidden' }}>
                <img
                  src={img.preview || img.url}
                  alt={img.name ?? `Image ${i + 1}`}
                  className="w-full h-24 object-cover"
                />
                <button
                  type="button"
                  onClick={() => remove(i)}
                  className="absolute top-1 right-1 w-5 h-5 flex items-center justify-center bg-interactive-danger text-on-danger opacity-0 group-hover:opacity-100 transition-opacity"
                  aria-label="Remove"
                >
                  <XIcon />
                </button>
                <div className="absolute bottom-0 left-0 right-0 px-1.5 py-1 upload-mono truncate" style={{ background: 'var(--surface-secondary)', opacity: 0.9 }}>
                  {img.name ?? `Image ${i + 1}`}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Upload control */}
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept="image/*"
        onChange={(e) => {
          handleFiles(Array.from(e.target.files));
          e.target.value = '';
        }}
        className="hidden"
        disabled={currentImages.length >= maxImages}
      />

      {buttonOnly ? (
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={currentImages.length >= maxImages || uploading}
          className="btn btn--neutral"
        >
          Choose Images
        </button>
      ) : (
        <div
          className={`upload-zone relative ${drag ? 'upload-zone--active' : ''}`}
          style={hasSingleImageInDropzone ? { padding: 0, minHeight: '100%' } : undefined}
          onDrop={(e) => {
            e.preventDefault();
            setDrag(false);
            handleFiles(Array.from(e.dataTransfer.files));
          }}
          onDragOver={(e) => {
            e.preventDefault();
            setDrag(true);
          }}
          onDragLeave={() => setDrag(false)}
          onClick={() => currentImages.length < maxImages && fileInputRef.current?.click()}
        >
          {hasSingleImageInDropzone ? (
            <>
              <img
                src={currentImages[0].preview || currentImages[0].url}
                alt={currentImages[0].name ?? 'Uploaded image'}
                className="w-full h-full object-cover"
              />
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  remove(0);
                }}
                className="absolute top-2 right-2 w-7 h-7 flex items-center justify-center bg-interactive-danger text-on-danger"
                aria-label="Remove"
              >
                <XIcon />
              </button>
            </>
          ) : (
            <div className="flex flex-col items-center gap-3">
              <span className="text-tertiary"><UploadIcon /></span>
              <p className="upload-mono">Drag and drop or click to select</p>
              <p className="upload-mono" style={{ color: 'var(--text-weak)' }}>JPEG, PNG, GIF, WEBP, max 8 MB</p>
            </div>
          )}
        </div>
      )}

      {uploading && (
        <div className="flex items-center gap-2 py-2">
          <span className="spinner" />
          <span className="upload-mono">Uploading...</span>
        </div>
      )}
    </div>
  );
};

export default ImageUpload;
