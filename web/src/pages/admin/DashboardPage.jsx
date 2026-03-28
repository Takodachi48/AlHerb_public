import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Link } from 'react-router-dom';
import Card from '../../components/common/Card';
import Button from '../../components/common/Button';
import Loading from '../../components/common/Loading';
import StatGraph from '../../components/common/StatGraph';
import ConfirmationModal from '../../components/modals/ConfirmationModal';
import adminService from '../../services/adminService';
import { CustomToggle, StatusCard } from '../../components/custom';
import { useLoaderActions } from '../../hooks/useLoader';
import { RefreshCw } from 'lucide-react';
import '../../styles/components/StatusCard.css';
import '../../styles/components/AdminDashboard.css';

/* â”€â”€ Shared sub-components â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */

const SectionHead = ({ num, name, badge, button }) => (
  <div className="flex items-end gap-0 mb-4">
    <span className="font-mono text-xs font-normal tracking-widest text-on-neutral bg-interactive-neutral-primary px-3 py-1 flex items-center flex-shrink-0 rounded-l-md">{num} /</span>
    <span className="font-mono text-xs font-medium tracking-widest uppercase text-primary bg-surface-secondary border border-l-0 border-border-primary px-3 py-1 flex items-center">{name}</span>
    <div className="flex-1 border-b border-border-primary self-end" />
    {badge && <div className="flex-shrink-0 flex items-center pl-3">{badge}</div>}
    {button && <div className="flex-shrink-0 flex items-center pl-3">{button}</div>}
  </div>
);

const SeverityBadge = ({ severity = 'ok', label }) => {
  const classMap = {
    ok: 'bg-interactive-success text-on-dark border-interactive-success',
    warning: 'bg-interactive-warning text-on-dark border-interactive-warning',
    critical: 'bg-interactive-danger text-on-dark border-interactive-danger',
  };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs border ${classMap[severity] || classMap.ok}`}>
      {label}
    </span>
  );
};

const HOUR_LABELS = Array.from({ length: 24 }, (_, hour) => `${String(hour).padStart(2, '0')}:00`);

const toHourlySeries = (source = [], todayTotal = 0) => {
  const hourly = Array(24).fill(0);
  let hasHourlyPoints = false;

  source.forEach((item) => {
    const rawKey = String(item?.key || item?.label || item?.hour || item?.date || '').trim();
    if (!rawKey) return;

    const match = rawKey.match(/^(\d{1,2})/);
    if (!match) return;
    const hour = Number(match[1]);
    if (!Number.isFinite(hour) || hour < 0 || hour > 23) return;

    hourly[hour] = Number(item?.value) || 0;
    hasHourlyPoints = true;
  });

  if (!hasHourlyPoints) {
    const currentHour = new Date().getHours();
    hourly[currentHour] = Number(todayTotal) || 0;
  }

  return hourly;
};

/* â”€â”€ Main component â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */

const DashboardPage = () => {
  const [storageData, setStorageData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [turnstileEnabled, setTurnstileEnabled] = useState(true);
  const [securityLoading, setSecurityLoading] = useState(true);
  const [securitySaving, setSecuritySaving] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [pendingValue, setPendingValue] = useState(null);
  const [overview, setOverview] = useState(null);
  const [dashboardOverview, setDashboardOverview] = useState(null);
  const [monitoringError, setMonitoringError] = useState('');
  const [dashboardRefreshing, setDashboardRefreshing] = useState(false);
  const [trendWindow, setTrendWindow] = useState('7d');
  const overviewRequestSeqRef = useRef(0);
  const storageRequestSeqRef = useRef(0);
  const securityRequestSeqRef = useRef(0);
  const hasLoadedStorageRef = useRef(false);
  const analyticsPrefetchRef = useRef(false);
  const { addTask, completeTask } = useLoaderActions();

  const fetchStorageData = useCallback(async (forceRefresh = false) => {
    const requestId = storageRequestSeqRef.current + 1;
    storageRequestSeqRef.current = requestId;
    const taskId = `admin-dashboard:storage:${requestId}`;
    addTask(taskId);
    try {
      if (forceRefresh) {
        setRefreshing(true);
      } else if (!hasLoadedStorageRef.current) {
        setLoading(true);
      }
      setError(null);
      const data = await adminService.getStorageUsage({ forceRefresh });
      if (requestId !== storageRequestSeqRef.current) return;
      setStorageData(data);
      hasLoadedStorageRef.current = true;
    } catch (err) {
      if (requestId !== storageRequestSeqRef.current) return;
      console.error('Error fetching storage data:', err);
      setError(err.message || 'Failed to fetch storage data');
    } finally {
      completeTask(taskId);
      if (requestId === storageRequestSeqRef.current) {
        if (forceRefresh) setRefreshing(false);
        setLoading(false);
      }
    }
  }, [addTask, completeTask]);

  useEffect(() => { fetchStorageData(); }, [fetchStorageData]);

  const applyDashboardBundle = useCallback((bundle) => {
    if (!bundle) return;
    setOverview(bundle.overview || null);
    setDashboardOverview(bundle.dashboard || null);
  }, []);

  const loadOverview = useCallback(async (options = {}) => {
    const { forceRefresh = false } = options;
    const requestId = overviewRequestSeqRef.current + 1;
    overviewRequestSeqRef.current = requestId;
    const taskId = `admin-dashboard:overview:${requestId}`;
    addTask(taskId);
    try {
      setMonitoringError('');
      const cachedBundle = forceRefresh ? null : adminService.getCachedDashboardBundle(30);
      if (cachedBundle) {
        applyDashboardBundle(cachedBundle);
      }
      setDashboardRefreshing(true);

      const liveBundle = await adminService.getDashboardBundle(30, { forceRefresh });
      if (requestId !== overviewRequestSeqRef.current) return;
      applyDashboardBundle(liveBundle);
    } catch (err) {
      if (requestId !== overviewRequestSeqRef.current) return;
      setMonitoringError(err.message || 'Failed to load overview metrics');
    } finally {
      completeTask(taskId);
      if (requestId === overviewRequestSeqRef.current) {
        setDashboardRefreshing(false);
      }
    }
  }, [applyDashboardBundle, addTask, completeTask]);

  useEffect(() => { loadOverview(); }, [loadOverview]);

  useEffect(() => {
    let streamHandle = null;
    let cancelled = false;

    adminService.connectMonitoringStream({
      sections: ['overview', 'dashboard'],
      days: 30,
      intervalMs: 15000,
      onMessage: ({ event, data }) => {
        if (event !== 'snapshot' || !data) return;
        adminService.hydrateDashboardCacheFromSnapshot(30, data);
        if (data.overview) setOverview(data.overview);
        if (data.dashboard) setDashboardOverview(data.dashboard);
      },
      onError: () => { },
    })
      .then((handle) => {
        if (cancelled) {
          handle.close();
          return;
        }
        streamHandle = handle;
      })
      .catch(() => { });

    return () => {
      cancelled = true;
      if (streamHandle) streamHandle.close();
    };
  }, []);

  useEffect(() => {
    const fetchSecuritySettings = async () => {
      const requestId = securityRequestSeqRef.current + 1;
      securityRequestSeqRef.current = requestId;
      const taskId = `admin-dashboard:security:${requestId}`;
      addTask(taskId);
      try {
        setSecurityLoading(true);
        const settings = await adminService.getSecuritySettings();
        if (requestId !== securityRequestSeqRef.current) return;
        setTurnstileEnabled(typeof settings?.turnstileEnabled === 'boolean' ? settings.turnstileEnabled : true);
      } catch (err) { console.error('Error fetching security settings:', err); }
      finally {
        completeTask(taskId);
        if (requestId === securityRequestSeqRef.current) {
          setSecurityLoading(false);
        }
      }
    };
    fetchSecuritySettings();
  }, [addTask, completeTask]);

  const handleTurnstileToggle = async (nextValue) => {
    try {
      setSecuritySaving(true);
      const result = await adminService.updateSecuritySettings({ turnstileEnabled: nextValue });
      setTurnstileEnabled(typeof result?.turnstileEnabled === 'boolean' ? result.turnstileEnabled : nextValue);
    } catch (err) { console.error('Error updating security settings:', err); }
    finally { setSecuritySaving(false); }
  };

  const handleConfirm = () => { setShowConfirmModal(false); handleTurnstileToggle(pendingValue); setPendingValue(null); };
  const handleCancel = () => { setShowConfirmModal(false); setPendingValue(null); };

  const getDataQualitySeverity = () => {
    const ms = overview?.herbs?.missingSafetyProfile || 0;
    const md = overview?.users?.missingDemographics || 0;
    if (ms >= 50 || md >= 100) return { severity: 'critical', label: 'Needs action' };
    if (ms >= 10 || md >= 20) return { severity: 'warning', label: 'Needs review' };
    return { severity: 'ok', label: 'Healthy' };
  };

  const today = dashboardOverview?.today || null;
  const trends = dashboardOverview?.trends || {};
  const attention = dashboardOverview?.attention || {};

  const trendLabels = (trends.signups || trends.blogsCreated || trends.inquiries || trends.classifications || [])
    .slice(-7).map((item) => item.key || '');
  const trendSeries = useMemo(() => ([
    { label: 'Signups', color: '--chart-9', data: (trends.signups || []).slice(-7).map((item) => item.value) },
    { label: 'Blogs', color: '--chart-5', data: (trends.blogsCreated || []).slice(-7).map((item) => item.value) },
    { label: 'Inquiries', color: '--chart-3', data: (trends.inquiries || []).slice(-7).map((item) => item.value) },
    { label: 'Classifications', color: '--chart-11', data: (trends.classifications || []).slice(-7).map((item) => item.value) },
  ]), [trends]);
  const selectedTrendLabels = trendWindow === 'today' ? HOUR_LABELS : trendLabels.slice(-7);
  const selectedTrendSeries = useMemo(
    () => (
      trendWindow === 'today'
        ? [
          { label: 'Signups', color: '--chart-9', data: toHourlySeries(trends.signups, today?.counts?.signups) },
          { label: 'Blogs', color: '--chart-5', data: toHourlySeries(trends.blogsCreated, today?.counts?.blogsCreated) },
          { label: 'Inquiries', color: '--chart-3', data: toHourlySeries(trends.inquiries, today?.counts?.inquiries) },
          { label: 'Classifications', color: '--chart-11', data: toHourlySeries(trends.classifications, today?.counts?.classifications) },
        ]
        : trendSeries.map((seriesItem) => ({ ...seriesItem, data: seriesItem.data.slice(-7) }))
    ),
    [trendWindow, trendSeries, trends, today]
  );

  const quickActions = [
    { label: 'Review Blogs', path: '/admin/blog', icon: 'M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2' },
    { label: 'Manage Herbs', path: '/admin/herbs', icon: 'M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z' },
    { label: 'Open Analytics', path: '/admin/analytics', icon: 'M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z' },
    { label: 'Assets', path: '/admin/assets', icon: 'M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z' },
  ];

  const attentionLabels = ['Pending blog revisions', 'Missing safety profiles', 'Missing demographics', 'API 5xx errors today'];
  const attentionValues = [
    attention.pendingBlogReview ?? 0, attention.missingSafetyProfile ?? 0,
    attention.missingDemographics ?? 0, attention.requests5xxToday ?? 0,
  ];
  const graphReveal = 'slide';

  const prefetchAnalytics = useCallback(() => {
    if (analyticsPrefetchRef.current) return;
    analyticsPrefetchRef.current = true;
    const defaults = { statusClass: 'all', endpoint: '', search: '' };
    adminService.prefetchMonitoringBundle(7, defaults);
    import('./AnalyticsPage');
    import('../../components/common/StatGraph');
  }, []);

  if (error) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
        <Card>
          <div className="text-center py-8">
            <svg className="w-10 h-10 text-danger mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <h3 className="text-sm font-semibold text-danger mb-1">Error Loading Data</h3>
            <p className="text-xs text-tertiary">{error}</p>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-5">

      {monitoringError && (
        <div className="p-3 border border-danger rounded-md bg-surface-danger text-sm text-danger">{monitoringError}</div>
      )}

      {/* â• â• â•  01 / SYSTEM OVERVIEW â• â• â•  */}
      <section className="animate-slide-up">
        <SectionHead num="01" name="System Overview" badge={<SeverityBadge {...getDataQualitySeverity()} />} button={<Button size="sm" variant="ghost" onClick={() => loadOverview({ forceRefresh: true })} disabled={dashboardRefreshing}><RefreshCw className="w-2 h-2" /></Button>} />
        <div className="adm-stat-row">
          <div className="adm-stat-cell adm-stat-cell--accent">
            <span className="adm-stat-key">Users</span>
            <span className="adm-stat-val">{overview?.users?.total ?? 0}</span>
            <span className="adm-stat-sub">Missing demographics: {overview?.users?.missingDemographics ?? 0}</span>
          </div>
          <div className="adm-stat-cell adm-stat-cell--accent">
            <span className="adm-stat-key">Herbs</span>
            <span className="adm-stat-val">{overview?.herbs?.total ?? 0}</span>
            <span className="adm-stat-sub">Missing safety: {overview?.herbs?.missingSafetyProfile ?? 0}</span>
          </div>
          <div className="adm-stat-cell adm-stat-cell--accent">
            <span className="adm-stat-key">Phytochemicals</span>
            <span className="adm-stat-val">{overview?.domain?.phytochemicals ?? 0}</span>
            <span className="adm-stat-sub">Red-flag symptoms: {overview?.domain?.redFlagSymptoms ?? 0}</span>
          </div>
          <div className="adm-stat-cell adm-stat-cell--accent">
            <span className="adm-stat-key">Locations</span>
            <span className="adm-stat-val">{overview?.domain?.locations ?? 0}</span>
            <span className="adm-stat-sub">Symptoms: {overview?.domain?.symptoms ?? 0}</span>
          </div>
        </div>
      </section>

      {/* 02 / ATTENTION + 03 / QUICK ACTIONS */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-5">
        <section className="animate-slide-up lg:col-span-3">
          <SectionHead num="02" name="Attention Required" />
          <Card 
            padding="sm" 
            className="border-border-primary"
            style={{ height: `${Math.max(295, attentionLabels.length * 34)}px` }}
          >
            {attentionValues.some(v => v > 0) ? (
              <StatGraph
                variant="hbar"
                deferUntilVisible
                reveal={graphReveal}
                series={[{ label: 'Count', color: '--chart-2', data: attentionValues }]}
                labels={attentionLabels}
                height={Math.max(140, attentionLabels.length * 34)}
                showAxes
              />
            ) : (
              <div className="text-sm text-tertiary py-4 text-center">All clear — no items require attention.</div>
            )}
          </Card>
        </section>

        <div className="animate-slide-up lg:col-span-1 space-y-5">
          <section>
            <SectionHead num="03" name="Quick Actions" />
            <Card 
              padding="sm" 
              className="border-border-primary"
              style={{ height: `${Math.max(295, attentionLabels.length * 34)}px` }}
            >
              <div className="grid grid-cols-2 gap-3 h-full place-content-center">
                {quickActions.map((a) => (
                  <Link key={a.path} to={a.path}
                    onMouseEnter={a.path === '/admin/analytics' ? prefetchAnalytics : undefined}
                    onFocus={a.path === '/admin/analytics' ? prefetchAnalytics : undefined}
                    className="flex items-center gap-3 p-4 border border-border-primary rounded-lg bg-surface-secondary hover:bg-surface-tertiary hover:border-brand transition-colors text-sm font-medium text-primary no-underline">
                    <svg className="w-5 h-5 text-tertiary flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d={a.icon} />
                    </svg>
                    {a.label}
                  </Link>
                ))}
                <button disabled className="flex items-center gap-3 p-4 border border-dashed border-border-primary rounded-lg bg-surface-secondary text-sm font-medium text-tertiary cursor-not-allowed">
                  <svg className="w-5 h-5 text-tertiary flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 4v16m8-8H4" />
                  </svg>
                  Disabled
                </button>
                <button disabled className="flex items-center gap-3 p-4 border border-dashed border-border-primary rounded-lg bg-surface-secondary text-sm font-medium text-tertiary cursor-not-allowed">
                  <svg className="w-5 h-5 text-tertiary flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 4v16m8-8H4" />
                  </svg>
                  Disabled
                </button>
              </div>
            </Card>
          </section>
        </div>
      </div>

      {/* 04 / ACTIVITY TRENDS + 05 / INFRASTRUCTURE */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-5">
        <section className="animate-slide-up lg:col-span-3">
          <SectionHead
            num="04"
            name="Activity Trends"
            badge={(
              <div className="inline-flex gap-1">
                <Button
                  size="sm"
                  variant={trendWindow === 'today' ? 'primary' : 'outline'}
                  className="!py-1 !px-2 !text-[11px]"
                  onClick={() => setTrendWindow('today')}
                >
                  Today
                </Button>
                <Button
                  size="sm"
                  variant={trendWindow === '7d' ? 'primary' : 'outline'}
                  className="!py-1 !px-2 !text-[11px]"
                  onClick={() => setTrendWindow('7d')}
                >
                  7 Days
                </Button>
              </div>
            )}
          />
          <Card 
            padding="sm" 
            className="border-border-primary"
            style={{ height: '505px' }}
          >
            <StatGraph
              variant="line"
              deferUntilVisible
              reveal={graphReveal}
              series={selectedTrendSeries}
              labels={selectedTrendLabels}
              showAxes
            />
          </Card>
        </section>

        <div className="animate-slide-up lg:col-span-1 space-y-5">
          <section>
            <SectionHead num="05" name="Infrastructure" />
            <div className="space-y-5">
              {/* Turnstile */}
              <Card padding="sm" className="border-border-primary">
                <h3 className="text-sm font-semibold text-primary mb-3">Cloudflare Turnstile</h3>
                {securityLoading ? (
                  <p className="text-sm text-tertiary">Loading...</p>
                ) : (
                  <div className="flex flex-col items-center gap-3">
                    <CustomToggle isOn={turnstileEnabled} onToggle={(v) => { setPendingValue(v); setShowConfirmModal(true); }} disabled={securitySaving} />
                    <StatusCard isOn={turnstileEnabled} />
                  </div>
                )}
              </Card>

              {/* Cloudinary gauges */}
              {loading ? (
                <Card padding="sm" className="border-border-primary"><Loading size="small" text="Loading storage..." /></Card>
              ) : storageData ? (
                <Card 
                  padding="sm" 
                  className="border-border-primary"
                  style={{ height: '300px' }}
                >
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-sm font-semibold text-primary">Cloudinary</h3>
                    <button type="button" onClick={() => fetchStorageData(true)} disabled={refreshing}
                      className="w-6 h-6 rounded-full bg-surface-success flex items-center justify-center hover:bg-surface-success-strong disabled:opacity-50 transition-colors">
                      {refreshing
                        ? <div className="w-3 h-3 border border-success border-t-transparent rounded-full animate-spin" />
                        : <svg className="w-3 h-3 text-success" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                      }
                    </button>
                  </div>

                  {/* Compact info */}
                  <div className="grid grid-cols-2 gap-2 mb-3 text-xs">
                    <div><span className="text-tertiary block font-mono text-xs font-accent uppercase tracking-wide">Plan</span><span className="text-primary font-medium">{storageData.plan || 'Free'}</span></div>
                    <div><span className="text-tertiary block font-mono text-xs font-accent uppercase tracking-wide">Images</span><span className="text-primary font-medium">{storageData.total_images || 0}</span></div>
                  </div>

                  <div className="border-t border-border-primary mt-4 mb-2" />

                  <div className="space-y-3">
                    <div>
                      <StatGraph
                        variant="gauge"
                        deferUntilVisible
                        reveal={graphReveal}
                        series={[{ label: 'Storage', value: storageData.storage_percentage || 0, max: 100, threshold: 90, thresholdDir: 'max', color: '--border-brand', unit: '%' }]}
                      />
                      <div className="text-xs text-tertiary mt-1 text-center">{storageData.storage_used_formatted || '0 B'} / {storageData.storage_limit_formatted || '0 B'}</div>
                    </div>

                    <div>
                      <StatGraph
                        variant="gauge"
                        deferUntilVisible
                        reveal={graphReveal}
                        series={[{ label: 'Bandwidth', value: storageData.bandwidth_percentage || (storageData.bandwidth_used && storageData.bandwidth_limit ? Math.round((storageData.bandwidth_used / storageData.bandwidth_limit) * 100) : 0), max: 100, threshold: 90, thresholdDir: 'max', color: '--border-brand', unit: '%' }]}
                      />
                      <div className="text-xs text-tertiary mt-1 text-center">{storageData.bandwidth_used_formatted || '0 B'} / {storageData.bandwidth_limit_formatted || '0 B'}</div>
                    </div>
                  </div>
                </Card>
              ) : null}
            </div>
          </section>
        </div>
      </div>

      <ConfirmationModal
        isOpen={showConfirmModal}
        onClose={handleCancel}
        onConfirm={handleConfirm}
        title="Confirm Change"
        message={`Are you sure you want to ${pendingValue ? 'enable' : 'disable'} Cloudflare Turnstile?`}
        confirmText="Confirm"
        cancelText="Cancel"
        type="default"
      />
    </div>
  );
};

export default DashboardPage;
