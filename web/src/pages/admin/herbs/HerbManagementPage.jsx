import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import herbService from '../../../services/herbService';
import Card from '../../../components/common/Card';
import Button from '../../../components/common/Button';
import Toggle from '../../../components/common/Toggle';
import Checkbox from '../../../components/common/Checkbox';
import Dropdown from '../../../components/common/Dropdown';
import SearchBar from '../../../components/common/SearchBar';
import Table from '../../../components/common/Table';
import Pagination from '../../../components/common/Pagination';
import AdminControlPanel from '../../../components/admin/AdminControlPanel';
import { useAdminList } from '../../../hooks/useAdminList';
import { formatTableData } from '../../../utils/adminUtils';
import AddEntityModal from '../../../components/modals/AddEntityModal';
import { SquarePen, Sprout, Circle, CircleOff } from 'lucide-react';
import { buildLooseSearchVariants } from '../../../utils/searchUtils';

const HerbsManagementPage = () => {
  const navigate = useNavigate();
  const [stats, setStats] = useState({ total: 0, active: 0, inactive: 0 });
  const [statsLoading, setStatsLoading] = useState(false);
  const [phytochemicalOptions, setPhytochemicalOptions] = useState([{ value: 'all', label: 'All Phytochemicals' }]);
  const [showAddModal, setShowAddModal] = useState(false);
  const fetchHerbsAdminWithFallback = useCallback(async (params = {}, config = {}) => {
    const rawSearch = typeof params?.search === 'string' ? params.search.trim() : '';
    const searchVariants = buildLooseSearchVariants(rawSearch);

    let response = null;
    for (let i = 0; i < searchVariants.length; i += 1) {
      const variant = searchVariants[i];
      const nextParams = { ...params, search: variant || undefined };
      response = await herbService.getHerbsAdmin(nextParams, config);
      const rows = Array.isArray(response?.data?.data)
        ? response.data.data
        : (Array.isArray(response?.data) ? response.data : []);
      if (!rawSearch || rows.length > 0 || i === searchVariants.length - 1) break;
    }

    return response;
  }, []);

  // Custom hook for list management
  const {
    items: herbs,
    setItems: setHerbs,
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
    fetchData: fetchHerbsAdminWithFallback,
    defaultFilters: { status: 'all', phytochemical: 'all', search: '' },
    defaultLimit: 5
  });

  // Load stats and options
  useEffect(() => {
    const loadMetadata = async () => {
      try {
        setStatsLoading(true);
        const statsData = await herbService.getHerbsStats();
        setStats(statsData || { total: 0, active: 0, inactive: 0 });

        // Static categories for now, as in previous version
        const categories = [
          { label: 'Alkaloids', value: 'alkaloids' },
          { label: 'Flavonoids', value: 'flavonoids' },
          { label: 'Terpenes', value: 'terpenoids' },
          { label: 'Phenolic Compounds', value: 'phenolic_compounds' },
          { label: 'Glycosides', value: 'glycosides' },
          { label: 'Essential Oils', value: 'essential_oils' },
          { label: 'Saponins', value: 'saponins' },
          { label: 'Tannins', value: 'tannins' },
        ];
        setPhytochemicalOptions([
          { value: 'all', label: 'All Phytochemicals' },
          ...categories
        ]);
      } catch (err) {
        console.error('Failed to load metadata:', err);
      } finally {
        setStatsLoading(false);
      }
    };
    loadMetadata();
  }, []);

  const handleToggleStatus = async (herbId, status) => {
    try {
      await herbService.toggleHerbStatus(herbId, status);
      setHerbs(prev => prev.map(h => h._id === herbId ? { ...h, isActive: status } : h));
      // Refresh stats in background
      herbService.getHerbsStats().then(setStats).catch(() => { });
    } catch (err) {
      console.error('Failed to toggle status:', err);
    }
  };

  const handleBulkStatusToggle = async (status) => {
    if (selectedIds.size === 0) return;
    try {
      await herbService.bulkToggleHerbStatus(Array.from(selectedIds), status);
      refresh();
      clearSelection();
      herbService.getHerbsStats().then(setStats).catch(() => { });
    } catch (err) {
      console.error('Failed bulk toggle:', err);
    }
  };

  const tableHeaders = useMemo(() => [
    <Checkbox
      id="select-all-herbs"
      checked={selectedIds.size === herbs.length && herbs.length > 0}
      onChange={() => selectedIds.size === herbs.length ? clearSelection() : selectAll(herbs.map(h => h._id))}
      admin size="md"
    />,
    'Image', 'Name', 'Scientific Name', 'Uses', 'Phytochemicals', 'Status', 'Actions'
  ], [selectedIds, herbs, clearSelection, selectAll]);

  const tableData = useMemo(() => formatTableData(herbs, (herb) => {
    const displayName = herb.commonNames?.[0] || herb.name || 'Unknown Herb';
    const uses = herb.symptoms || herb.properties || [];
    const isActive = herb.isActive !== false;
    const normalizedImages = (Array.isArray(herb.images) ? herb.images : [])
      .map((image) => {
        if (!image) return null;
        if (typeof image === 'string') return { url: image, isPrimary: false };
        return { url: image.url, isPrimary: Boolean(image.isPrimary) };
      })
      .filter((image) => Boolean(image?.url));
    const primaryImage = normalizedImages.find((image) => image.isPrimary) || normalizedImages[0];
    const imageUrl = primaryImage?.url || herb.image || 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=';

    return [
      <Checkbox
        id={`select-${herb._id}`}
        checked={selectedIds.has(herb._id)}
        onChange={() => toggleSelection(herb._id)}
        admin size="md"
      />,
      <img src={imageUrl} alt={displayName} className="w-12 h-12 object-cover rounded-md" />,
      <div className="text-primary font-medium">{displayName}</div>,
      <div className="text-tertiary text-sm italic">{herb.scientificName || 'N/A'}</div>,
      <div className="flex flex-wrap gap-1 max-w-[200px]">
        {uses.slice(0, 2).map((use, i) => (
          <span key={i} className="px-2 py-0.5 bg-interactive-brand-primary/10 text-brand text-[10px] rounded-full">
            {typeof use === 'object' ? use.name : use}
          </span>
        ))}
        {uses.length > 2 && <span className="text-tertiary">+{uses.length - 2} more</span>}
      </div>,
      <div className="flex flex-wrap gap-1 max-w-[200px]">
        {herb.phytochemicals?.slice(0, 2).map((p, i) => {
          const label = typeof p === 'string'
            ? p
            : (p?.compound?.name || p?.name || p?.compoundName || 'Unknown compound');
          return (
            <span key={i} className="px-2 py-0.5 bg-interactive-brand-primary/10 text-brand text-[10px] rounded-full">{label}</span>
          );
        })}
        {(!herb.phytochemicals || herb.phytochemicals.length === 0) && <span className="text-tertiary text-xs italic">No data</span>}
      </div>,
      <div className="flex items-center space-x-2">
        <Toggle checked={isActive} onChange={() => handleToggleStatus(herb._id, !isActive)} admin size="sm" />
      </div>,
      <Button
        variant="primary"
        onClick={() => navigate(`/admin/herbs/${herb.slug || herb._id}/edit`)}
        size="sm"
        aria-label={`Edit ${displayName}`}
      >
        <SquarePen className="w-4 h-4" />
      </Button>
    ];
  }), [herbs, selectedIds, navigate]);

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
                        onClick={() => handleBulkStatusToggle(true)}
                        disabled={selectedIds.size === 0}
                      >
                        Activate
                      </Button>
                      <Button
                        variant="danger"
                        size="sm"
                        onClick={() => handleBulkStatusToggle(false)}
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
                        variant="primary"
                        size="sm"
                        onClick={() => setShowAddModal(true)}
                      >
                        Add Herb
                      </Button>
                    </div>
                  </div>
                </Card>
              </div>

              {error && <div className="p-4 mb-4 bg-intent-danger/10 text-intent-danger rounded-lg text-sm">{error}</div>}

              <Table
                headers={tableHeaders}
                data={tableData}
                alternateRowColors
                loading={loading}
                className="border-border-primary"
              />

              {herbs.length === 0 && !loading && (
                <div className="text-center py-12 text-tertiary text-sm">No herbs found matching your criteria</div>
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
                onChange={(v) => handleFilterChange('search', v)}
                onSubmit={(v) => handleFilterChange('search', v)}
                placeholder="Search herbs..."
                className="w-full"
              />
            </div>
            <div className="adm-ctrl-field">
              <div className="adm-ctrl-label">Status</div>
              <Dropdown
                value={filters.status}
                onChange={(v) => handleFilterChange('status', v)}
                options={[{ value: 'all', label: 'All Status' }, { value: 'active', label: 'Active' }, { value: 'inactive', label: 'Inactive' }]}
                size="sm"
              />
            </div>
            <div className="adm-ctrl-field">
              <div className="adm-ctrl-label">Phytochemical</div>
              <Dropdown
                value={filters.phytochemical}
                onChange={(v) => handleFilterChange('phytochemical', v)}
                options={phytochemicalOptions}
                size="sm"
              />
            </div>
          </AdminControlPanel.Section>

          <AdminControlPanel.Section title="Statistics">
            <div className="adm-ctrl-stats">
              <div className="adm-ctrl-stat-row">
                <span className="adm-ctrl-stat-label flex items-center gap-2">
                  <Sprout size={14} />
                  Total
                </span>
                <span className="adm-ctrl-stat-value text-chart-1">{statsLoading ? '...' : stats.total}</span>
              </div>
              <div className="adm-ctrl-stat-row">
                <span className="adm-ctrl-stat-label flex items-center gap-2">
                  <Circle size={14} />
                  Active
                </span>
                <span className="adm-ctrl-stat-value text-chart-2">{statsLoading ? '...' : stats.active}</span>
              </div>
              <div className="adm-ctrl-stat-row">
                <span className="adm-ctrl-stat-label flex items-center gap-2">
                  <CircleOff size={14} />
                  Inactive
                </span>
                <span className="adm-ctrl-stat-value text-chart-3">{statsLoading ? '...' : stats.inactive}</span>
              </div>
            </div>
          </AdminControlPanel.Section>
        </AdminControlPanel>
      </div>

      <AddEntityModal
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        onSuccess={() => {
          refresh();
          herbService.getHerbsStats().then(setStats).catch(() => { });
        }}
        entityType="herb"
      />
    </div>
  );
};

export default HerbsManagementPage;
