import React, { useRef } from 'react';

const MAX_BYTES   = 8 * 1024 * 1024;
const VALID_TYPES = ['image/jpeg','image/jpg','image/png','image/gif','image/webp'];

const XIcon = () => (
  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
    <path strokeLinecap="round" d="M6 18L18 6M6 6l12 12"/>
  </svg>
);

const ensurePrimary = (imgs) => {
  if (!imgs.length) return imgs;
  return imgs.some(i => i.isPrimary) ? imgs : imgs.map((i, idx) => ({ ...i, isPrimary: idx === 0 }));
};

const MultiImageUploadPrimary = ({
  currentImages = [],
  onImagesChange,
  maxImages = 6,
  uploading = false,
  className = '',
}) => {
  const fileRef = useRef(null);

  const handleFiles = (files) => {
    const valid = files.filter(f => VALID_TYPES.includes(f.type));
    if (!valid.length) { alert('Valid types: JPEG, PNG, GIF, WebP.'); return; }
    if (valid.some(f => f.size > MAX_BYTES)) { alert('Max 8 MB per file.'); return; }

    const slots = Math.max(0, maxImages - currentImages.length);
    if (!slots) { alert(`Max ${maxImages} images.`); return; }

    const toAdd  = valid.slice(0, slots);
    const noPrimary = !currentImages.some(i => i.isPrimary);
    const additions = toAdd.map((file, i) => ({
      file, preview: URL.createObjectURL(file),
      name: file.name, size: file.size,
      isPrimary: noPrimary && i === 0,
    }));
    onImagesChange(ensurePrimary([...currentImages, ...additions]));
  };

  const remove    = (i) => onImagesChange(ensurePrimary(currentImages.filter((_, idx) => idx !== i)));
  const setPrimary= (i) => onImagesChange(currentImages.map((img, idx) => ({ ...img, isPrimary: idx === i })));

  return (
    <div className={`flex flex-col gap-4 ${className}`}>
      <div className="flex items-center justify-between">
        <span className="label">Images ({currentImages.length}/{maxImages})</span>
        <button type="button" onClick={() => fileRef.current?.click()} disabled={uploading || currentImages.length >= maxImages}
          className="btn btn--neutral btn--sm">
          Add Images
        </button>
      </div>

      <input ref={fileRef} type="file" multiple accept="image/*" className="hidden"
        disabled={uploading || currentImages.length >= maxImages}
        onChange={e => { handleFiles(Array.from(e.target.files)); e.target.value=''; }} />

      <p className="upload-mono" style={{ padding: '8px 10px', border: '1px dashed var(--border-primary)' }}>
        Click an image to set as primary · primary image is used as default display
      </p>

      {currentImages.length > 0 && (
        <div className="grid grid-cols-3 gap-2">
          {currentImages.map((img, i) => (
            <div
              key={`${img.url ?? img.preview ?? img.name ?? 'img'}-${i}`}
              className="relative group card cursor-pointer"
              style={{
                padding: 0, overflow: 'hidden',
                borderLeftColor: img.isPrimary ? 'var(--border-brand)' : undefined,
                boxShadow: img.isPrimary ? '0 0 0 1.5px var(--border-focus)' : undefined,
              }}
              onClick={() => setPrimary(i)}
              title={img.isPrimary ? 'Primary image' : 'Set as primary'}
            >
              <img src={img.preview ?? img.url} alt={img.name ?? `Image ${i+1}`} className="w-full h-24 object-cover" />
              {img.isPrimary && (
                <div className="absolute top-1 left-1 upload-mono px-1.5 py-0.5"
                  style={{ background: 'var(--border-brand)', color: 'var(--text-primary)' }}>
                  PRIMARY
                </div>
              )}
              <button type="button" onClick={e => { e.stopPropagation(); remove(i); }}
                className="absolute top-1 right-1 w-5 h-5 flex items-center justify-center bg-interactive-danger text-on-danger opacity-0 group-hover:opacity-100 transition-opacity"
                aria-label="Remove image">
                <XIcon />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default MultiImageUploadPrimary;
