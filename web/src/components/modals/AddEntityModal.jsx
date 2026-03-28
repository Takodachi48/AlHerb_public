import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import MultiImageUploadPrimary from '../common/MultiImageUploadPrimary';
import Dropdown from '../common/Dropdown';
import Input from '../common/Input';
import herbService from '../../services/herbService';
import locationService from '../../services/locationService';

const CloseIcon = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
    <path d="M6 18L18 6M6 6l12 12" />
  </svg>
);
const ErrorIcon = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <circle cx="12" cy="12" r="9" />
    <line x1="12" y1="8" x2="12" y2="12" />
    <circle cx="12" cy="16" r="0.7" fill="currentColor" />
  </svg>
);

// Entity configurations
const ENTITY_CONFIGS = {
  herb: {
    title: 'Add New Herb',
    fields: {
      scientificName: { label: 'Scientific Name', placeholder: 'e.g., Lavandula angustifolia', required: true },
      commonNames: { label: 'Common Names', placeholder: 'e.g., Lavender, Lavandula', required: false },
      images: { label: 'Images', maxImages: 6, required: false }
    },
    initialForm: { scientificName: '', commonNames: '', images: [] },
    submitText: 'Add Herb',
    service: herbService,
    createMethod: 'createHerb',
    transformPayload: (form) => ({
      scientificName: form.scientificName.trim(),
      commonNames: form.commonNames.split(',').map(n => n.trim()).filter(Boolean),
      isActive: false,
      images: form.images,
    })
  },
  location: {
    title: 'Add New Location',
    fields: {
      name: { label: 'Location Name', placeholder: 'e.g., Manila Herbal Hub', required: true },
      latitude: { label: 'Latitude', placeholder: 'e.g., 14.5995', required: true },
      longitude: { label: 'Longitude', placeholder: 'e.g., 120.9842', required: true },
      type: { 
        label: 'Type', 
        required: false,
        dropdown: true,
        options: [
          { value: 'market', label: 'Market' },
          { value: 'shop', label: 'Shop' },
          { value: 'foraging', label: 'Foraging' },
          { value: 'pharmacy', label: 'Pharmacy' },
          { value: 'clinic', label: 'Clinic' }
        ]
      }
    },
    initialForm: { name: '', latitude: '', longitude: '', type: 'market' },
    submitText: 'Add Location',
    service: locationService,
    createMethod: 'createLocation',
    transformPayload: (form) => ({
      name: form.name.trim(),
      latitude: parseFloat(form.latitude),
      longitude: parseFloat(form.longitude),
      type: form.type || null,
    })
  }
};

/**
 * AddEntityModal - Generic modal for adding different types of entities
 *
 * Props:
 *   isOpen      boolean
 *   onClose     () => void
 *   onSuccess   () => void — called after successful create
 *   entityType  string — 'herb' or 'location'
 */
const AddEntityModal = ({ isOpen, onClose, onSuccess, entityType = 'herb' }) => {
  const config = ENTITY_CONFIGS[entityType] || ENTITY_CONFIGS.herb;

  const [form, setForm] = useState(config.initialForm);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  /* Revoke object URLs on unmount / image change */
  useEffect(() => {
    return () => {
      if (form.images) {
        form.images.forEach(img => img?.preview && URL.revokeObjectURL(img.preview));
      }
    };
  }, [form.images]);

  const modalRef = useRef(null);

  /* Click outside to close */
  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (e) => {
      if (modalRef.current && !modalRef.current.contains(e.target)) {
        handleClose();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  const set = (field, value) => setForm(prev => ({ ...prev, [field]: value }));

  const handleSubmit = async (e) => {
    e.preventDefault();

    // Check required fields
    const requiredFields = Object.entries(config.fields).filter(([, fieldConfig]) => fieldConfig.required);
    const missingRequired = requiredFields.some(([fieldName]) => !form[fieldName]?.toString().trim());

    if (missingRequired || loading) return;

    setLoading(true);
    setError('');

    try {
      const payload = config.transformPayload(form);
      const res = await config.service[config.createMethod](payload);

      if (res.success) {
        onSuccess?.();
        onClose?.();
        setForm(config.initialForm);
      } else {
        setError(res.message || `Failed to create ${entityType}`);
      }
    } catch (err) {
      setError(err.message || `An error occurred while creating the ${entityType}`);
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    if (!loading) onClose?.();
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            key={`${entityType}-backdrop`}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            className="modal-backdrop"
            onClick={handleClose}
            aria-hidden="true"
          />

          {/* Panel */}
          <motion.div
            key={`${entityType}-panel`}
            initial={{ opacity: 0, scale: 0.97, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.97, y: 10 }}
            transition={{ duration: 0.2, ease: [0.23, 1, 0.32, 1] }}
            style={{
              position: 'fixed', inset: 0, zIndex: 10000,
              display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              ref={modalRef}
              className="modal-panel add-entity-modal"
              role="dialog"
              aria-modal="true"
              aria-labelledby={`${entityType}-title`}
              style={{ maxWidth: '420px', width: '100%' }}
            >
              {/* ── Header ── */}
              <div className="modal-header">
                <div>
                  <p className="modal-eyebrow">Admin</p>
                  <h2 id={`${entityType}-title`} className="modal-title">{config.title}</h2>
                </div>
                <button
                  type="button"
                  className="btn-icon"
                  onClick={handleClose}
                  aria-label="Close"
                  disabled={loading}
                >
                  <CloseIcon />
                </button>
              </div>

              {/* ── Form ── */}
              <form onSubmit={handleSubmit}>
                <div className="modal-body">

                  {/* Error banner */}
                  {error && (
                    <div className="modal-error" role="alert">
                      <ErrorIcon />
                      {error}
                    </div>
                  )}

                  {/* Dynamic Fields */}
                  {Object.entries(config.fields).map(([fieldName, fieldConfig]) => {
                    if (fieldName === 'images' && config.fields.images) {
                      return (
                        <div key={fieldName} className="modal-field">
                          <label className="label">
                            {fieldConfig.label}
                            <span className="helper" style={{ textTransform: 'none', letterSpacing: 'normal', marginLeft: 4 }}>
                              optional · max {fieldConfig.maxImages}
                            </span>
                          </label>
                          <MultiImageUploadPrimary
                            currentImages={form.images || []}
                            onImagesChange={(imgs) => set('images', imgs)}
                            maxImages={fieldConfig.maxImages}
                            uploading={loading}
                          />
                          {form.images?.length > 0 && (
                            <span className="helper">
                              {form.images.length}/{fieldConfig.maxImages} image{form.images.length !== 1 ? 's' : ''} selected
                            </span>
                          )}
                        </div>
                      );
                    }

                    if (fieldConfig.dropdown) {
                      return (
                        <div key={fieldName} className="modal-field">
                          <label className="label">
                            {fieldConfig.label}
                            {fieldConfig.required && <span style={{ color: 'var(--icon-danger)', marginLeft: 2 }}>*</span>}
                          </label>
                          <Dropdown
                            value={form[fieldName]}
                            onChange={(value) => set(fieldName, value)}
                            options={fieldConfig.options}
                            placeholder={`Select ${fieldConfig.label.toLowerCase()}`}
                            size="sm"
                            disabled={loading}
                            customClasses={{
                              dropdown: 'modal-dropdown-menu'
                            }}
                          />
                        </div>
                      );
                    }

                    return (
                      <div key={fieldName} className="modal-field">
                        <Input
                          label={fieldConfig.label + (fieldConfig.required ? ' *' : '')}
                          type={fieldName.includes('latitude') || fieldName.includes('longitude') ? 'number' : 'text'}
                          value={form[fieldName]}
                          onChange={(e) => set(fieldName, e.target.value)}
                          placeholder={fieldConfig.placeholder}
                          required={fieldConfig.required}
                          disabled={loading}
                          step={fieldName.includes('latitude') || fieldName.includes('longitude') ? 'any' : undefined}
                          variant="secondary"
                        />
                        {fieldName === 'commonNames' && <span className="helper">Separate multiple names with commas</span>}
                      </div>
                    );
                  })}

                </div>

                <div className="modal-divider" />

                {/* Footer */}
                <div className="modal-footer" style={{ flexDirection: 'column', gap: '12px' }}>
                  <button
                    type="submit"
                    className="btn btn--secondary"
                    disabled={Object.entries(config.fields)
                      .filter(([, fieldConfig]) => fieldConfig.required)
                      .some(([fieldName]) => !form[fieldName]?.toString().trim()) || loading}
                    style={{ gap: '8px' }}
                  >
                    {loading && (
                      <span className="spinner" style={{ width: 13, height: 13 }} aria-hidden="true" />
                    )}
                    {loading ? `Creating…` : config.submitText}
                  </button>
                  <button
                    type="button"
                    className="btn btn--neutral"
                    onClick={handleClose}
                    disabled={loading}
                  >
                    Cancel
                  </button>
                </div>
              </form>

            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};

export default AddEntityModal;
