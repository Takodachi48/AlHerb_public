import React, { useMemo } from 'react';
import Button from '../common/Button';
import SearchBar from '../common/SearchBar';
import FilterBox from '../common/FilterBox';
import TabNavigation from '../common/TabNavigation';
import Card from '../common/Card';
import ImageUpload from '../common/ImageUpload';
import Input from '../common/Input';
import Checkbox from '../common/Checkbox';
import { motion, AnimatePresence } from 'framer-motion';
import locationService from '../../services/locationService';

/**
 * MapSidePanel Component
 * Consolidates side panel UI and floating map controls
 */
const MapSidePanel = ({
  isSidePanelOpen,
  toggleSidePanel,
  activeTab,
  setActiveTab,
  handleBack,
  getCurrentLocation,
  user,
  userLocation,
  filters,
  updateFilter,
  availableHerbs,
  collapsedSections,
  toggleSection,
  selectedLocation,
  locationDetails,
  isLoadingDetails,
  markersVisible,
  handleZoomIn,
  handleZoomOut,
  toggleMarkers,
  handleResetFilters,
  onReviewSubmitted
}) => {
  const [canAnimateLayout, setCanAnimateLayout] = React.useState(false);

  React.useEffect(() => {
    const id = window.requestAnimationFrame(() => setCanAnimateLayout(true));
    return () => window.cancelAnimationFrame(id);
  }, []);

  const [reviewComment, setReviewComment] = React.useState('');
  const [reviewWouldReturn, setReviewWouldReturn] = React.useState(true);
  const [reviewImage, setReviewImage] = React.useState(null);
  const [reviewPreviewUrl, setReviewPreviewUrl] = React.useState('');
  const [reviewSubmitting, setReviewSubmitting] = React.useState(false);
  const [reviewError, setReviewError] = React.useState('');

  React.useEffect(() => {
    if (!reviewImage) {
      setReviewPreviewUrl('');
      return;
    }
    const url = URL.createObjectURL(reviewImage);
    setReviewPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [reviewImage]);

  React.useEffect(() => {
    setReviewComment('');
    setReviewImage(null);
    setReviewWouldReturn(true);
    setReviewError('');
  }, [selectedLocation?.id, selectedLocation?._id]);

  const filterOptions = [
    {
      value: 'all',
      label: 'All',
      icon: (
        <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
        </svg>
      )
    },
    {
      value: 'market',
      label: 'Markets',
      icon: (
        <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
        </svg>
      )
    },
    {
      value: 'shop',
      label: 'Shops',
      icon: (
        <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
        </svg>
      )
    },
    {
      value: 'foraging',
      label: 'Foraging',
      icon: (
        <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
        </svg>
      )
    },
    {
      value: 'pharmacy',
      label: 'Pharmacies',
      icon: (
        <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
        </svg>
      )
    },
    {
      value: 'clinic',
      label: 'Clinics',
      icon: (
        <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
        </svg>
      )
    }
  ];

  const radiusOptions = [
    { value: '5', label: '05 km' },
    { value: '10', label: '10 km' },
    { value: '25', label: '25 km' },
    { value: '50', label: '50 km' }
  ];

  const formatAddress = (address) => {
    if (!address) return 'Address not available';
    if (typeof address === 'string') return address;
    if (typeof address === 'object') {
      const parts = [address.street, address.barangay, address.city, address.province, address.region].filter(Boolean);
      return parts.length > 0 ? parts.join(', ') : 'Address not available';
    }
    return 'Address not available';
  };

  const getPrimaryLocationImage = (details) => {
    const images = Array.isArray(details?.images) ? details.images : [];
    if (images.length === 0) return null;
    const normalized = images
      .map((image) => {
        if (!image) return null;
        if (typeof image === 'string') return { url: image, caption: '', isPrimary: false };
        if (typeof image === 'object' && image.url) return image;
        return null;
      })
      .filter(Boolean);
    if (normalized.length === 0) return null;
    return normalized.find((image) => image.isPrimary) || normalized[0];
  };

  const formatReviewDate = (value) => {
    if (!value) return 'Just now';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return 'Just now';
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  const handleReviewSubmit = async (event) => {
    event.preventDefault();
    setReviewError('');

    if (!selectedLocation) return;
    if (!user) {
      setReviewError('Please log in to leave a review.');
      return;
    }
    if (!reviewComment.trim()) {
      setReviewError('Please add a short review before submitting.');
      return;
    }

    try {
      setReviewSubmitting(true);
      await locationService.createLocationReview(selectedLocation._id || selectedLocation.id, {
        comment: reviewComment.trim(),
        wouldReturn: reviewWouldReturn,
        image: reviewImage || undefined,
      });
      setReviewComment('');
      setReviewImage(null);
      setReviewWouldReturn(true);
      if (typeof onReviewSubmitted === 'function') {
        onReviewSubmitted(selectedLocation._id || selectedLocation.id);
      }
    } catch (error) {
      const message = error?.response?.data?.message || error?.message || 'Failed to submit review.';
      setReviewError(message);
    } finally {
      setReviewSubmitting(false);
    }
  };

  const herbAutocompleteOptions = useMemo(() => {
    const herbs = Array.isArray(availableHerbs) ? availableHerbs : [];
    return herbs.map((herb) => ({
      value: herb._id,
      label: herb.name,
      sublabel: herb.scientificName || '',
      searchText: [
        herb.name,
        herb.scientificName,
        ...(Array.isArray(herb.commonNames) ? herb.commonNames : [])
      ].filter(Boolean).join(' ')
    }));
  }, [availableHerbs]);

  const handleSearchChange = (value) => {
    updateFilter('search', value);
    // Always clear the herb ID filter when the user types, matching mobile behavior
    // where selectedHerbId is cleared on any text input. This prevents a stale herbId
    // from overriding the text search.
    if (filters.herb) {
      updateFilter('herb', '');
    }
  };

  const handleHerbSelect = (option) => {
    updateFilter('search', option.label || '');
    updateFilter('herb', option.value || '');
  };

  /* ── shared icon button style ── */
  const iconBtnStyle = {
    padding: 8,
    borderRadius: 6,
    border: '1.5px solid var(--border-primary)',
    background: 'var(--surface-secondary)',
    color: 'var(--text-secondary)',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    transition: 'background 150ms, border-color 150ms, color 150ms',
    outline: 'none',
  };

  /* ── section header shared style ── */
  const SectionHeader = ({ icon, label, sectionKey }) => (
    <button
      onClick={() => toggleSection(sectionKey)}
      style={{
        width: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '10px 12px',
        background: 'none',
        border: 'none',
        cursor: 'pointer',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        {/* icon slot — brand-coloured dash treatment */}
        <span style={{ color: 'var(--icon-accent)', display: 'flex', alignItems: 'center' }}>
          {icon}
        </span>
        <span style={{ fontFamily: 'var(--font-core)', fontSize: 'var(--text-h4-size)', fontWeight: 'var(--text-h4-weight)', letterSpacing: 'var(--text-h4-tracking)', color: 'var(--text-h4-color)', textTransform: 'none' }}>
          {label}
        </span>
      </div>
      <svg
        width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
        style={{
          color: 'var(--text-tertiary)',
          transition: 'transform 200ms',
          transform: collapsedSections[sectionKey] ? 'none' : 'rotate(180deg)',
          flexShrink: 0,
        }}
      >
        <polyline points="6 9 12 15 18 9" />
      </svg>
    </button>
  );

  return (
    <>
      {/* ── Floating map controls — .card style ── */}
      <motion.div
        animate={{ left: isSidePanelOpen ? 400 : 16 }}
        transition={canAnimateLayout ? { duration: 0.3 } : { duration: 0 }}
        style={{
          position: 'absolute',
          top: 16,
          zIndex: 30,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 4,
          padding: '8px 6px',
          background: 'var(--surface-primary)',
          border: '1.5px solid var(--border-primary)',
          borderLeft: '3px solid var(--border-brand)',
          borderRadius: 6,
          boxShadow: '3px 3px 0 var(--surface-tertiary)',
        }}
      >
        {/* Toggle panel */}
        <button
          onClick={toggleSidePanel}
          title={isSidePanelOpen ? 'Hide panel' : 'Show panel'}
          className="btn-icon"
          style={{ border: 'none', background: 'transparent' }}
        >
          <svg
            width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
            style={{ transition: 'transform 200ms', transform: isSidePanelOpen ? 'rotate(180deg)' : 'none', color: 'var(--text-secondary)' }}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
        </button>

        <div style={{ width: 20, height: 1, background: 'var(--border-primary)', margin: '2px 0' }} />

        {/* Zoom in */}
        <button onClick={handleZoomIn} title="Zoom in" className="btn-icon" style={{ border: 'none', background: 'transparent' }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ color: 'var(--text-secondary)' }}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
          </svg>
        </button>

        {/* Zoom out */}
        <button onClick={handleZoomOut} title="Zoom out" className="btn-icon" style={{ border: 'none', background: 'transparent' }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ color: 'var(--text-secondary)' }}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M20 12H4" />
          </svg>
        </button>

        <div style={{ width: 20, height: 1, background: 'var(--border-primary)', margin: '2px 0' }} />

        {/* Toggle markers */}
        <button
          onClick={toggleMarkers}
          title={markersVisible ? 'Hide markers' : 'Show markers'}
          className="btn-icon"
          style={{ border: 'none', background: 'transparent' }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
            style={{ color: markersVisible ? 'var(--icon-accent)' : 'var(--text-tertiary)' }}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
            {!markersVisible && <line x1="3" y1="3" x2="21" y2="21" strokeLinecap="round" />}
          </svg>
        </button>

        {/* Reset filters */}
        <button
          onClick={handleResetFilters}
          title="Reset filters"
          className="btn-icon"
          style={{ border: 'none', background: 'transparent' }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ color: 'var(--icon-danger)' }}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
        </button>
      </motion.div>

      {/* ── Overlay Side Panel ── */}
      <AnimatePresence>
        {isSidePanelOpen && (
          <motion.div
            initial={canAnimateLayout ? { x: -384 } : false}
            animate={{ x: 0 }}
            exit={{ x: -384 }}
            transition={{ duration: 0.3 }}
            style={{
              position: 'absolute', top: 0, left: 0,
              height: '100%', width: 384,
              background: 'var(--surface-secondary)',
              borderRight: '1.5px solid var(--border-primary)',
              boxShadow: '4px 0 20px rgba(0,0,0,0.12)',
              zIndex: 40,
              display: 'flex',
              flexDirection: 'column',
            }}
          >
            {/* Panel Header */}
            <div style={{
              padding: '10px 14px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 8,
              background: 'var(--surface-primary)',
              borderBottom: '1.5px solid var(--border-primary)',
              boxShadow: '0 1px 0 0 var(--border-brand)',
              flexShrink: 0,
            }}>
              {/* Back button */}
              <button
                onClick={handleBack}
                className="btn-icon"
                title="Back"
                style={{ flexShrink: 0 }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ color: 'var(--text-secondary)' }}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                </svg>
              </button>

              {/* Title */}
              <span style={{ fontFamily: 'var(--font-accent)', fontSize: 'var(--text-label-size)', fontWeight: 'var(--text-label-weight)', letterSpacing: 'var(--text-label-tracking)', textTransform: 'var(--text-label-transform)', color: 'var(--text-label-color)', flex: 1 }}>
                Herb Map
              </span>

              <Button
                variant="primary"
                size="sm"
                onClick={getCurrentLocation}
              >
                {userLocation ? 'Update Location' : 'Use My Location'}
              </Button>
            </div>

            {/* Tabs */}
            <TabNavigation
              variant="line"
              value={activeTab}
              onChange={setActiveTab}
              items={[
                { id: 'filters', label: 'Filters' },
                { id: 'details', label: 'Details' }
              ]}
              className="w-full"
            />

            {/* Tab Content */}
            <div style={{ flex: 1, overflowY: 'auto' }}>

              {/* ── Filters Tab ── */}
              {activeTab === 'filters' && (
                <div style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 14 }}>

                  {/* Herb search */}
                  <Card className="border-border-primary">
                    <div className="p-sm">
                      <SearchBar
                        value={filters.search}
                        onChange={handleSearchChange}
                        autocompleteOptions={herbAutocompleteOptions}
                        onSelectOption={handleHerbSelect}
                        placeholder="Search herbs…"
                        className="w-full"
                        defaultWidth="w-full"
                        focusedWidth="w-full"
                      />
                    </div>
                  </Card>

                  {/* Location Type filter */}
                  <div className="card" style={{ overflow: 'hidden' }}>
                    <SectionHeader
                      sectionKey="locationType"
                      label="Location Type"
                      icon={
                        <svg width="13" height="13" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                        </svg>
                      }
                    />
                    {!collapsedSections.locationType && (
                      <div style={{ borderTop: '1px solid var(--border-weakest)', padding: '10px 12px', background: 'var(--surface-secondary)', borderBottomLeftRadius: 6, borderBottomRightRadius: 6 }}>
                        <FilterBox
                          options={filterOptions}
                          selectedValue={filters.type}
                          onSelect={(value) => updateFilter('type', value)}
                          columns={2}
                          textSize="text-sm"
                          padding="p-2"
                        />
                      </div>
                    )}
                  </div>

                  {/* Search Radius filter */}
                  <div className="card" style={{ overflow: 'hidden' }}>
                    <SectionHeader
                      sectionKey="searchRadius"
                      label="Search Radius"
                      icon={
                        <svg width="13" height="13" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                        </svg>
                      }
                    />
                    {!collapsedSections.searchRadius && (
                      <div style={{ borderTop: '1px solid var(--border-weakest)', padding: '10px 12px', background: 'var(--surface-secondary)' }}>
                        <FilterBox
                          options={radiusOptions}
                          selectedValue={String(filters.radius)}
                          onSelect={(value) => updateFilter('radius', Number(value))}
                          columns={4}
                          textSize="text-sm"
                          padding="p-2"
                        />
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* ── Details Tab ── */}
              {activeTab === 'details' && (
                <div style={{ padding: 14, height: '100%' }}>
                  {selectedLocation ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>

                      {isLoadingDetails ? (
                        /* Skeleton */
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                          <div style={{ height: 180, borderRadius: 6, background: 'var(--surface-tertiary)', animation: 'pulse 1.5s infinite' }} />
                          <div style={{ height: 24, borderRadius: 6, background: 'var(--surface-tertiary)', width: '60%', animation: 'pulse 1.5s infinite' }} />
                          <div style={{ height: 16, borderRadius: 6, background: 'var(--surface-tertiary)', width: '40%', animation: 'pulse 1.5s infinite' }} />
                          <div style={{ height: 80, borderRadius: 6, background: 'var(--surface-tertiary)', animation: 'pulse 1.5s infinite' }} />
                        </div>
                      ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>

                          {/* Location image */}
                          {(() => {
                            const primaryImage = getPrimaryLocationImage(locationDetails || selectedLocation);
                            if (primaryImage?.url) {
                              return (
                                <div className="card" style={{ overflow: 'hidden', borderLeftColor: 'var(--border-brand)' }}>
                                  <img
                                    src={primaryImage.url}
                                    alt={primaryImage.caption || `${selectedLocation.name} location`}
                                    style={{ width: '100%', height: 180, objectFit: 'cover', display: 'block' }}
                                    loading="lazy"
                                  />
                                  {primaryImage.caption && (
                                    <div style={{ padding: '6px 12px', borderTop: '1px solid var(--border-weakest)', background: 'var(--surface-secondary)' }}>
                                      <span className="helper">{primaryImage.caption}</span>
                                    </div>
                                  )}
                                </div>
                              );
                            }
                            return (
                              <div className="card" style={{ padding: '12px 14px', display: 'flex', alignItems: 'center', gap: 10 }}>
                                <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24" style={{ color: 'var(--text-tertiary)', flexShrink: 0 }}>
                                  <rect x="3" y="3" width="18" height="18" rx="2" /><path d="M3 9l4-4 4 4 4-4 4 4" />
                                </svg>
                                <span className="helper">No photo on file for this location.</span>
                              </div>
                            );
                          })()}

                          {/* Name + address + distance */}
                          <div className="card" style={{ borderLeftColor: CATEGORY_ACCENT[selectedLocation.type] || 'var(--border-brand)', padding: '12px 14px' }}>
                            <div style={{ fontFamily: 'var(--font-core)', fontSize: 'var(--text-h3-size)', fontWeight: 'var(--text-h3-weight)', color: 'var(--text-h3-color)', lineHeight: 'var(--text-h3-line-height)', letterSpacing: 'var(--text-h3-tracking)', marginBottom: 5 }}>
                              {selectedLocation.name}
                            </div>
                            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 6, marginBottom: userLocation && selectedLocation.distance ? 8 : 0 }}>
                              <svg width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" style={{ color: 'var(--text-tertiary)', marginTop: 2, flexShrink: 0 }}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                                <path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                              </svg>
                              <span style={{ fontFamily: 'var(--font-core)', fontSize: 'var(--text-small-size)', fontWeight: 'var(--text-small-weight)', color: 'var(--text-small-color)', lineHeight: 'var(--text-small-line-height)' }}>
                                {formatAddress(selectedLocation.address)}
                              </span>
                            </div>
                            {userLocation && selectedLocation.distance && (
                              <div style={{ marginTop: 4 }}>
                                <span style={{
                                  display: 'inline-flex', alignItems: 'center', gap: 5,
                                  fontFamily: 'var(--font-accent)', fontSize: 'var(--text-label-size)', fontWeight: 'var(--text-label-weight)', letterSpacing: 'var(--text-label-tracking)', textTransform: 'var(--text-label-transform)',
                                  color: 'var(--text-accent)',
                                  background: 'var(--surface-accent)',
                                  border: '1px solid var(--border-accent)',
                                  borderLeft: '3px solid var(--border-accent)',
                                  borderRadius: 6, padding: '2px 8px 2px 6px',
                                }}>
                                  <svg width="10" height="10" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                                    <circle cx="12" cy="12" r="3" /><path d="M12 2v3M12 19v3M2 12h3M19 12h3" />
                                  </svg>
                                  {selectedLocation.distance} km away
                                </span>
                              </div>
                            )}
                          </div>

                          {/* About */}
                          <div className="card" style={{ padding: '12px 14px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 8 }} className="label">
                              <span style={{ width: 10, height: 1.5, background: 'var(--border-brand)', display: 'inline-block', flexShrink: 0 }} />
                              About
                            </div>
                            <p style={{ fontFamily: 'var(--font-core)', fontSize: 'var(--text-body-size)', fontWeight: 'var(--text-body-weight)', color: 'var(--text-body-color)', lineHeight: 'var(--text-body-line-height)' }}>
                              {locationDetails?.description || 'No description available for this location.'}
                            </p>
                          </div>

                          {/* Available herbs */}
                          {locationDetails?.herbs && locationDetails.herbs.length > 0 && (
                            <div className="card" style={{ padding: '12px 14px' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 10 }} className="label">
                                <span style={{ width: 10, height: 1.5, background: 'var(--border-brand)', display: 'inline-block', flexShrink: 0 }} />
                                Available Herbs
                              </div>
                              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                                {locationDetails.herbs.map((h, idx) => (
                                  <span key={idx} className="tag">
                                    <span style={{ width: 5, height: 5, borderRadius: '50%', background: 'var(--color-accent-primary)', display: 'inline-block', flexShrink: 0 }} />
                                    {h.herbId?.name || h.name || 'Unknown Herb'}
                                  </span>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* Community reviews */}
                          <div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 8, paddingLeft: 2 }} className="label">
                              <span style={{ width: 10, height: 1.5, background: 'var(--border-brand)', display: 'inline-block', flexShrink: 0 }} />
                              Community Reviews
                            </div>
                            <div className="card" style={{ padding: '12px 14px', marginBottom: 10 }}>
                              {!user ? (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                                  <span className="helper">Log in to leave a review. Reviews are visible to everyone.</span>
                                </div>
                              ) : (
                                <form onSubmit={handleReviewSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                                  <Input
                                    multiline
                                    value={reviewComment}
                                    onChange={(event) => setReviewComment(event.target.value)}
                                    placeholder="Share your experience at this location..."
                                    rows={3}
                                  />
                                  <Checkbox
                                    id="review-would-return"
                                    checked={reviewWouldReturn}
                                    onChange={(checked) => setReviewWouldReturn(checked)}
                                    label="I would return here."
                                    size="sm"
                                  />
                                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                                    <ImageUpload
                                      currentImages={reviewImage ? [{ file: reviewImage, preview: reviewPreviewUrl, name: reviewImage.name }] : []}
                                      onImagesChange={(images) => {
                                        const newImage = images[0]?.file || null;
                                        setReviewImage(newImage);
                                      }}
                                      maxImages={1}
                                      uploading={reviewSubmitting}
                                      buttonOnly={true}
                                    />
                                  </div>
                                  {reviewError && (
                                    <span style={{ color: 'var(--text-danger)', fontSize: 'var(--text-small-size)' }}>
                                      {reviewError}
                                    </span>
                                  )}
                                  <Button variant="primary" size="sm" type="submit" disabled={reviewSubmitting}>
                                    {reviewSubmitting ? 'Submitting...' : 'Submit Review'}
                                  </Button>
                                </form>
                              )}
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                              {locationDetails?.reviews?.map((review) => (
                                <div key={review._id || review.id} className="card card--hover" style={{ padding: '10px 12px' }}>
                                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                      {/* Avatar initial */}
                                      {(() => {
                                        const authorName = review.userId?.displayName || review.author || 'User';
                                        const initial = authorName?.charAt(0)?.toUpperCase() || 'U';
                                        return (
                                          <div style={{
                                            width: 28, height: 28, borderRadius: 6,
                                            background: 'var(--surface-accent)',
                                            border: '1.5px solid var(--border-accent)',
                                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                                            fontFamily: 'var(--font-mono)', fontSize: 11, fontWeight: 700,
                                            color: 'var(--text-accent)', flexShrink: 0,
                                          }}>
                                            {initial}
                                          </div>
                                        );
                                      })()}
                                      <span style={{ fontFamily: 'var(--font-core)', fontSize: 'var(--text-body-size)', fontWeight: 'var(--text-body-weight)', color: 'var(--text-body-color)' }}>
                                        {review.userId?.displayName || review.author || 'Anonymous'}
                                      </span>
                                    </div>
                                    <span className="helper">{review.date || formatReviewDate(review.createdAt)}</span>
                                  </div>
                                  <p style={{ fontFamily: 'var(--font-core)', fontSize: 'var(--text-body-size)', fontWeight: 'var(--text-body-weight)', color: 'var(--text-body-color)', lineHeight: 'var(--text-body-line-height)', paddingLeft: 36 }}>
                                    {review.text || review.comment}
                                  </p>
                                  {review.images?.[0]?.url && (
                                    <img
                                      src={review.images[0].url}
                                      alt={review.images[0].caption || 'Review image'}
                                      style={{ width: '100%', marginTop: 8, borderRadius: 6, maxHeight: 180, objectFit: 'cover' }}
                                      loading="lazy"
                                    />
                                  )}
                                </div>
                              ))}

                              {(!locationDetails?.reviews || locationDetails.reviews.length === 0) && (
                                <div className="card" style={{ padding: '20px 14px', textAlign: 'center' }}>
                                  <span className="helper">No reviews yet for this location.</span>
                                </div>
                              )}
                            </div>
                          </div>

                        </div>
                      )}
                    </div>
                  ) : (
                    /* Empty state — no location selected */
                    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: '0 24px' }}>
                      <div style={{
                        width: 56, height: 56, borderRadius: 6,
                        background: 'var(--surface-secondary)',
                        border: '1.5px solid var(--border-primary)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        marginBottom: 14,
                      }}>
                        <svg width="24" height="24" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24" style={{ color: 'var(--text-tertiary)' }}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                          <path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                        </svg>
                      </div>
                      <div style={{ fontFamily: 'var(--font-core)', fontSize: 'var(--text-h4-size)', fontWeight: 'var(--text-h4-weight)', color: 'var(--text-h4-color)', lineHeight: 'var(--text-h4-line-height)', marginBottom: 5 }}>
                        Select a Location
                      </div>
                      <p style={{ fontFamily: 'var(--font-core)', fontSize: 'var(--text-body-size)', fontWeight: 'var(--text-body-weight)', color: 'var(--text-body-color)', lineHeight: 'var(--text-body-line-height)', maxWidth: 220 }}>
                        Tap a pin on the map to explore its herbs, reviews, and directions.
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};

// Category-to-accent map for left-border colouring on the name card
const CATEGORY_ACCENT = {
  market: 'var(--border-brand)',
  shop: 'var(--border-brand)',
  foraging: 'var(--border-success)',
  pharmacy: 'var(--border-warning)',
  clinic: 'var(--border-accent)',
};

export default MapSidePanel;
