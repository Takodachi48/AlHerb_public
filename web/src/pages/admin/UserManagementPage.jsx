import React, { useState, useEffect, useMemo } from 'react';
import Card from '../../components/common/Card';
import Button from '../../components/common/Button';
import Checkbox from '../../components/common/Checkbox';
import Dropdown from '../../components/common/Dropdown';
import SearchBar from '../../components/common/SearchBar';
import Table from '../../components/common/Table';
import Pagination from '../../components/common/Pagination';
import KebabMenu from '../../components/common/KebabMenu';
import AdminControlPanel from '../../components/admin/AdminControlPanel';
import ConfirmationModal from '../../components/modals/ConfirmationModal';
import { USER_ROLES } from '../../../../shared/constants/roles.js';
import userService from '../../services/userService';
import { useAdminList } from '../../hooks/useAdminList';
import { useAuth } from '../../hooks/useAuth';
import { formatTableData, formatDate } from '../../utils/adminUtils';
import { ShieldUser, Users, UserCheck, UserX, TrendingUp } from 'lucide-react';

const UserManagementPage = () => {
  const { user: currentUser } = useAuth();
  const [stats, setStats] = useState({ total: 0, active: 0, inactive: 0, newThisMonth: 0 });
  const [statsLoading, setStatsLoading] = useState(false);
  const [statusTemplates, setStatusTemplates] = useState([]);
  const [roleModalState, setRoleModalState] = useState({
    isOpen: false,
    userId: null,
    currentRole: USER_ROLES.USER,
    nextRole: USER_ROLES.MODERATOR,
    loading: false
  });
  const [modalState, setModalState] = useState({
    isOpen: false,
    action: 'activate',
    userIds: [],
    affectedCount: 0,
    reasonTemplateKey: '',
    loading: false
  });

  // Custom hook for list management
  const {
    items: users,
    setItems: setUsers,
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
    fetchData: userService.getAllUsers,
    defaultFilters: { role: 'all', status: 'all', search: '' },
    defaultLimit: 6
  });

  // Load stats
  const loadStats = async () => {
    try {
      setStatsLoading(true);
      const response = await userService.getUserStats();
      setStats(response.data || { total: 0, active: 0, inactive: 0, newThisMonth: 0 });
    } catch (err) {
      console.error('Error loading stats:', err);
    } finally {
      setStatsLoading(false);
    }
  };

  useEffect(() => {
    loadStats();
    const loadStatusTemplates = async () => {
      try {
        const response = await userService.getUserStatusEmailTemplates();
        setStatusTemplates(response.data || []);
      } catch (err) {
        console.error('Failed to load deactivation templates:', err);
      }
    };
    loadStatusTemplates();
  }, []);

  const openStatusConfirmation = ({ action, userIds }) => {
    setModalState({
      isOpen: true,
      action,
      userIds,
      affectedCount: userIds.length,
      reasonTemplateKey: statusTemplates[0]?.key || '',
      loading: false
    });
  };

  const closeStatusConfirmation = () => {
    if (modalState.loading) return;
    setModalState(prev => ({ ...prev, isOpen: false }));
  };

  const openRoleChangeModal = (user) => {
    const defaultNextRole = [USER_ROLES.ADMIN, USER_ROLES.MODERATOR, USER_ROLES.EXPERT]
      .find((role) => role !== user.role) || USER_ROLES.MODERATOR;
    setRoleModalState({
      isOpen: true,
      userId: user._id,
      currentRole: user.role,
      nextRole: defaultNextRole,
      loading: false
    });
  };

  const closeRoleChangeModal = () => {
    if (roleModalState.loading) return;
    setRoleModalState((prev) => ({ ...prev, isOpen: false }));
  };

  const executeRoleChange = async () => {
    if (!roleModalState.userId || !roleModalState.nextRole) return;
    try {
      setRoleModalState((prev) => ({ ...prev, loading: true }));
      await userService.updateUserRole(roleModalState.userId, roleModalState.nextRole);
      refresh();
      loadStats();
      setRoleModalState({
        isOpen: false,
        userId: null,
        currentRole: USER_ROLES.USER,
        nextRole: USER_ROLES.MODERATOR,
        loading: false
      });
    } catch (err) {
      console.error('Error updating user role:', err);
      setRoleModalState((prev) => ({ ...prev, loading: false }));
    }
  };

  const executeStatusAction = async () => {
    const isActive = modalState.action === 'activate';
    if (!isActive && !modalState.reasonTemplateKey) {
      return;
    }

    try {
      setModalState(prev => ({ ...prev, loading: true }));
      if (modalState.userIds.length === 1) {
        await userService.updateUserStatus(
          modalState.userIds[0],
          isActive,
          isActive ? null : modalState.reasonTemplateKey
        );
      } else {
        await userService.batchUpdateUserStatus(
          modalState.userIds,
          isActive,
          isActive ? null : modalState.reasonTemplateKey
        );
      }

      refresh();
      clearSelection();
      loadStats();
      setModalState({
        isOpen: false,
        action: 'activate',
        userIds: [],
        affectedCount: 0,
        reasonTemplateKey: '',
        loading: false
      });
    } catch (err) {
      console.error('Error updating user status:', err);
      setModalState(prev => ({ ...prev, loading: false }));
    }
  };

  const handleToggleUserStatus = async (userId, currentStatus) => {
    try {
      openStatusConfirmation({
        action: currentStatus ? 'deactivate' : 'activate',
        userIds: [userId]
      });
    } catch (err) {
      console.error('Error opening status modal:', err);
    }
  };

  const handleBatchAction = async (action) => {
    if (selectedIds.size === 0) return;
    try {
      openStatusConfirmation({ action, userIds: Array.from(selectedIds) });
    } catch (err) {
      console.error('Error in batch action:', err);
    }
  };

  const tableHeaders = [
    <Checkbox
      id="select-all"
      checked={selectedIds.size === users.filter(u => u.role !== USER_ROLES.ADMIN).length && users.filter(u => u.role !== USER_ROLES.ADMIN).length > 0}
      onChange={() => {
        const nonAdminUsers = users.filter(u => u.role !== USER_ROLES.ADMIN);
        const nonAdminIds = nonAdminUsers.map(u => u._id);
        selectedIds.size === nonAdminIds.length ? clearSelection() : selectAll(nonAdminIds);
      }}
      admin size="md"
    />,
    'User', 'Role', 'Status', 'Location', 'Last Login', 'Joined', 'Actions'
  ];

  const tableData = useMemo(() => formatTableData(users, (user) => {
    const isAdmin = user.role === USER_ROLES.ADMIN;
    const isModerator = user.role === USER_ROLES.MODERATOR;
    const isCurrentUser = currentUser?._id === user._id;
    const roleColors = {
      [USER_ROLES.USER]: 'bg-surface-primary text-secondary',
      [USER_ROLES.MODERATOR]: 'bg-interactive-brand-primary text-on-brand',
      [USER_ROLES.EXPERT]: 'bg-surface-warning text-warning',
      [USER_ROLES.ADMIN]: 'bg-interactive-danger text-on-danger'
    };

    const menuItems = [
      ...(!isModerator ? [{
        label: 'Change role',
        disabled: isCurrentUser,
        onClick: () => openRoleChangeModal(user),
      }] : []),
      {
        label: user.isActive ? 'Deactivate' : 'Activate',
        intent: user.isActive ? 'danger' : undefined,
        disabled: isCurrentUser && user.isActive,
        onClick: () => handleToggleUserStatus(user._id, user.isActive)
      }
    ];

    return [
      <Checkbox
        id={`select-${user._id}`}
        checked={selectedIds.has(user._id)}
        onChange={() => toggleSelection(user._id)}
        disabled={isAdmin}
        admin
      />,
      <div className="flex items-center">
        <div className="w-8 h-8 rounded-full bg-surface-secondary flex items-center justify-center mr-3 overflow-hidden text-xs font-bold text-tertiary">
          {user.photoURL ? <img src={user.photoURL} alt="" className="w-full h-full object-cover" /> : user.displayName?.charAt(0)}
        </div>
        <div>
          <div className="text-primary font-medium text-sm">{user.displayName}</div>
          <div className="text-tertiary">{user.email}</div>
        </div>
      </div>,
      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${roleColors[user.role] || 'bg-surface-secondary text-tertiary'}`}>
        {user.role}
      </span>,
      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${user.isActive ? 'bg-interactive-success text-on-success' : 'bg-surface-secondary text-tertiary'}`}>
        {user.isActive ? 'Active' : 'Inactive'}
      </span>,
      <div className="text-xs text-tertiary">{user.location ? `${user.location.city}, ${user.location.country}` : 'N/A'}</div>,
      <div className="text-tertiary">{formatDate(user.lastLogin)}</div>,
      <div className="text-tertiary">{formatDate(user.createdAt)}</div>,
      isAdmin ? (
        <span className="inline-flex items-center justify-center w-9 h-9 rounded-md text-tertiary" title="Admin user">
          <ShieldUser className="w-5 h-5" />
        </span>
      ) : (
        <KebabMenu items={menuItems} />
      )
    ];
  }), [users, selectedIds, currentUser]);

  return (
    <div className="bg-transparent">
      <div className="adm-page-shell">
        <div className="adm-page-main p-6">
          <Card className="border-border-primary">
            <div className="p-6">
              <div className="adm-table-toolbar">
                <div className="adm-table-toolbar-groups">
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
                          onClick={() => handleBatchAction('activate')}
                          disabled={selectedIds.size === 0}
                        >
                          Activate
                        </Button>
                        <Button
                          variant="danger"
                          size="sm"
                          onClick={() => handleBatchAction('deactivate')}
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
                </div>
              </div>

              {error && <div className="p-4 mb-4 bg-interactive-danger/10 text-intent-danger rounded-lg text-sm">{error}</div>}

              <Table
                headers={tableHeaders}
                data={tableData}
                alternateRowColors
                loading={loading}
                className="border-border-primary"
              />

              {users.length === 0 && !loading && (
                <div className="text-center py-12 text-tertiary text-sm">No users found matching your criteria</div>
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
                placeholder="Search users..."
                className="w-full"
              />
            </div>
            <div className="adm-ctrl-field">
              <div className="adm-ctrl-label">Role</div>
              <Dropdown
                value={filters.role}
                onChange={(v) => handleFilterChange('role', v)}
                options={[
                  { value: 'all', label: 'All Roles' },
                  { value: USER_ROLES.USER, label: 'User' },
                  { value: USER_ROLES.EXPERT, label: 'Expert' },
                  { value: USER_ROLES.MODERATOR, label: 'Moderator' },
                  { value: USER_ROLES.ADMIN, label: 'Admin' }
                ]}
                size="sm"
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
          </AdminControlPanel.Section>

          <AdminControlPanel.Section title="Statistics">
            <div className="adm-ctrl-stats">
              <div className="adm-ctrl-stat-row">
                <span className="adm-ctrl-stat-label flex items-center gap-2">
                  <Users size={14} />
                  Total
                </span>
                <span className="adm-ctrl-stat-value text-chart-1">{statsLoading ? '...' : stats.total}</span>
              </div>
              <div className="adm-ctrl-stat-row">
                <span className="adm-ctrl-stat-label flex items-center gap-2">
                  <UserCheck size={14} />
                  Active
                </span>
                <span className="adm-ctrl-stat-value text-chart-2">{statsLoading ? '...' : stats.active}</span>
              </div>
              <div className="adm-ctrl-stat-row">
                <span className="adm-ctrl-stat-label flex items-center gap-2">
                  <UserX size={14} />
                  Inactive
                </span>
                <span className="adm-ctrl-stat-value text-chart-3">{statsLoading ? '...' : stats.inactive}</span>
              </div>
              <div className="adm-ctrl-stat-row">
                <span className="adm-ctrl-stat-label flex items-center gap-2">
                  <TrendingUp size={14} />
                  New This Month
                </span>
                <span className="adm-ctrl-stat-value text-brand">{statsLoading ? '...' : stats.newThisMonth}</span>
              </div>
            </div>
          </AdminControlPanel.Section>
        </AdminControlPanel>
      </div>

      <ConfirmationModal
        isOpen={modalState.isOpen}
        onClose={closeStatusConfirmation}
        onConfirm={executeStatusAction}
        type={modalState.action === 'deactivate' ? 'danger' : 'success'}
        title={`${modalState.action === 'deactivate' ? 'Deactivate' : 'Activate'} ${modalState.affectedCount === 1 ? 'User' : 'Users'}`}
        message={`You are about to ${modalState.action} ${modalState.affectedCount} user${modalState.affectedCount !== 1 ? 's' : ''}. Please confirm to continue.`}
        confirmText={modalState.action === 'deactivate' ? 'Confirm Deactivation' : 'Confirm Activation'}
        loading={modalState.loading}
      >
        {modalState.action === 'deactivate' && (
          <div>
            <label className="block text-sm font-medium text-primary mb-2">
              Deactivation Email Reason
            </label>
            <select
              value={modalState.reasonTemplateKey}
              onChange={(e) => setModalState(prev => ({ ...prev, reasonTemplateKey: e.target.value }))}
              className="w-full rounded-lg border border-border-primary bg-surface-secondary text-primary px-3 py-2"
              disabled={modalState.loading}
            >
              {statusTemplates.map((template) => (
                <option key={template.key} value={template.key}>
                  {template.label}
                </option>
              ))}
            </select>
          </div>
        )}
      </ConfirmationModal>

      <ConfirmationModal
        isOpen={roleModalState.isOpen}
        onClose={closeRoleChangeModal}
        onConfirm={executeRoleChange}
        type="warning"
        title="Change User Role"
        message={`You are about to change this user's role from ${roleModalState.currentRole} to ${roleModalState.nextRole}.`}
        confirmText="Confirm Role Change"
        loading={roleModalState.loading}
      >
        <div>
          <label className="block text-sm font-medium text-primary mb-2">New Role</label>
          <Dropdown
            value={roleModalState.nextRole}
            onChange={(v) => setRoleModalState((prev) => ({ ...prev, nextRole: v }))}
            options={[
              { value: USER_ROLES.ADMIN, label: 'Admin' },
              { value: USER_ROLES.MODERATOR, label: 'Moderator' },
              { value: USER_ROLES.EXPERT, label: 'Expert' }
            ]}
            admin
            size="sm"
          />
        </div>
      </ConfirmationModal>
    </div>
  );
};

export default UserManagementPage;
