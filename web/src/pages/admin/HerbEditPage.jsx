import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Card from '../../components/common/Card';
import Button from '../../components/common/Button';
import Toggle from '../../components/common/Toggle';
import Checkbox from '../../components/common/Checkbox';
import Dropdown from '../../components/common/Dropdown';
import PageHeader from '../../components/common/PageHeader';
import ConfirmationModal from "../../components/modals/ConfirmationModal";
import ArrayInput from '../../components/common/ArrayInput';
import MultiImageUploadPrimary from '../../components/common/MultiImageUploadPrimary';
import { herbService } from '../../services/herbService';
import { imageService } from '../../services/imageService';

const normalizeImages = (images = []) => {
  const normalized = (Array.isArray(images) ? images : [])
    .map((image) => {
      if (!image) return null;
      if (typeof image === 'string') {
        const url = image.trim();
        return url ? { url, caption: '', isPrimary: false } : null;
      }

      const url = String(image.url || '').trim();
      if (!url) return null;

      return {
        url,
        caption: String(image.caption || image.name || '').trim(),
        isPrimary: Boolean(image.isPrimary),
      };
    })
    .filter(Boolean);

  if (normalized.length === 0) return [];
  if (!normalized.some((image) => image.isPrimary)) {
    normalized[0].isPrimary = true;
  }
  return normalized.map((image, index) => ({ ...image, isPrimary: image.isPrimary && index === normalized.findIndex((item) => item.isPrimary) }));
};

const HerbEditPage = () => {
  const { slug } = useParams();
  const navigate = useNavigate();
  const [herb, setHerb] = useState(null);
  const [formData, setFormData] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [error, setError] = useState(null);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [showDeleteConfirmModal, setShowDeleteConfirmModal] = useState(false);
  const [imagesToDelete, setImagesToDelete] = useState([]);
  const [hasChanges, setHasChanges] = useState(false);
  const [selectedPreparationMethod, setSelectedPreparationMethod] = useState('');

  // Preparation method options for dropdown
  const preparationMethodOptions = [
    { value: 'none', label: 'Select method...', description: 'Choose a preparation method' },
    { value: 'tea', label: 'Tea', description: 'Hot water infusion' },
    { value: 'tincture', label: 'Tincture', description: 'Alcohol-based extract' },
    { value: 'capsule', label: 'Capsule', description: 'Powder in gelatin capsules' },
    { value: 'powder', label: 'Powder', description: 'Dried and ground herb' },
    { value: 'ointment', label: 'Ointment', description: 'Topical preparation' },
    { value: 'essential_oil', label: 'Essential Oil', description: 'Distilled oil extract' },
    { value: 'compress', label: 'Compress', description: 'Cloth soaked in herbal preparation' },
    { value: 'poultice', label: 'Poultice', description: 'Direct herbal application' },
    { value: 'decoction', label: 'Decoction', description: 'Boiled plant material' },
    { value: 'infusion', label: 'Infusion', description: 'Steeped in hot water' },
    { value: 'syrup', label: 'Syrup', description: 'Sweetened liquid preparation' },
    { value: 'salve', label: 'Salve', description: 'Healing ointment' }
  ];

  useEffect(() => {
    loadHerb();
  }, [slug]);

  const loadHerb = async () => {
    try {
      setLoading(true);
      const response = await herbService.getHerbById(slug);
      const herbData = response.data || response;
      setHerb(herbData);
      const dosageData = herbData.dosage
        ? {
          ...herbData.dosage,
          sources: Array.isArray(herbData.dosage.sources) ? herbData.dosage.sources : [],
        }
        : {};

      setFormData({
        name: herbData.name || '',
        scientificName: herbData.scientificName || '',
        description: herbData.description || '',
        commonNames: herbData.commonNames || [],
        symptoms: herbData.symptoms || [],
        properties: herbData.properties || [],
        family: herbData.family || '',
        partsUsed: herbData.partsUsed || [],
        category: herbData.category || '',
        isActive: herbData.isActive !== false,
        isFeatured: herbData.isFeatured || false,
        images: normalizeImages(herbData.images || []),
        dosage: dosageData,
        growingInfo: herbData.growingInfo || {},
        preparation: herbData.preparation || [],
        interactions: herbData.interactions || [],
        contraindications: herbData.contraindications || []
      });
    } catch (err) {
      console.error('Failed to load herb:', err);
      setError('Herb not found');
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;

    // Handle nested dosage fields
    if (name.startsWith('dosage.')) {
      const keys = name.split('.');
      setFormData(prev => {
        const newData = { ...prev };
        // Navigate through nested structure
        let current = newData;
        for (let i = 0; i < keys.length - 1; i++) {
          if (!current[keys[i]]) {
            current[keys[i]] = {};
          }
          current = current[keys[i]];
        }
        // Set the final value
        current[keys[keys.length - 1]] = type === 'checkbox' ? checked : value;
        return newData;
      });
    } else {
      setFormData(prev => ({
        ...prev,
        [name]: type === 'checkbox' ? checked : value
      }));
    }
    setHasChanges(true);
  };

  const handleArrayInput = (field, value) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
    setHasChanges(true);
  };

  const handleNestedChange = (parent, field, value) => {
    setFormData(prev => ({
      ...prev,
      [parent]: {
        ...prev[parent],
        [field]: value
      }
    }));
    setHasChanges(true);
  };

  const handleImagesChange = async (newImages) => {
    setFormData(prev => ({
      ...prev,
      images: newImages
    }));
    setHasChanges(true);
  };

  const handleCancel = () => {
    if (hasChanges) {
      setShowCancelModal(true);
    } else {
      navigate('/admin/herbs');
    }
  };

  const confirmCancel = () => {
    navigate('/admin/herbs');
  };

  const handleSave = async () => {
    try {
      // Find images that were removed (exist in original herb but not in current form)
      const originalImageUrls = herb.images?.map(img => img.url) || [];
      const currentImageUrls = formData.images.map(img => img.url);
      const removedImageUrls = originalImageUrls.filter(url => !currentImageUrls.includes(url));

      // If there are images to delete, show confirmation first
      if (removedImageUrls.length > 0) {
        setImagesToDelete(removedImageUrls);
        setShowDeleteConfirmModal(true);
        return;
      }

      // If no images to delete, proceed with save
      proceedWithSave();
    } catch (err) {
      console.error('Failed to update herb:', err);
      setError('Failed to update herb');
    }
  };

  const proceedWithSave = async () => {
    try {
      setSaving(true);
      setShowDeleteConfirmModal(false);

      // Find images that were removed (exist in original herb but not in current form)
      const originalImageUrls = herb.images?.map(img => img.url) || [];
      const currentImageUrls = formData.images.map(img => img.url);
      const removedImageUrls = originalImageUrls.filter(url => !currentImageUrls.includes(url));

      // Delete removed images from Cloudinary
      if (removedImageUrls.length > 0) {
        try {
          await herbService.deleteHerbImages(herb._id, removedImageUrls);
        } catch (error) {
          console.error('Failed to delete images:', error);
          setError('Failed to delete some images from cloud storage');
          // Continue with save even if deletion fails
        }
      }

      // Upload any new images
      const imagesToUpload = formData.images.filter((img) => img?.file instanceof File);
      const uploadFiles = imagesToUpload.map((img) => img.file);
      let finalImages = [...formData.images];

      if (imagesToUpload.length > 0) {
        setUploadingImage(true);

        try {
          // Upload all images at once
          const uploadResult = await imageService.uploadMultipleHerbImages(
            herb._id,
            uploadFiles,
            formData.scientificName
          );
          const uploadedItems = Array.isArray(uploadResult)
            ? uploadResult
            : Array.isArray(uploadResult?.data)
              ? uploadResult.data
              : [];

          // Replace file objects with uploaded image URLs
          finalImages = formData.images.map(img => {
            if (img.file) {
              // Match by file object index to avoid collisions on duplicate filenames.
              const fileIndex = uploadFiles.findIndex((file) => file === img.file);
              if (fileIndex !== -1 && uploadedItems[fileIndex]) {
                const uploadedImage = uploadedItems[fileIndex];
                return {
                  url: uploadedImage.url,
                  name: img.name,
                  caption: `${formData.name} image`,
                  isPrimary: img.isPrimary || false
                };
              }
            }
            return img; // Keep existing images as-is
          });

        } catch (error) {
          console.error('Image upload failed:', error);
          setError('Failed to upload images: ' + error.message);
          return;
        } finally {
          setUploadingImage(false);
        }
      }

      // Update herb data with final images
      const sanitizedDosage = (() => {
        const dosage = formData.dosage || {};
        const sources = Array.isArray(dosage.sources)
          ? dosage.sources
            .map((source) => ({
              ...source,
              url: String(source?.url || '').trim(),
              title: String(source?.title || '').trim(),
              publisher: String(source?.publisher || '').trim(),
            }))
            .filter((source) => source.url)
          : [];
        return { ...dosage, sources };
      })();

      const updatedFormData = {
        ...formData,
        dosage: sanitizedDosage,
        images: normalizeImages(finalImages)
      };

      console.log('Final herb data being sent:', updatedFormData);
      await herbService.updateHerb(herb._id, updatedFormData);
      setHasChanges(false);
      navigate('/admin/herbs');
    } catch (err) {
      console.error('Failed to update herb:', err);
      setError('Failed to update herb');
    } finally {
      setSaving(false);
    }
  };

  const renderSaveActions = () => (
    <>
      <Button
        variant="outline"
        onClick={handleCancel}
        disabled={saving}
        className="!bg-surface-primary !text-primary !border-primary !hover:bg-surface-secondary"
      >
        Cancel
      </Button>
      <Button
        variant="primary"
        onClick={handleSave}
        disabled={saving || !hasChanges}
        className={`${hasChanges ? 'bg-interactive-success hover:bg-interactive-success-hover' : 'bg-surface-tertiary'} text-on-success`}
      >
        {saving ? (
          <>
            <div className="w-4 h-4 border-2 border-intent-danger border-t-transparent rounded-full animate-spin mr-2"></div>
            Saving...
          </>
        ) : (
          <>
            <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            Save Changes
          </>
        )}
      </Button>
    </>
  );

  return (
    <div className="bg-surface-primary">
      <div className="max-w-full mx-auto p-6">
        <div className="mb-4 flex items-center justify-between gap-3">
          <h1 className="text-xl font-semibold text-primary">Edit Herb</h1>
          <div className="flex items-center gap-2">
            {renderSaveActions()}
          </div>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-8">
            {/* Image Upload */}
            <Card className="overflow-hidden border-primary">
              <div className="p-4 border-secondary">
                <MultiImageUploadPrimary
                  currentImages={formData.images}
                  onImagesChange={handleImagesChange}
                  maxImages={6}
                  uploading={uploadingImage}
                />
              </div>
            </Card>

            {/* Description */}
            <Card className="p-8">
              <h2 className="text-2xl font-bold text-primary mb-4 font-display border-l-4 border-brand pl-4">Description</h2>
              <textarea
                name="description"
                value={formData.description || ''}
                onChange={handleInputChange}
                rows={6}
                className="w-full px-4 py-3 bg-surface-primary border border-primary rounded-lg text-primary focus:ring-2 focus:ring-brand/70 focus:border-transparent resize-none placeholder:text-alt"
                placeholder="Enter herb description..."
              />
            </Card>

            {/* Uses/Symptoms */}
            <Card className="p-8">
              <h2 className="text-2xl font-bold text-primary mb-6 font-display border-l-4 border-brand pl-4">Traditional Uses & Properties</h2>
              <div className="space-y-6">
                <ArrayInput
                  items={formData.symptoms || []}
                  onChange={(items) => handleArrayInput('symptoms', items)}
                  placeholder="Add symptom..."
                  label="Treats Symptoms"
                />
                <ArrayInput
                  items={formData.properties || []}
                  onChange={(items) => handleArrayInput('properties', items)}
                  placeholder="Add property..."
                  label="Properties"
                />
              </div>
            </Card>

          </div>

          {/* Sidebar */}
          <div className="space-y-8">
            {/* Quick Info */}
            <Card className="p-6 overflow-hidden relative">
              <div className="absolute top-0 right-0 w-24 h-24 bg-brand/5 rounded-bl-full -mr-10 -mt-10"></div>
              <h3 className="text-lg font-bold text-primary mb-6 font-display border-b border-primary pb-2">Quick Info</h3>
              <div className="space-y-5">
                <div>
                  <span className="text-xs font-bold text-tertiary uppercase tracking-widest block mb-2">Family</span>
                  <input
                    type="text"
                    name="family"
                    value={formData.family || ''}
                    onChange={handleInputChange}
                    className="w-full px-3 py-1 bg-surface-primary border border-primary rounded text-sm focus:ring-1 focus:ring-brand/70 focus:border-transparent text-primary placeholder:text-alt"
                    placeholder="Family"
                  />
                </div>
                <ArrayInput
                  items={formData.commonNames || []}
                  onChange={(items) => handleArrayInput('commonNames', items)}
                  placeholder="Add common name..."
                  label="Common Names"
                  className="mt-4"
                />
                <ArrayInput
                  items={formData.partsUsed || []}
                  onChange={(items) => handleArrayInput('partsUsed', items)}
                  placeholder="Add part used..."
                  label="Parts Used"
                  className="mt-4"
                />

                {/* Dosage Information */}
                <div className="mt-6 pt-6 border-primary">
                  <h4 className="text-sm font-bold text-tertiary uppercase tracking-widest mb-4">Dosage Information</h4>
                  <div className="space-y-4">
                    {/* Adult Dosage */}
                    <div>
                      <span className="text-xs font-semibold text-tertiary block mb-2">Adult Dosage</span>
                      <div className="grid grid-cols-4 gap-1 items-center">
                        <input
                          type="text"
                          name="dosage.adult.min"
                          value={formData.dosage?.adult?.min || ''}
                          onChange={handleInputChange}
                          className="w-full px-2 py-1 bg-surface-primary border border-primary rounded text-sm focus:ring-1 focus:ring-brand/70 focus:border-transparent text-primary placeholder:text-alt"
                          placeholder="Min"
                        />
                        <span className="text-tertiary text-sm text-center">-</span>
                        <input
                          type="text"
                          name="dosage.adult.max"
                          value={formData.dosage?.adult?.max || ''}
                          onChange={handleInputChange}
                          className="w-full px-2 py-1 bg-surface-primary border border-primary rounded text-sm focus:ring-1 focus:ring-brand/70 focus:border-transparent text-primary placeholder:text-alt"
                          placeholder="Max"
                        />
                        <input
                          type="text"
                          name="dosage.adult.unit"
                          value={formData.dosage?.adult?.unit || ''}
                          onChange={handleInputChange}
                          className="w-full px-2 py-1 bg-surface-primary border border-primary rounded text-sm focus:ring-1 focus:ring-brand/70 focus:border-transparent text-primary placeholder:text-alt"
                          placeholder="Unit"
                        />
                      </div>
                      <input
                        type="text"
                        name="dosage.adult.frequency"
                        value={formData.dosage?.adult?.frequency || ''}
                        onChange={handleInputChange}
                        className="w-full mt-2 px-2 py-1 bg-surface-primary border border-primary rounded text-sm focus:ring-1 focus:ring-brand/70 focus:border-transparent text-primary placeholder:text-alt"
                        placeholder="Frequency (e.g., 2x daily)"
                      />
                    </div>

                    {/* Child Dosage */}
                    <div>
                      <span className="text-xs font-semibold text-tertiary block mb-2">Child Dosage</span>
                      <div className="grid grid-cols-4 gap-1 items-center">
                        <input
                          type="text"
                          name="dosage.child.min"
                          value={formData.dosage?.child?.min || ''}
                          onChange={handleInputChange}
                          className="w-full px-2 py-1 bg-surface-primary border border-primary rounded text-sm focus:ring-1 focus:ring-brand/70 focus:border-transparent text-primary placeholder:text-alt"
                          placeholder="Min"
                        />
                        <span className="text-tertiary text-sm text-center">-</span>
                        <input
                          type="text"
                          name="dosage.child.max"
                          value={formData.dosage?.child?.max || ''}
                          onChange={handleInputChange}
                          className="w-full px-2 py-1 bg-surface-primary border border-primary rounded text-sm focus:ring-1 focus:ring-brand/70 focus:border-transparent text-primary placeholder:text-alt"
                          placeholder="Max"
                        />
                        <input
                          type="text"
                          name="dosage.child.unit"
                          value={formData.dosage?.child?.unit || ''}
                          onChange={handleInputChange}
                          className="w-full px-2 py-1 bg-surface-primary border border-primary rounded text-sm focus:ring-1 focus:ring-brand/70 focus:border-transparent text-primary placeholder:text-alt"
                          placeholder="Unit"
                        />
                      </div>
                      <input
                        type="text"
                        name="dosage.child.frequency"
                        value={formData.dosage?.child?.frequency || ''}
                        onChange={handleInputChange}
                        className="w-full mt-2 px-2 py-1 bg-surface-primary border border-primary rounded text-sm focus:ring-1 focus:ring-brand/70 focus:border-transparent text-primary placeholder:text-alt"
                        placeholder="Frequency (e.g., 2x daily)"
                      />
                    </div>
                  </div>
                </div>

                <div>
                  <span className="text-xs font-bold text-tertiary uppercase tracking-widest block mb-2">Dosage Source Link</span>
                  <input
                    type="url"
                    name="dosage.sources.0.url"
                    value={formData.dosage?.sources?.[0]?.url || ''}
                    onChange={handleInputChange}
                    className="w-full px-3 py-1 bg-surface-primary border border-primary rounded text-sm focus:ring-1 focus:ring-brand/70 focus:border-transparent text-primary placeholder:text-alt"
                    placeholder="https://example.com/dosage-info"
                  />
                </div>
              </div>
            </Card>

            {/* Status */}
            <Card className="p-6 bg-surface-primary text-primary border-primary">
              <h3 className="text-lg font-bold mb-6 font-display border-b border-primary pb-2">Publication Status</h3>
              <div className="space-y-4">
                <label className="flex items-center justify-between">
                  <span className="text-sm">Active</span>
                  <input
                    type="checkbox"
                    name="isActive"
                    checked={formData.isActive || false}
                    onChange={handleInputChange}
                    className="w-5 h-5 text-brand focus:ring-brand border-primary rounded"
                  />
                </label>
                <label className="flex items-center justify-between">
                  <span className="text-sm">Featured</span>
                  <input
                    type="checkbox"
                    name="isFeatured"
                    checked={formData.isFeatured || false}
                    onChange={handleInputChange}
                    className="w-5 h-5 text-brand focus:ring-brand border-tertiary rounded"
                  />
                </label>
              </div>
            </Card>

            {/* Preparation Methods */}
            <Card className="p-6 bg-surface-secondary text-primary border-primary">
              <h3 className="text-lg font-bold mb-6 font-display border-b border-primary pb-2 text-primary">Preparation Methods</h3>
              <div className="space-y-4">
                {formData.preparation?.map((prep, index) => {
                  const methodDisplayNames = {
                    tea: 'Tea',
                    tincture: 'Tincture',
                    capsule: 'Capsule',
                    powder: 'Powder',
                    ointment: 'Ointment',
                    essential_oil: 'Essential Oil',
                    compress: 'Compress',
                    poultice: 'Poultice',
                    decoction: 'Decoction',
                    infusion: 'Infusion',
                    syrup: 'Syrup',
                    salve: 'Salve'
                  };

                  return (
                    <div key={index} className="bg-surface-primary border border-primary rounded-lg p-3">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-primary font-medium">
                          {methodDisplayNames[prep.method] || prep.method || 'Unknown method'}
                        </span>
                        <button
                          type="button"
                          onClick={() => {
                            const newPreparation = [...(formData.preparation || [])];
                            newPreparation.splice(index, 1);
                            setFormData(prev => ({ ...prev, preparation: newPreparation }));
                            setHasChanges(true);
                          }}
                          className="w-5 h-5 rounded-full bg-interactive-danger/20 hover:bg-interactive-danger/30 text-intent-danger flex items-center justify-center transition-all duration-200"
                          title="Remove preparation"
                        >
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </div>
                      <div className="space-y-2">
                        {prep.instructions && (
                          <div className="text-xs text-tertiary">
                            <span className="font-semibold">Instructions:</span> {prep.instructions}
                          </div>
                        )}
                        {prep.ratio && (
                          <div className="text-xs text-tertiary">
                            <span className="font-semibold">Ratio:</span> {prep.ratio}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}

                {/* Add New Preparation */}
                <div className="border-2 border-dashed border-primary bg-surface-secondary rounded-lg p-3">
                  <div className="space-y-3">
                    <Dropdown
                      value={selectedPreparationMethod}
                      onChange={setSelectedPreparationMethod}
                      options={preparationMethodOptions}
                      admin={true}
                      customClasses={{
                        input: 'bg-surface-tertiary border-primary text-primary placeholder:text-alt/70',
                        dropdown: 'bg-surface-primary border-primary',
                        option: 'hover:bg-surface-secondary'
                      }}
                    />
                    <textarea
                      placeholder="Instructions..."
                      className="w-full px-3 py-2 bg-surface-tertiary border border-primary rounded text-sm text-primary placeholder:text-alt/70 focus:ring-1 focus:ring-brand/70 focus:border-transparent resize-none"
                      rows={2}
                      id="newInstructionsInput"
                    />
                    <input
                      type="text"
                      placeholder="Ratio (e.g., 1:2 herb:water)..."
                      className="w-full px-3 py-2 bg-surface-tertiary border border-primary rounded text-sm text-primary placeholder:text-alt/70 focus:ring-1 focus:ring-brand/70 focus:border-transparent"
                      id="newRatioInput"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        const instructionsInput = document.getElementById('newInstructionsInput');
                        const ratioInput = document.getElementById('newRatioInput');

                        if (selectedPreparationMethod) {
                          const newPrep = {
                            method: selectedPreparationMethod,
                            instructions: instructionsInput.value.trim(),
                            ratio: ratioInput.value.trim()
                          };
                          setFormData(prev => ({
                            ...prev,
                            preparation: [...(prev.preparation || []), newPrep]
                          }));
                          setHasChanges(true);

                          // Clear all inputs
                          setSelectedPreparationMethod('');
                          instructionsInput.value = '';
                          ratioInput.value = '';
                        }
                      }}
                      className="w-full px-4 py-2 bg-interactive-brand-primary text-on-brand font-medium rounded-lg transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-brand/50"
                    >
                      Add Preparation Method
                    </button>
                  </div>
                </div>
              </div>
            </Card>

            {/* Cultivation Info */}
            <Card className="p-6 bg-surface-secondary text-primary border-primary">
              <h3 className="text-lg font-bold mb-6 font-display border-b border-primary pb-2 text-primary">Cultivation Information</h3>
              <div className="space-y-4">
                <div>
                  <span className="text-xs font-bold text-tertiary block mb-2">Soil Type</span>
                  <input
                    type="text"
                    name="growingInfo.soilType"
                    value={formData.growingInfo?.soilType || ''}
                    onChange={handleInputChange}
                    className="w-full px-2 py-1 bg-surface-primary border border-primary rounded text-sm focus:ring-1 focus:ring-brand/70 focus:border-transparent text-primary placeholder:text-alt/70"
                    placeholder="e.g., Well-drained, sandy soil"
                  />
                </div>
                <div>
                  <span className="text-xs font-bold text-tertiary block mb-2">Sunlight</span>
                  <input
                    type="text"
                    name="growingInfo.sunlight"
                    value={formData.growingInfo?.sunlight || ''}
                    onChange={handleInputChange}
                    className="w-full px-2 py-1 bg-surface-primary border border-primary rounded text-sm focus:ring-1 focus:ring-brand/70 focus:border-transparent text-primary placeholder:text-alt/70"
                    placeholder="e.g., Full sun to partial shade"
                  />
                </div>
                <div>
                  <span className="text-xs font-bold text-tertiary block mb-2">Watering</span>
                  <input
                    type="text"
                    name="growingInfo.watering"
                    value={formData.growingInfo?.watering || ''}
                    onChange={handleInputChange}
                    className="w-full px-2 py-1 bg-surface-primary border border-primary rounded text-sm focus:ring-1 focus:ring-brand/70 focus:border-transparent text-primary placeholder:text-alt/70"
                    placeholder="e.g., Moderate watering"
                  />
                </div>
                <div>
                  <span className="text-xs font-bold text-tertiary block mb-2">Temperature</span>
                  <input
                    type="text"
                    name="growingInfo.temperature"
                    value={formData.growingInfo?.temperature || ''}
                    onChange={handleInputChange}
                    className="w-full px-2 py-1 bg-surface-primary border border-primary rounded text-sm focus:ring-1 focus:ring-brand/70 focus:border-transparent text-primary placeholder:text-alt/70"
                    placeholder="e.g., 20-30°C"
                  />
                </div>
              </div>
            </Card>
          </div>
        </div>
      </div>

      {/* Cancel Confirmation Modal */}
      <ConfirmationModal
        isOpen={showCancelModal}
        onClose={() => setShowCancelModal(false)}
        onConfirm={confirmCancel}
        title="Unsaved Changes"
        message="You have unsaved changes. Are you sure you want to leave without saving?"
        confirmText="Discard Changes"
        cancelText="Stay"
        type="warning"
      />

      {/* Delete Images Confirmation Modal */}
      <ConfirmationModal
        isOpen={showDeleteConfirmModal}
        onClose={() => setShowDeleteConfirmModal(false)}
        onConfirm={proceedWithSave}
        title="Delete Images"
        message={`Are you sure you want to delete ${imagesToDelete.length} image(s)? This action cannot be undone and will permanently remove the images from cloud storage.`}
        confirmText="Delete & Save"
        cancelText="Cancel"
        type="danger"
      />
    </div>
  );
};

export default HerbEditPage;

