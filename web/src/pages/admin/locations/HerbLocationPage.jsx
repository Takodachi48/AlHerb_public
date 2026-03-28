import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import Button from '../../../components/common/Button';
import Card from '../../../components/common/Card';
import Checkbox from '../../../components/common/Checkbox';
import InteractiveMap from '../../../components/map/InteractiveMap';
import Dropdown from '../../../components/common/Dropdown';
import SearchBar from '../../../components/common/SearchBar';
import Pagination from '../../../components/common/Pagination';
import Toggle from '../../../components/common/Toggle';
import Table from '../../../components/common/Table';
import AdminControlPanel from '../../../components/admin/AdminControlPanel';
import locationService from '../../../services/locationService';
import { useAdminList } from '../../../hooks/useAdminList';
import { formatTableData } from '../../../utils/adminUtils';
import { SquarePen, MapPin, Globe, Compass, Map } from 'lucide-react';
import { buildLooseSearchVariants } from '../../../utils/searchUtils';
import AddEntityModal from '../../../components/modals/AddEntityModal';

const HerbLocationPage = () => {
  const [showMapModal, setShowMapModal] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedLocationId, setSelectedLocationId] = useState(null);
  const [isSubmittingLocation, setIsSubmittingLocation] = useState(false);
  const [newLocationError, setNewLocationError] = useState('');
  const [newLocationFieldErrors, setNewLocationFieldErrors] = useState({});
  const [actionError, setActionError] = useState('');
  const [newLocationForm, setNewLocationForm] = useState({
    name: '',
    type: 'market',
    lat: '',
    lng: '',
    description: '',
    isActive: true,
    verified: false
  });
  const fetchLocationsWithFallback = useCallback(async (params = {}, config = {}) => {
    const rawSearch = typeof params?.search === 'string' ? params.search.trim() : '';
    const searchVariants = buildLooseSearchVariants(rawSearch);

    let response = null;
    for (let i = 0; i < searchVariants.length; i += 1) {
      const variant = searchVariants[i];
      const nextParams = { ...params, search: variant || undefined };
      response = await locationService.fetchLocationsWithPagination(nextParams, config);
      const rows = Array.isArray(response?.data?.data)
        ? response.data.data
        : (Array.isArray(response?.data) ? response.data : []);
      if (!rawSearch || rows.length > 0 || i === searchVariants.length - 1) break;
    }

    return response;
  }, []);

  // Custom hook for list management
  const {
    items: locations,
    setItems: setLocations,
    loading,
    error,
    filters,
    pagination,
    selectedIds,
    handlePageChange,
    handleFilterChange,
    toggleSelection,
    selectAll,
    clearSelection,
    refresh
  } = useAdminList({
    fetchData: fetchLocationsWithFallback,
    defaultFilters: { category: 'all', status: 'all', search: '' },
    defaultLimit: 6
  });

  // Map ref for synchronization
  const mapRef = useRef(null);
  const tableRef = useRef(null);

  // Global stats state
  const [globalStats, setGlobalStats] = useState({
    total: 0,
    byType: {}
  });
  const [statsLoading, setStatsLoading] = useState(false);

  // Dynamic dropdown options
  const [categoryOptions, setCategoryOptions] = useState([{ value: 'all', label: 'All Location Types' }]);
  const [statusOptions, setStatusOptions] = useState([
    { value: 'all', label: 'All Status' },
    { value: 'active', label: 'Active' },
    { value: 'inactive', label: 'Inactive' }
  ]);

  // Load initial options and stats
  useEffect(() => {
    const loadInitialData = async () => {
      try {
        setStatsLoading(true);
        const [categoriesResponse, statusesResponse, statsResponse] = await Promise.all([
          locationService.fetchUniqueCategories(),
          locationService.fetchUniqueStatuses(),
          locationService.fetchLocationStats()
        ]);

        if (categoriesResponse?.categories) {
          const dynamicCategories = categoriesResponse.categories.map(cat => ({
            value: cat,
            label: cat.charAt(0).toUpperCase() + cat.slice(1)
          }));
          setCategoryOptions([{ value: 'all', label: 'All Location Types' }, ...dynamicCategories]);
        }

        if (statusesResponse?.statuses) {
          const dynamicStatuses = statusesResponse.statuses.map(status => ({
            value: status,
            label: status.charAt(0).toUpperCase() + status.slice(1)
          }));
          setStatusOptions([{ value: 'all', label: 'All Status' }, ...dynamicStatuses]);
        }

        if (statsResponse?.stats) {
          setGlobalStats(statsResponse.stats);
        } else if (typeof statsResponse === 'object' && statsResponse !== null && statsResponse.total !== undefined) {
          setGlobalStats(statsResponse);
        }
      } catch (error) {
        console.error('Failed to load initial data:', error);
        setActionError(error?.message || 'Failed to load location metadata.');
      } finally {
        setStatsLoading(false);
      }
    };
    loadInitialData();
  }, []);

  // Sync selection between Table and Map
  const handleRowSelect = (locationId) => {
    setSelectedLocationId(locationId);

    // Center map on selected location if available
    const location = locations.find(loc => loc._id === locationId || loc.id === locationId);
    if (location && mapRef.current) {
      const coords = location.coordinates || {
        lat: location.location?.coordinates?.[1],
        lng: location.location?.coordinates?.[0]
      };
      if (coords.lat && coords.lng) {
        mapRef.current.centerOn(coords);
        mapRef.current.highlightMarker(locationId);
      }
    }
  };

  const handleMarkerClick = (locationId) => {
    setSelectedLocationId(locationId);

    // Scroll table row into view
    const rowElement = document.querySelector(`[data-location-id="${locationId}"]`);
    if (rowElement && tableRef.current) {
      rowElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  };

  const handleToggleStatus = async (locationId, newStatus) => {
    try {
      setActionError('');
      await locationService.updateLocation(locationId, { isActive: newStatus });

      // Optimistic update of local state
      setLocations(prev => prev.map(loc =>
        (loc._id === locationId || loc.id === locationId)
          ? { ...loc, isActive: newStatus }
          : loc
      ));
    } catch (err) {
      console.error('Error toggling location status:', err);
      setActionError(err?.message || err?.error || 'Failed to update location status.');
    }
  };

  const handleBulkAction = async (action) => {
    if (selectedIds.size === 0) return;
    try {
      setActionError('');
      const isActive = action === 'activate';
      // Update all selected locations
      const promises = Array.from(selectedIds).map(id =>
        locationService.updateLocation(id, { isActive })
      );
      await Promise.all(promises);

      refresh();
      clearSelection();
    } catch (err) {
      console.error('Error in bulk action:', err);
      setActionError(err?.message || err?.error || 'Failed to update selected locations.');
    }
  };

  const resetNewLocationForm = () => {
    setNewLocationForm({
      name: '',
      type: 'market',
      lat: '',
      lng: '',
      description: '',
      isActive: true,
      verified: false
    });
    setNewLocationError('');
    setNewLocationFieldErrors({});
  };

  const openAddLocationModal = () => {
    resetNewLocationForm();
    setShowAddModal(true);
  };

  const closeAddLocationModal = () => {
    if (isSubmittingLocation) return;
    setShowAddModal(false);
    resetNewLocationForm();
  };

  const handleNewLocationInputChange = (field, value) => {
    setNewLocationForm(prev => ({
      ...prev,
      [field]: value
    }));
    if (newLocationFieldErrors[field]) {
      setNewLocationFieldErrors(prev => ({ ...prev, [field]: '' }));
    }
  };

  const validateNewLocationForm = () => {
    const name = newLocationForm.name.trim();
    const lat = Number(newLocationForm.lat);
    const lng = Number(newLocationForm.lng);
    const errors = {};

    if (!name) errors.name = 'Location name is required.';
    if (!Number.isFinite(lat)) errors.lat = 'Enter a valid latitude.';
    if (!Number.isFinite(lng)) errors.lng = 'Enter a valid longitude.';
    if (Number.isFinite(lat) && (lat < 4 || lat > 21)) {
      errors.lat = 'Latitude must be within Philippines bounds (4 to 21).';
    }
    if (Number.isFinite(lng) && (lng < 116 || lng > 127)) {
      errors.lng = 'Longitude must be within Philippines bounds (116 to 127).';
    }

    return errors;
  };

  const handleCreateLocation = async (e) => {
    e.preventDefault();
    const validationErrors = validateNewLocationForm();

    if (Object.keys(validationErrors).length > 0) {
      setNewLocationFieldErrors(validationErrors);
      setNewLocationError('Please fix the highlighted fields.');
      return;
    }

    try {
      setIsSubmittingLocation(true);
      setNewLocationError('');
      setNewLocationFieldErrors({});
      setActionError('');

      const lat = Number(newLocationForm.lat);
      const lng = Number(newLocationForm.lng);
      const payload = {
        name: newLocationForm.name.trim(),
        type: newLocationForm.type,
        location: {
          type: 'Point',
          coordinates: [lng, lat]
        },
        description: newLocationForm.description.trim(),
        isActive: Boolean(newLocationForm.isActive),
        verified: Boolean(newLocationForm.verified),
        herbs: [],
        images: []
      };

      await locationService.createLocation(payload);
      closeAddLocationModal();
      refresh();
    } catch (err) {
      console.error('Error creating location:', err);
      setNewLocationError(err?.message || err?.error || 'Failed to create location.');
    } finally {
      setIsSubmittingLocation(false);
    }
  };

  // Table data transformation
  const tableData = useMemo(() => formatTableData(locations, (location) => {
    const id = location._id || location.id;
    const [lng, lat] = location.location?.coordinates || [];
    const derived = location.derivedLocation || {};
    const locationLabel = [derived.city, derived.province, derived.country].filter(Boolean).join(', ')
      || ((Number.isFinite(lat) && Number.isFinite(lng)) ? `${lat.toFixed(4)}, ${lng.toFixed(4)}` : 'Coordinates unavailable');

    return [
      <Checkbox
        id={`select-${id}`}
        checked={selectedIds.has(id)}
        onChange={() => toggleSelection(id)}
        admin size="md"
      />,
      <div className="text-sm font-medium text-primary">{location.name}</div>,
      <div className="text-sm text-tertiary">{locationLabel}</div>,
      <div className="text-sm text-tertiary capitalize">{location.type}</div>,
      <div className="text-sm text-tertiary">
        {location.herbs && location.herbs.length > 0
          ? location.herbs.slice(0, 3).map(h => h.herbId?.name || h.herbId?.scientificName || 'Unknown herb').join(', ') + (location.herbs.length > 3 ? '...' : '')
          : 'No herbs'
        }
      </div>,
      <div className="flex items-center space-x-2">
        <Toggle
          checked={location.isActive}
          onChange={() => handleToggleStatus(id, !location.isActive)}
          admin
          size="sm"
        />
      </div>,
      <Button
        variant="primary"
        onClick={(e) => {
          e.stopPropagation();
        }}
        size="sm"
        aria-label={`Edit ${location.name}`}
      >
        <SquarePen className="w-4 h-4" />
      </Button>
    ];
  }), [locations, selectedIds]);

  const tableHeaders = [
    <Checkbox
      id="select-all-locations"
      checked={selectedIds.size === locations.length && locations.length > 0}
      onChange={() => selectedIds.size === locations.length ? clearSelection() : selectAll(locations.map(l => l._id || l.id))}
      admin size="md"
    />,
    'Name', 'Address', 'Type', 'Herbs', 'Status', 'Actions'
  ];

  const typeStatColors = [
    'text-chart-2',
    'text-chart-3',
    'text-chart-4',
    'text-chart-5',
    'text-chart-6'
  ];

  const typeStats = useMemo(() => {
    const byType = globalStats?.byType || {};
    return Object.entries(byType)
      .map(([type, count]) => ({
        key: type,
        label: String(type).charAt(0).toUpperCase() + String(type).slice(1),
        count: Number(count) || 0
      }))
      .sort((a, b) => b.count - a.count);
  }, [globalStats]);

  return (
    <div className="bg-transparent">
      <div className="adm-page-shell">
        <div className="adm-page-main p-6">
          <Card className="border-border-primary">
            <div className="p-6">
              <div className="adm-table-toolbar">
                <Card className="adm-table-toolbar-card border-border-primary" padding="sm">
                  <div className="eyebrow">
                    <div className="eyebrow-bar" />
                    <span className="eyebrow-text">Bulk</span>
                  </div>
                  <div className="adm-table-toolbar-body">
                    <div className="adm-table-toolbar-copy">
                      {selectedIds.size} selected
                    </div>
                    <div className="adm-table-toolbar-actions">
                      <Button
                        variant="primary"
                        size="sm"
                        onClick={() => handleBulkAction('activate')}
                        disabled={selectedIds.size === 0}
                      >
                        Activate
                      </Button>
                      <Button
                        variant="danger"
                        size="sm"
                        onClick={() => handleBulkAction('deactivate')}
                        disabled={selectedIds.size === 0}
                      >
                        Deactivate
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={clearSelection}
                        disabled={selectedIds.size === 0}
                      >
                        Clear
                      </Button>
                    </div>
                  </div>
                </Card>

                <Card className="adm-table-toolbar-card border-border-primary" padding="sm">
                  <div className="eyebrow">
                    <div className="eyebrow-bar" />
                    <span className="eyebrow-text">Quick</span>
                  </div>
                  <div className="adm-table-toolbar-body">
                    <div className="adm-table-toolbar-actions">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setShowMapModal(true)}
                      >
                        View Map
                      </Button>
                      <Button
                        variant="primary"
                        size="sm"
                        onClick={openAddLocationModal}
                      >
                        Add Location
                      </Button>
                    </div>
                  </div>
                </Card>
              </div>

              {error && <div className="p-4 mb-4 bg-interactive-danger/10 text-intent-danger rounded-lg text-sm">{error}</div>}
              {actionError && <div className="p-4 mb-4 bg-interactive-danger/10 text-intent-danger rounded-lg text-sm">{actionError}</div>}

              <Table
                headers={tableHeaders}
                data={tableData}
                alternateRowColors
                loading={loading}
                onRowClick={(_, index) => handleRowSelect(locations[index]._id || locations[index].id)}
                rowClassName={(_, index) => (selectedLocationId === (locations[index]._id || locations[index].id)) ? 'bg-interactive-brand-primary/10' : ''}
                dataAttributes={(index) => ({ 'data-location-id': locations[index]._id || locations[index].id })}
              />

              {locations.length === 0 && !loading && (
                <div className="text-center py-12 text-alt text-sm">No locations found matching your criteria</div>
              )}

              {pagination.totalPages > 1 && (
                <div className="mt-6">
                  <Pagination
                    currentPage={pagination.page}
                    totalPages={pagination.totalPages}
                    total={pagination.total}
                    limit={pagination.limit}
                    onPageChange={handlePageChange}
                    admin
                  />
                </div>
              )}
            </div>
          </Card>
        </div>

        <AdminControlPanel>
          <AdminControlPanel.Section title="Filters">
            <div className="adm-ctrl-field">
              <div className="adm-ctrl-label">Search</div>
              <SearchBar
                value={filters.search || ''}
                onChange={(val) => handleFilterChange('search', val)}
                onSubmit={(val) => handleFilterChange('search', val)}
                placeholder="Search locations..."
                className="w-full"
              />
            </div>
            <div className="adm-ctrl-field">
              <div className="adm-ctrl-label">Location Type</div>
              <Dropdown
                value={filters.category}
                onChange={(val) => handleFilterChange('category', val)}
                options={categoryOptions}
                size="sm"
              />
            </div>
            <div className="adm-ctrl-field">
              <div className="adm-ctrl-label">Status</div>
              <Dropdown
                value={filters.status}
                onChange={(val) => handleFilterChange('status', val)}
                options={statusOptions}
                size="sm"
              />
            </div>
          </AdminControlPanel.Section>

          <AdminControlPanel.Section title="Statistics">
            <div className="adm-ctrl-stats">
              <div className="adm-ctrl-stat-row">
                <span className="adm-ctrl-stat-label flex items-center gap-2">
                  <Globe size={14} />
                  Total
                </span>
                <span className="adm-ctrl-stat-value text-chart-1">{statsLoading ? '...' : (globalStats.total || 0)}</span>
              </div>
              {typeStats.map((typeStat, index) => {
                const getIcon = (label) => {
                  if (label.toLowerCase().includes('province')) return <Compass size={14} />;
                  if (label.toLowerCase().includes('city')) return <MapPin size={14} />;
                  if (label.toLowerCase().includes('municipality')) return <Map size={14} />;
                  return <MapPin size={14} />;
                };
                return (
                  <div key={typeStat.key} className="adm-ctrl-stat-row">
                    <span className="adm-ctrl-stat-label flex items-center gap-2">
                      {getIcon(typeStat.label)}
                      {typeStat.label}
                    </span>
                    <span className={`adm-ctrl-stat-value ${typeStatColors[index % typeStatColors.length]}`}>
                      {statsLoading ? '...' : typeStat.count}
                    </span>
                  </div>
                );
              })}
            </div>
          </AdminControlPanel.Section>
        </AdminControlPanel>
      </div>

      {/* Map Modal */}
      {showMapModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-surface-primary rounded-lg p-6 max-w-6xl w-full h-[85vh] flex flex-col border border-border-primary shadow-2xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-semibold text-primary">Locations Map</h3>
              <button onClick={() => setShowMapModal(false)} className="text-tertiary hover:text-primary">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>

            <div className="flex-1 rounded-lg overflow-hidden border border-border-primary">
              <InteractiveMap
                ref={mapRef}
                locations={locations}
                selectedLocationId={selectedLocationId}
                onMarkerClick={handleMarkerClick}
                readOnly
                showControls
                className="w-full h-full"
              />
            </div>
            <div className="mt-4 text-center text-xs text-tertiary">
              Click table rows to center map • Click markers to identify rows
            </div>
          </div>
        </div>
      )}

      {/* Add Location Modal */}
      <AddEntityModal
        isOpen={showAddModal}
        onClose={closeAddLocationModal}
        onSuccess={() => {
          refresh();
          locationService.getLocationStats().then(setStats).catch(() => {});
        }}
        entityType="location"
      />
    </div>
  );
};

export default HerbLocationPage;
