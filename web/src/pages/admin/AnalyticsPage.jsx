import React, { useEffect, useRef, useState, useMemo, useCallback, Suspense, lazy } from 'react';
import Card from '../../components/common/Card';
import adminService from '../../services/adminService';
import Button from '../../components/common/Button';
import Dropdown from '../../components/common/Dropdown';
import Input from '../../components/common/Input';
import DatePicker from '../../components/common/DatePicker';
import TabNavigation from '../../components/common/TabNavigation';
import Checkbox from '../../components/common/Checkbox';
// Lazy-load heavy chart component to reduce initial bundle size
const StatGraph = lazy(() => import('../../components/common/StatGraph'));
import Pagination from '../../components/common/Pagination';
import '../../styles/components/AdminDashboard.css';

/* ====== Shared sub-components ====== */

const SectionHead = ({ num, name, badge }) => (
  <div className="flex items-stretch gap-0 mb-3">
    <span className="font-mono text-xs tracking-widest text-on-neutral bg-interactive-neutral-primary px-3 py-1 flex items-center flex-shrink-0 rounded-l-md">{num} /</span>
    <span className="font-mono text-xs font-medium tracking-widest uppercase text-primary bg-surface-secondary border border-l-0 border-border-primary px-3 py-1 flex items-center">{name}</span>
    <div className="flex-1 border-b border-border-primary self-end" />
    {badge && <div className="ml-auto flex-shrink-0 flex items-center pl-3">{badge}</div>}
  </div>
);

const SeverityBadge = ({ severity = 'ok', label }) => {
  const m = { 
    ok: 'bg-interactive-success text-on-dark border-success', 
    warning: 'bg-interactive-warning text-on-dark border-warning', 
    critical: 'bg-interactive-danger text-on-dark border-danger' 
  };
  return <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs border font-medium ${m[severity] || m.ok}`}>{label}</span>;
};

const StatCell = ({ label, value, intent }) => (
  <div className="p-2.5 border border-border-primary rounded-md bg-surface-secondary">
    <div className="font-mono text-xs tracking-widest uppercase text-tertiary">{label}</div>
    <div className={`text-md font-semibold mt-0.5 leading-none ${intent === 'danger' ? 'text-danger' : 'text-primary'}`}>{value}</div>
  </div>
);

const TabSkeleton = () => (
  <div className="space-y-4">
    <div className="h-4 w-40 bg-surface-secondary rounded animate-pulse" />
    <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
      {Array.from({ length: 4 }).map((_, idx) => (
        <div key={`sk-${idx}`} className="h-16 bg-surface-secondary rounded animate-pulse" />
      ))}
    </div>
    <div className="h-44 bg-surface-secondary rounded animate-pulse" />
  </div>
);

/* ====== Tab definitions ============================== */

const TABS = [
  { id: 'slo', label: 'SLO & SLA', num: '01' },
  { id: 'endpoints', label: 'Endpoints', num: '02' },
  { id: 'governance', label: 'Governance', num: '03' },
  { id: 'ops', label: 'Operations', num: '04' },
  { id: 'recs', label: 'Recommendations', num: '05' },
  { id: 'image', label: 'Image Classifier', num: '06' },
  { id: 'blog', label: 'Blog', num: '07' },
];

const DEFAULT_ALERT_RULE = {
  enabled: false, cooldownMinutes: 30,
  thresholds: { availabilityPctMin: 99, errorRate5xxPctMax: 1, p95LatencyMsMax: 1200 },
  channels: { email: { enabled: false, to: [] }, slack: { enabled: false, webhookUrl: '' }, webhook: { enabled: false, url: '' } },
  lastTriggeredAt: null,
};
const ERROR_LOG_PAGE_SIZE = 20;

/* ====== Main component ========================â”€ */

const AnalyticsPage = () => {
  const fieldClassName = 'w-full px-3 py-2 rounded border border-border-primary bg-surface-primary text-sm text-primary';
  const exportOptions = [
    { value: 'overview', label: 'System Overview' },
    { value: 'safety-governance', label: 'Governance Metrics (Safety)' },
    { value: 'operations', label: 'Operations and Reliability' },
    { value: 'audit-trail', label: 'Audit Trail' },
    { value: 'recommendation-insights', label: 'Recommendation Insights' },
    { value: 'image-classifier-insights', label: 'Image Classifier Insights' },
    { value: 'blog-insights', label: 'Blog Monitoring' },
  ];
  const statusFilterOptions = [
    { value: 'all', label: 'All Status' },
    { value: '5xx', label: '5xx' },
    { value: '4xx', label: '4xx' },
  ];
  const sloScopeOptions = [
    { value: 'core', label: 'Core API' },
    { value: 'all', label: 'All API' },
    { value: 'admin', label: 'Admin' },
    { value: 'uploads', label: 'Uploads' },
    { value: 'ml', label: 'ML' },
  ];

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [safety, setSafety] = useState(null);
  const [auditTrail, setAuditTrail] = useState([]);
  const [insights, setInsights] = useState(null);
  const [imageInsights, setImageInsights] = useState(null);
  const [operations, setOperations] = useState(null);
  const [blogInsights, setBlogInsights] = useState(null);
  const [errorLogs, setErrorLogs] = useState([]);
  const [topFailingEndpoints, setTopFailingEndpoints] = useState([]);
  const [sloSlaSummary, setSloSlaSummary] = useState(null);
  const [alertRule, setAlertRule] = useState(DEFAULT_ALERT_RULE);
  const [alertRuleSaving, setAlertRuleSaving] = useState(false);
  const [selectedRangeDays, setSelectedRangeDays] = useState(7);
  const [errorFilterStatusClass, setErrorFilterStatusClass] = useState('all');
  const [errorFilterEndpoint, setErrorFilterEndpoint] = useState('');
  const [errorFilterSearch, setErrorFilterSearch] = useState('');
  const [downloadError, setDownloadError] = useState('');
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [selectedReport, setSelectedReport] = useState('safety-governance');
  const [selectedReports, setSelectedReports] = useState(['safety-governance']);
  const [isExporting, setIsExporting] = useState(false);
  const [exportFormat, setExportFormat] = useState('csv'); // 'csv' or 'pdf'
  const [activeTab, setActiveTab] = useState('slo');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [sloScope, setSloScope] = useState('core');
  const [loadingStates, setLoadingStates] = useState({
    minimal: false,
    critical: false,
    secondary: false,
    errorLogs: false,
  });
  const [errorLogPage, setErrorLogPage] = useState(1);
  const [errorLogsHasNext, setErrorLogsHasNext] = useState(false);
  const requestSeqRef = useRef(0);
  const errorLogsRequestSeqRef = useRef(0);
  const prefetchedRangesRef = useRef(new Set());
  const hasLoadedAnalyticsRef = useRef(false);
  const statGraphPrefetchedRef = useRef(false);
  // Buffer SSE snapshots and throttle UI updates
  const sseBufferRef = useRef({});
  const sseTimerRef = useRef(null);

  const errorFilters = useMemo(() => ({
    statusClass: errorFilterStatusClass,
    endpoint: errorFilterEndpoint,
    search: errorFilterSearch,
  }), [errorFilterStatusClass, errorFilterEndpoint, errorFilterSearch]);

  const applyBundle = useCallback((bundle) => {
    if (!bundle) return;
    if (Object.prototype.hasOwnProperty.call(bundle, 'safety')) setSafety(bundle.safety || null);
    if (Object.prototype.hasOwnProperty.call(bundle, 'auditTrail')) setAuditTrail(Array.isArray(bundle.auditTrail) ? bundle.auditTrail : []);
    if (Object.prototype.hasOwnProperty.call(bundle, 'insights')) setInsights(bundle.insights || null);
    if (Object.prototype.hasOwnProperty.call(bundle, 'imageInsights')) setImageInsights(bundle.imageInsights || null);
    if (Object.prototype.hasOwnProperty.call(bundle, 'operations')) setOperations(bundle.operations || null);
    if (Object.prototype.hasOwnProperty.call(bundle, 'blogInsights')) setBlogInsights(bundle.blogInsights || null);
    if (Object.prototype.hasOwnProperty.call(bundle, 'errorLogs')) {
      const entries = Array.isArray(bundle.errorLogs?.entries)
        ? bundle.errorLogs.entries
        : (Array.isArray(bundle.errorLogs) ? bundle.errorLogs : []);
      setErrorLogs(entries);
      setErrorLogsHasNext(Boolean(bundle.errorLogs?.hasMore) || entries.length === ERROR_LOG_PAGE_SIZE);
    }
    if (Object.prototype.hasOwnProperty.call(bundle, 'topFailingEndpoints')) setTopFailingEndpoints(Array.isArray(bundle.topFailingEndpoints) ? bundle.topFailingEndpoints : []);
    if (Object.prototype.hasOwnProperty.call(bundle, 'sloSlaSummary')) setSloSlaSummary(bundle.sloSlaSummary || null);
    if (Object.prototype.hasOwnProperty.call(bundle, 'alertRule')) setAlertRule(bundle.alertRule || DEFAULT_ALERT_RULE);
  }, []);

  const prefetchStatGraph = useCallback(() => {
    if (statGraphPrefetchedRef.current) return;
    statGraphPrefetchedRef.current = true;
    import('../../components/common/StatGraph');
  }, []);

  const loadAnalytics = useCallback(async (options = {}) => {
    const { forceRefresh = false, errorLogPageOverride } = options;
    const pageToLoad = Number(errorLogPageOverride) > 0 ? Number(errorLogPageOverride) : errorLogPage;
    const requestId = requestSeqRef.current + 1;
    requestSeqRef.current = requestId;
    try {
      setError('');
      const cachedBundle = forceRefresh ? null : adminService.getCachedMonitoringBundle(selectedRangeDays, errorFilters, { scope: sloScope });
      if (cachedBundle) {
        applyBundle(cachedBundle);
        setLoading(false);
        hasLoadedAnalyticsRef.current = true;
      } else {
        // Keep currently rendered analytics visible on refresh/filter actions once first payload is loaded.
        if (!hasLoadedAnalyticsRef.current) setLoading(true);
      }
      setIsRefreshing(true);
      setLoadingStates({ minimal: true, critical: true, secondary: true, errorLogs: true });

      if (!cachedBundle) {
        const minimalBundle = await adminService.getMonitoringMinimalBundle(selectedRangeDays, { forceRefresh, scope: sloScope });
        if (requestId !== requestSeqRef.current) return;
        applyBundle(minimalBundle);
        hasLoadedAnalyticsRef.current = true;
        setLoading(false);
        setLoadingStates((prev) => ({ ...prev, minimal: false }));
      } else {
        setLoadingStates((prev) => ({ ...prev, minimal: false }));
      }

      const criticalBundle = await adminService.getMonitoringCriticalBundle(selectedRangeDays, { forceRefresh, scope: sloScope });
      if (requestId !== requestSeqRef.current) return;
      applyBundle(criticalBundle);
      hasLoadedAnalyticsRef.current = true;
      setLoading(false);
      setLoadingStates((prev) => ({ ...prev, critical: false }));

      await new Promise((resolve) => {
        if ('requestIdleCallback' in window) {
          window.requestIdleCallback(resolve, { timeout: 1000 });
        } else {
          window.setTimeout(resolve, 0);
        }
      });
      const secondaryBundle = await adminService.getMonitoringSecondaryBundle(selectedRangeDays, errorFilters, {
        forceRefresh,
        errorLogPage: pageToLoad,
        errorLogLimit: ERROR_LOG_PAGE_SIZE,
      });
      if (requestId !== requestSeqRef.current) return;
      applyBundle(secondaryBundle);
      setLoadingStates((prev) => ({ ...prev, secondary: false, errorLogs: false }));
    } catch (err) {
      if (requestId !== requestSeqRef.current) return;
      setError(err.message || 'Failed to load analytics');
    } finally {
      if (requestId === requestSeqRef.current) {
        setLoading(false);
        setIsRefreshing(false);
        setLoadingStates((prev) => ({ ...prev, minimal: false, critical: false, secondary: false, errorLogs: false }));
      }
    }
  }, [selectedRangeDays, errorFilters, errorLogPage, sloScope, applyBundle]);

  useEffect(() => {
    setErrorLogPage(1);
  }, [selectedRangeDays, sloScope]);

  useEffect(() => { loadAnalytics({ errorLogPageOverride: 1 }); }, [selectedRangeDays, sloScope]);

  useEffect(() => {
    const schedule = (fn) => {
      if ('requestIdleCallback' in window) {
        // @ts-ignore - requestIdleCallback may not be typed
        return window.requestIdleCallback(fn, { timeout: 1200 });
      }
      return window.setTimeout(fn, 200);
    };
    const handle = schedule(() => prefetchStatGraph());
    return () => {
      if (typeof handle === 'number') window.clearTimeout(handle);
      // @ts-ignore - cancelIdleCallback may not be typed
      else if (handle && 'cancelIdleCallback' in window) window.cancelIdleCallback(handle);
    };
  }, [prefetchStatGraph]);

  useEffect(() => {
    const defaults = { statusClass: 'all', endpoint: '', search: '' };
    const candidates = [7, 30, 90, 365]
      .filter((days) => days !== selectedRangeDays)
      .filter((days) => !prefetchedRangesRef.current.has(String(days)))
      .slice(0, 2); // limit concurrent prefetches

    const schedule = (fn) => {
      if ('requestIdleCallback' in window) {
        // @ts-ignore - requestIdleCallback may not be typed
        return window.requestIdleCallback(fn, { timeout: 2000 });
      }
      return window.setTimeout(fn, 300);
    };

    const handles = candidates.map((days, idx) =>
      schedule(() => {
        const key = `${days}`;
        if (prefetchedRangesRef.current.has(key)) return;
        prefetchedRangesRef.current.add(key);
        adminService.prefetchMonitoringBundle(days, defaults, { scope: sloScope });
      })
    );

    return () => {
      handles.forEach((h) => {
        if (typeof h === 'number') window.clearTimeout(h);
        // @ts-ignore - cancelIdleCallback may not be typed
        else if (h && 'cancelIdleCallback' in window) window.cancelIdleCallback(h);
      });
    };
  }, [selectedRangeDays]);

  useEffect(() => {
    let streamHandle = null;
    let cancelled = false;
    const windowHours = selectedRangeDays * 24;

    const schedule = (fn) => {
      if ('requestIdleCallback' in window) {
        // @ts-ignore - requestIdleCallback may not be typed
        return window.requestIdleCallback(fn, { timeout: 2000 });
      }
      return window.setTimeout(fn, 500);
    };

    const idleHandle = schedule(() => {
      if (cancelled) return;
      adminService
        .connectMonitoringStream({
          sections: ['safety', 'recommendation', 'image', 'operations', 'blog', 'slo', 'endpoints', 'audit'],
          days: selectedRangeDays,
          hours: windowHours,
          intervalMs: selectedRangeDays <= 30 ? 10000 : 30000,
          onMessage: ({ event, data }) => {
            if (event !== 'snapshot' || !data) return;
            adminService.hydrateMonitoringCacheFromSnapshot(selectedRangeDays, data, {}, { scope: sloScope });
            // Buffer and throttle updates to reduce re-render frequency
            sseBufferRef.current = {
              ...sseBufferRef.current,
              ...(data.safety ? { safety: data.safety } : null),
              ...(data.recommendation ? { insights: data.recommendation } : null),
              ...(data.image ? { imageInsights: data.image } : null),
              ...(data.operations ? { operations: data.operations } : null),
              ...(data.blog ? { blogInsights: data.blog } : null),
              ...(data.slo ? { sloSlaSummary: data.slo } : null),
              ...(Array.isArray(data.topFailingEndpoints) ? { topFailingEndpoints: data.topFailingEndpoints } : null),
              ...(Array.isArray(data.auditTrail) ? { auditTrail: data.auditTrail } : null),
            };
            if (!sseTimerRef.current) {
              sseTimerRef.current = window.setTimeout(() => {
                applyBundle(sseBufferRef.current);
                sseBufferRef.current = {};
                sseTimerRef.current = null;
              }, 500);
            }
          },
          onError: () => {},
          scope: sloScope,
        })
        .then((handle) => {
          if (cancelled) {
            handle.close();
            return;
          }
          streamHandle = handle;
        })
        .catch(() => {});
    });

    return () => {
      cancelled = true;
      if (streamHandle) streamHandle.close();
      if (typeof idleHandle === 'number') window.clearTimeout(idleHandle);
      // @ts-ignore - cancelIdleCallback may not be typed
      else if (idleHandle && 'cancelIdleCallback' in window) window.cancelIdleCallback(idleHandle);
      if (sseTimerRef.current) {
        window.clearTimeout(sseTimerRef.current);
        sseTimerRef.current = null;
        sseBufferRef.current = {};
      }
    };
  }, [selectedRangeDays, sloScope]);

  const downloadCsv = async (reports) => {
    const reportsArray = Array.isArray(reports) ? reports : [reports];
    const windowHours = selectedRangeDays * 24;
    const p = { operations: { hours: windowHours }, 'image-classifier-insights': { hours: windowHours }, 'blog-insights': { hours: windowHours }, 'recommendation-insights': { days: selectedRangeDays }, 'audit-trail': { days: selectedRangeDays } };
    try { 
      setIsExporting(true); 
      setDownloadError(''); 
      
      if (exportFormat === 'pdf') {
        // PDF export - generate comprehensive report
        const pdfParams = {
          reports: reportsArray.join(','),
          days: selectedRangeDays,
          hours: windowHours,
          format: 'pdf'
        };
        await adminService.downloadMonitoringPdf('recommendation-insights', pdfParams);
      } else {
        // CSV export
        if (reportsArray.length === 1) {
          await adminService.downloadMonitoringCsv(reportsArray[0], p[reportsArray[0]] || {});
        } else {
          const combinedParams = {
            reports: reportsArray.join(','),
            days: selectedRangeDays,
            hours: windowHours
          };
          await adminService.downloadMonitoringCsv('recommendation-insights', combinedParams);
        }
      }
      
      setIsExportModalOpen(false); 
    } catch (err) { 
      setDownloadError(err.message || 'Failed to download file'); 
    } finally { 
      setIsExporting(false); 
    }
  };

  const loadErrorLogsPage = useCallback(async (page, options = {}) => {
    const { forceRefresh = false } = options;
    const requestId = errorLogsRequestSeqRef.current + 1;
    errorLogsRequestSeqRef.current = requestId;
    try {
      setLoadingStates((prev) => ({ ...prev, errorLogs: true }));
      const errorLogPayload = await adminService.getErrorLogsPaginated(
        page,
        ERROR_LOG_PAGE_SIZE,
        selectedRangeDays,
        errorFilters,
        { forceRefresh }
      );
      if (requestId !== errorLogsRequestSeqRef.current) return;
      applyBundle({ errorLogs: errorLogPayload });
      setErrorLogPage(page);
    } finally {
      if (requestId === errorLogsRequestSeqRef.current) {
        setLoadingStates((prev) => ({ ...prev, errorLogs: false }));
      }
    }
  }, [selectedRangeDays, errorFilters, applyBundle]);

  const applyErrorLogFilters = async () => {
    try { await loadErrorLogsPage(1, { forceRefresh: true }); }
    catch (err) { setDownloadError(err.message || 'Failed to filter error logs'); }
  };

  const saveAlertRule = async () => {
    if (!alertRule) return;
    try { setAlertRuleSaving(true); setDownloadError(''); const u = await adminService.updateMonitoringAlertRule(alertRule); setAlertRule(u || alertRule); }
    catch (err) { setDownloadError(err.message || 'Failed to save alert rule'); }
    finally { setAlertRuleSaving(false); }
  };

  /* ====== Severities ==============================â”€ */
  const governanceSev = useMemo(() => { const t = (safety?.unverified?.herbSafety || 0) + (safety?.unverified?.interactions || 0) + (safety?.unverified?.contraindications || 0); if (t >= 100) return { severity: 'critical', label: 'Needs action' }; if (t >= 20) return { severity: 'warning', label: 'Needs review' }; return { severity: 'ok', label: 'Healthy' }; }, [safety]);
  const recSev = useMemo(() => {
    const volume = insights?.recommendations?.volume30d || 0;
    const sr = insights?.feedback?.severeSideEffectRate || 0;
    const d = insights?.feedback?.ratingDelta || 0;
    
    // When no activity, show standby
    if (volume === 0) return { severity: 'ok', label: 'Standby' };
    
    // When there IS volume, evaluate safety/quality
    if (sr >= 10 || d <= -0.3) return { severity: 'critical', label: 'Needs action' };
    if (sr >= 3 || d < 0) return { severity: 'warning', label: 'Watch' };
    return { severity: 'ok', label: 'Healthy' };
  }, [insights]);
  const imgSev = useMemo(() => { const cr = imageInsights?.feedback?.correctionRate || 0; const p = imageInsights?.performance?.p95InferenceMs || 0; if (cr >= 10 || p >= 2000) return { severity: 'critical', label: 'Needs action' }; if (cr >= 4 || p >= 1200) return { severity: 'warning', label: 'Watch' }; return { severity: 'ok', label: 'Healthy' }; }, [imageInsights]);
  const opsSev = useMemo(() => { const e = operations?.api?.errorRate5xx || 0; const p = operations?.api?.p95LatencyMs || 0; if (e >= 2 || p >= 2000) return { severity: 'critical', label: 'Needs action' }; if (e >= 1 || p >= 1200) return { severity: 'warning', label: 'Watch' }; return { severity: 'ok', label: 'Healthy' }; }, [operations]);
  const blogSev = useMemo(() => { const r = blogInsights?.status?.review || 0; if (r >= 25) return { severity: 'critical', label: 'Needs action' }; if (r >= 10) return { severity: 'warning', label: 'Watch' }; return { severity: 'ok', label: 'Healthy' }; }, [blogInsights]);

  const graphReveal = 'fade';

  /* ====== Tab badge map ======================== */
  const tabBadge = useMemo(() => ({ governance: governanceSev, recs: recSev, ops: opsSev, image: imgSev, blog: blogSev }), [governanceSev, recSev, opsSev, imgSev, blogSev]);
  const rangePickerValue = useMemo(() => {
    const end = new Date();
    const start = new Date(end);
    start.setDate(end.getDate() - selectedRangeDays);
    return {
      startDate: start.toISOString().slice(0, 10),
      endDate: end.toISOString().slice(0, 10),
      days: selectedRangeDays,
    };
  }, [selectedRangeDays]);
  const tabItems = useMemo(() => TABS.map((tab) => ({
    id: tab.id,
    label: `${tab.num} ${tab.label}`,
    badge: tabBadge[tab.id]?.severity === 'critical' ? '!' : (tabBadge[tab.id]?.severity === 'warning' ? '~' : null),
  })), [tabBadge]);

  const handleRangePickerChange = (next) => {
    if (!next) return;
    if (Number.isFinite(next.days) && next.days > 0) {
      setSelectedRangeDays(Math.min(365, next.days));
      return;
    }

    const start = new Date(next.startDate);
    const end = new Date(next.endDate);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return;
    const diff = Math.max(1, Math.ceil((end.getTime() - start.getTime()) / 86400000));
    setSelectedRangeDays(Math.min(365, diff));
  };

  /* ====== Render current tab content ==================================================================================== */
  const renderTabContent = (tabId, isActive) => {
    if (!isActive) return <TabSkeleton />;

    switch (tabId) {
      case 'slo': {
        const sloTrend = sloSlaSummary?.p95TrendByDay || [];
        return (
          <div className="space-y-4">
            <SectionHead num="01" name="SLO & Service Levels" />
            <div className="flex items-center justify-between gap-3 mb-1">
              <div className="text-xs text-tertiary font-mono uppercase tracking-wide">Window: {selectedRangeDays}d</div>
              <div className="min-w-[150px]">
                <Dropdown
                  value={sloScope}
                  onChange={setSloScope}
                  options={sloScopeOptions}
                  customClasses={{ input: `${fieldClassName} !py-1 !text-[11px]` }}
                />
              </div>
            </div>
            <StatGraph deferUntilVisible reveal={graphReveal}
              variant="gauge"
              series={[
                { label: 'Availability', value: sloSlaSummary?.availabilityPct ?? 100, max: 100, threshold: sloSlaSummary?.thresholds?.availabilityPctMin ?? 99, thresholdDir: 'min', color: '--border-brand', unit: '%', decimals: 2 },
                { label: '5xx Error Rate', value: sloSlaSummary?.errorRate5xxPct ?? 0, max: Math.max(5, (sloSlaSummary?.errorRate5xxPct ?? 0) * 2, (sloSlaSummary?.thresholds?.errorRate5xxPctMax ?? 1) * 3), threshold: sloSlaSummary?.thresholds?.errorRate5xxPctMax ?? 1, thresholdDir: 'max', color: '--border-brand', unit: '%', decimals: 2 },
                { label: 'P95 Latency', value: sloSlaSummary?.p95LatencyMs ?? 0, max: Math.max(2000, (sloSlaSummary?.p95LatencyMs ?? 0) * 1.5), threshold: sloSlaSummary?.thresholds?.p95LatencyMsMax ?? 1200, thresholdDir: 'max', color: '--border-brand', unit: 'ms', decimals: 0 },
              ]}
            />
            <div className="mt-4">
              <div className="font-mono text-xs font-accent uppercase tracking-wide text-tertiary mb-2">P95 Latency Trend</div>
              <StatGraph deferUntilVisible reveal={graphReveal} variant="line" series={[{ label: 'P95 ms', color: '--chart-2', data: sloTrend.map(i => i.p95LatencyMs) }]} labels={sloTrend.map(i => i.key || i.date || '')} height={160} unit="ms" showLegend={false} />
            </div>
          </div>
        );
      }

      case 'endpoints':
        return (
          <div className="space-y-4">
            <SectionHead num="02" name="Top Failing Endpoints" />
            {topFailingEndpoints.length === 0
              ? <div className="text-sm text-tertiary">No failing endpoints found.</div>
              : <StatGraph deferUntilVisible reveal={graphReveal} variant="hbar" series={[{ label: '5xx Errors', color: '--chart-1', data: topFailingEndpoints.map(r => r.errors5xx) }]} labels={topFailingEndpoints.map(r => `${r.method} ${r.path}`)} height={Math.max(160, topFailingEndpoints.length * 32)} showAxes unit="errors" />
            }
            <div className="space-y-4">
              <SectionHead num="06" name="Error Logs" />
              <div className="flex items-center justify-between">
                <span className="text-xs text-tertiary font-mono">{errorLogs.length} entries</span>
                {loadingStates.errorLogs && <span className="uppercase tracking-wide">Loading page...</span>}
              </div>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-2">
                <Dropdown value={errorFilterStatusClass} onChange={setErrorFilterStatusClass} options={statusFilterOptions} customClasses={{ input: fieldClassName }} />
                <Input value={errorFilterEndpoint} onChange={(e) => setErrorFilterEndpoint(e.target.value)} placeholder="Endpoint..." className={fieldClassName} />
                <Input value={errorFilterSearch} onChange={(e) => setErrorFilterSearch(e.target.value)} placeholder="Search..." className={fieldClassName} />
                <Button size="sm" variant="primary" onClick={applyErrorLogFilters}>Apply</Button>
              </div>
              <div className="flex items-center justify-between">
                <Pagination
                  currentPage={errorLogPage}
                  totalPages={Math.ceil(errorLogs.length / ERROR_LOG_PAGE_SIZE)}
                  onPageChange={loadErrorLogsPage}
                  total={errorLogs.length}
                  limit={ERROR_LOG_PAGE_SIZE}
                  showInfo={true}
                />
              </div>
              {errorLogs.length === 0
                ? <div className="text-sm text-tertiary">No error logs found.</div>
                : <div className="space-y-1.5 max-h-96 overflow-y-auto pr-1">{errorLogs.map((e, i) => (
                  <div key={`${e.timestamp}-${i}`} className="p-2.5 border border-border-primary rounded-md text-xs space-y-1">
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                      <span className="font-semibold text-primary">{new Date(e.timestamp).toLocaleString()}</span>
                      <span className="text-danger uppercase font-medium">{e.level || 'error'}</span>
                      {e.statusCode && <span className="text-tertiary">HTTP {e.statusCode}</span>}
                      {e.method && <span className="text-tertiary">{e.method}</span>}
                      {e.path && <span className="text-tertiary truncate max-w-[200px]">{e.path}</span>}
                    </div>
                    <div className="text-secondary break-words">{e.message || 'No message'}</div>
                  </div>
                ))}</div>
              }
            </div>
          </div>
        );

      case 'governance':
        return (
          <div className="space-y-4">
            <SectionHead num="03" name="Governance" badge={<SeverityBadge {...governanceSev} />} />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <StatGraph deferUntilVisible reveal={graphReveal} variant="donut" series={[
                { label: 'Herb Safety', color: '--chart-1', value: safety?.unverified?.herbSafety ?? 0 },
                { label: 'Interactions', color: '--chart-2', value: safety?.unverified?.interactions ?? 0 },
                { label: 'Contraindications', color: '--chart-3', value: safety?.unverified?.contraindications ?? 0 },
              ]} title="Unverified" height={160} />
              <div>
                <div className="text-sm font-semibold text-primary mb-2">Oldest Review Queue</div>
                {(safety?.oldestReviewQueue || []).length === 0
                  ? <div className="text-sm text-tertiary">No pending items.</div>
                  : <div className="space-y-1.5">{(safety?.oldestReviewQueue || []).map((item) => (
                    <div key={item.id} className="flex items-center justify-between gap-2 p-2 border border-border-primary rounded-md text-xs">
                      <span className="font-medium text-primary truncate">{item.herb}</span>
                      <span className="text-tertiary flex-shrink-0">{item.lastReviewed ? new Date(item.lastReviewed).toLocaleDateString() : 'Never'}</span>
                    </div>
                  ))}</div>
                }
              </div>
            </div>
            <div className="space-y-4">
              <SectionHead num="04" name="Audit Trail" />
              {auditTrail.length === 0
                ? <div className="text-sm text-tertiary">No recent audit records.</div>
                : <div className="space-y-1.5 max-h-80 overflow-y-auto pr-1">{auditTrail.map((e, i) => (
                  <div key={`${e.type}-${i}`} className="flex items-center gap-2.5 p-2 border border-border-primary rounded-md text-xs">
                    <span className="font-semibold text-primary">{e.type}</span>
                    <span className="text-tertiary truncate flex-1">{e.target}</span>
                    <span className="text-weak flex-shrink-0">{new Date(e.updatedAt).toLocaleString()}</span>
                  </div>
                ))}</div>
              }
            </div>
          </div>
        );

      case 'recs': {
        const recsByDay = insights?.trends?.recommendationsByDay || [];
        const ratingByDay = insights?.trends?.feedbackRatingByDay || [];
        const volume = insights?.recommendations?.volume30d || 0;
        const todayVolume = insights?.recommendations?.volumeToday || 0;
        
        // Dynamic volume label based on date range
        const getVolumeLabel = () => {
          if (selectedRangeDays === 1) return 'Volume (Today)';
          if (selectedRangeDays === 7) return 'Volume (7d)';
          if (selectedRangeDays === 30) return 'Volume (30d)';
          return `Volume (${selectedRangeDays}d)`;
        };
        
        return (
          <div className="space-y-4">
            <SectionHead num="05" name="Recommendation Insights" badge={<SeverityBadge {...recSev} />} />
            
            {/* Only show actually dynamic metrics */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
              <StatCell label={getVolumeLabel()} value={volume} />
              <StatCell label="Heuristic Usage %" value={100} />
              <StatCell label="Recs (Today)" value={todayVolume} />
              <StatCell label="Status" value={volume > 0 ? "Active" : "Standby"} />
            </div>
            
            <div className="text-xs text-tertiary font-mono">
              Engine: Heuristic Symptom Matching {'· '}Safety: Active Filtering {'· '}Status: Operational
            </div>
            
            {/* Zero State Message */}
            {volume === 0 && todayVolume === 0 && (
              <div className="text-xs text-tertiary italic mt-2 p-2 bg-surface-secondary rounded">
                No recommendation activity in the selected period. The system is ready to process requests using heuristic matching.
              </div>
            )}
            
            <StatGraph deferUntilVisible reveal={graphReveal} variant="dual" series={[
              { label: 'Recommendations', color: '--chart-9', data: recsByDay.map(i => i.value), unit: 'vol' },
              { label: 'Avg Rating', color: '--chart-5', data: ratingByDay.map(i => i.value), unit: '★', decimals: 2 },
            ]} labels={recsByDay.map(i => i.key || '')} height={180} />
            
            {/* Symptom Frequency Chart */}
            <div className="space-y-4">
              <SectionHead num="06" name="Symptom Frequency" />
              <div className="text-xs text-tertiary mb-2">Most common symptoms from user recommendation requests</div>
              {(insights?.symptomFrequency?.length || 0) > 0 ? (
                <StatGraph deferUntilVisible reveal={graphReveal} variant="hbar" series={[
                  { label: 'Occurrences', color: '--chart-3', data: insights?.symptomFrequency?.map(s => s.count) || [] }
                ]} labels={insights?.symptomFrequency?.map(s => s.symptom) || []} height={200} showAxes />
              ) : (
                <div className="text-sm text-tertiary p-4 border border-border-primary rounded-md">
                  No symptom data available for the selected period.
                </div>
              )}
            </div>
          </div>
        );
      }

      case 'ops': {
        const reqByHour = operations?.trends?.requestByHour || [];
        return (
          <div className="space-y-4">
            <SectionHead num="06" name="Operations & Reliability" badge={<SeverityBadge {...opsSev} />} />
            <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
              <StatCell label="Requests (24h)" value={operations?.api?.totalRequests ?? 0} />
              <StatCell label="5xx Count" value={operations?.api?.error5xxCount ?? 0} />
              <StatCell label="5xx Rate %" value={operations?.api?.errorRate5xx ?? 0} />
              <StatCell label="P95 ms" value={operations?.api?.p95LatencyMs ?? 0} />
              <StatCell label="Error Logs" value={operations?.logs?.errorEntries ?? 0} />
            </div>
            <StatGraph deferUntilVisible reveal={graphReveal} variant="dual" series={[
              { label: 'Requests', color: '--chart-5', data: reqByHour.map(i => i.requests), unit: 'req' },
              { label: '5xx Errors', color: '--chart-1', data: reqByHour.map(i => i.errors5xx), unit: 'err' },
            ]} labels={reqByHour.map((_, i) => `${i}h`)} height={180} />
          </div>
        );
      }

      case 'image': {
        const predByDay = imageInsights?.trends?.predictionsByDay || [];
        const confByDay = imageInsights?.trends?.avgConfidenceByDay || [];
        return (
          <div className="space-y-4">
            <SectionHead num="08" name="Image Classifier" badge={<SeverityBadge {...imgSev} />} />
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2">
              <StatCell label="Predictions (7d)" value={imageInsights?.predictions?.total ?? 0} />
              <StatCell label="Avg Confidence" value={imageInsights?.predictions?.avgConfidence ?? 0} />
              <StatCell label="P95 Inference ms" value={imageInsights?.performance?.p95InferenceMs ?? 0} />
              <StatCell label="Low Confidence %" value={imageInsights?.predictions?.lowConfidenceRate ?? 0} />
              <StatCell label="Feedback Count" value={imageInsights?.feedback?.submittedCount ?? 0} />
              <StatCell label="Feedback Rate %" value={imageInsights?.feedback?.submittedRate ?? 0} />
            </div>
            <div className="text-xs text-tertiary font-mono">
              Model: {imageInsights?.model?.active?.version || 'N/A'}
              {' · '}Val acc: {imageInsights?.model?.latest?.val_accuracy?.toFixed(4) ?? 'N/A'}
              {' · '}Val loss: {imageInsights?.model?.latest?.val_loss?.toFixed(4) ?? 'N/A'}
            </div>
            <StatGraph deferUntilVisible reveal={graphReveal} variant="dual" series={[
              { label: 'Predictions', color: '--chart-9', data: predByDay.map(i => i.value), unit: 'count' },
              { label: 'Avg Confidence', color: '--chart-5', data: confByDay.map(i => i.value), unit: '', decimals: 3 },
            ]} labels={predByDay.map(i => i.key || '')} height={180} />
          </div>
        );
      }

      case 'blog': {
        const blogCreated = blogInsights?.trends?.createdByDay || [];
        const blogPublished = blogInsights?.trends?.publishedByDay || [];
        const toKey = (item) => item?.key || item?.date || '';
        const createdKeys = blogCreated.map(toKey).filter(Boolean);
        const publishedKeys = blogPublished.map(toKey).filter(Boolean);
        const labels = createdKeys.length
          ? [...createdKeys, ...publishedKeys.filter((k) => !createdKeys.includes(k))]
          : publishedKeys;
        const createdMap = new Map(blogCreated.map((item) => [toKey(item), item?.value ?? 0]));
        const publishedMap = new Map(blogPublished.map((item) => [toKey(item), item?.value ?? 0]));
        const createdSeries = labels.map((k) => createdMap.get(k) ?? 0);
        const publishedSeries = labels.map((k) => publishedMap.get(k) ?? 0);
        return (
          <div className="space-y-4">
            <SectionHead num="09" name="Blog Monitoring" badge={<SeverityBadge {...blogSev} />} />
            <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
              <StatCell label="Total" value={blogInsights?.status?.total ?? 0} />
              <StatCell label="Pending" value={blogInsights?.status?.review ?? 0} />
              <StatCell label="Published" value={blogInsights?.status?.published ?? 0} />
              <StatCell label="Drafts" value={blogInsights?.status?.draft ?? 0} />
              <StatCell label="Published (7d)" value={blogInsights?.publishing?.publishedLast7Days ?? 0} />
            </div>
            <StatGraph deferUntilVisible reveal={graphReveal} variant="area" series={[
              { label: 'Created', color: '--chart-9', data: createdSeries },
              { label: 'Published', color: '--chart-5', data: publishedSeries },
            ]} labels={labels} height={180} />
            <div>
              <div className="font-mono text-xs font-accent uppercase tracking-wide text-tertiary mb-2 mt-2">Recent Moderation</div>
              {(blogInsights?.recentModerations || []).length === 0
                ? <div className="text-xs text-tertiary">No recent moderation activity.</div>
                : <div className="space-y-1.5">{(blogInsights?.recentModerations || []).slice(0, 5).map((m, i) => (
                  <div key={`${m.blogId || 'b'}-${i}`} className="flex items-center gap-2 p-2 border border-border-primary rounded-md text-xs">
                    <span className="font-medium text-primary truncate flex-1">{m.title || 'Untitled'}</span>
                    <span className="text-tertiary flex-shrink-0">{m.previousStatus || '—'} {'->'} {m.nextStatus || '—'}</span>
                    <span className="text-weak flex-shrink-0">{m.actedBy || ''}</span>
                  </div>
                ))}</div>
              }
            </div>
          </div>
        );
      }

      default: return null;
    }
  };

  return (
    <>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-4">

        {/* ====== Control bar ================== */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border-primary pb-3">
          <div className="w-full lg:w-auto lg:min-w-[420px]">
            <DatePicker
              mode="range"
              variant="period"
              value={rangePickerValue}
              onChange={handleRangePickerChange}
              quickPresets={[7, 30, 90, 365]}
            />
          </div>
          <div className="flex items-center gap-2">
            {isRefreshing && <span className="text-xs font-mono text-tertiary uppercase tracking-wide">Syncing...</span>}
            {loadingStates.minimal && <span className="text-xs font-mono text-tertiary uppercase tracking-wide">Quick metrics...</span>}
            {loadingStates.critical && <span className="text-xs font-mono text-tertiary uppercase tracking-wide">Core metrics...</span>}
            {loadingStates.secondary && <span className="text-xs font-mono text-tertiary uppercase tracking-wide">Details...</span>}
            <Button size="sm" variant="ghost" onClick={() => loadAnalytics({ forceRefresh: true })} disabled={isRefreshing}>
              <svg className="w-3.5 h-3.5 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              Refresh
            </Button>
            <Button size="sm" variant="primary" onClick={() => setIsExportModalOpen(true)}>
              <svg className="w-3.5 h-3.5 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              Export
            </Button>
          </div>
        </div>

        {error && <div className="p-3 border border-danger rounded-md bg-surface-danger text-sm text-danger">{error}</div>}
        {downloadError && <div className="p-3 border border-warning rounded-md bg-surface-warning text-sm text-warning">{downloadError}</div>}

        {loading ? (
          <Card className="border-border-primary"><div className="text-sm text-tertiary py-8 text-center">Loading analytics...</div></Card>
        ) : (
          <div className="space-y-3">
            <div onMouseEnter={prefetchStatGraph}>
              <TabNavigation
                variant="panel"
                ariaLabel="Analytics sections"
                items={tabItems}
                value={activeTab}
                onChange={setActiveTab}
              />
            </div>
            <Card padding="md" className="border-border-primary">
              <Suspense fallback={<div className="h-48 bg-surface-secondary rounded-md animate-pulse" />}> 
                {tabItems.map((tab) => {
                  const isActive = tab.id === activeTab;
                  return (
                    <div key={tab.id} hidden={!isActive}>
                      {renderTabContent(tab.id, isActive)}
                    </div>
                  );
                })}
              </Suspense>
            </Card>
          </div>
        )}
      </div>

      {/* ====== Export modal ====== */}
      {isExportModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[9999]">
          <div className="relative">
            <Card className="p-6 max-w-md w-full mx-4">
              <h3 className="text-md font-semibold mb-4 text-primary">Export Analytics</h3>
              <div className="text-xs text-tertiary mb-3">Select one or more reports to export:</div>
              
              {/* Format Selection */}
              <div className="mb-4">
                <div className="text-xs text-tertiary mb-2">Export Format:</div>
                <div className="flex gap-3">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="export-format"
                      className="accent-brand"
                      value="csv"
                      checked={exportFormat === 'csv'}
                      onChange={(e) => setExportFormat(e.target.value)}
                    />
                    <span className="text-sm text-primary">CSV Data</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="export-format"
                      className="accent-brand"
                      value="pdf"
                      checked={exportFormat === 'pdf'}
                      onChange={(e) => setExportFormat(e.target.value)}
                    />
                    <span className="text-sm text-primary">PDF Report</span>
                  </label>
                </div>
              </div>
              
              {/* Report Selection */}
              <div className="space-y-1.5 mb-5">
                {[
                  { value: 'overview', label: 'System Overview' },
                  { value: 'safety-governance', label: 'Governance Metrics (Safety)' },
                  { value: 'operations', label: 'Operations and Reliability' },
                  { value: 'audit-trail', label: 'Audit Trail' },
                  { value: 'recommendation-insights', label: 'Recommendation Insights' },
                  { value: 'image-classifier-insights', label: 'Image Classifier Insights' },
                  { value: 'blog-insights', label: 'Blog Monitoring' },
                ].map((option) => (
                  <div key={option.value} className="flex items-center gap-3 p-2 rounded-md border border-border-primary hover:bg-surface-secondary transition-colors">
                    <Checkbox
                      id={`export-${option.value}`}
                      checked={selectedReports.includes(option.value)}
                      onChange={(checked) => {
                        if (checked) {
                          setSelectedReports([...selectedReports, option.value]);
                        } else {
                          setSelectedReports(selectedReports.filter(r => r !== option.value));
                        }
                      }}
                      size="sm"
                    />
                    <label htmlFor={`export-${option.value}`} className="text-sm text-primary cursor-pointer flex-1">
                      {option.label}
                    </label>
                  </div>
                ))}
              </div>
              {downloadError && (
                <div className="text-sm text-error mb-3">{downloadError}</div>
              )}
              <div className="flex gap-3 justify-between items-center">
                <div className="text-xs text-tertiary w-32">
                  {selectedReports.length === 0 && 'Select at least one report'}
                  {selectedReports.length === 1 && '1 report selected'}
                  {selectedReports.length > 1 && `${selectedReports.length} reports selected`}
                </div>
                <div className="flex gap-3">
                  <Button variant="ghost" onClick={() => setIsExportModalOpen(false)} disabled={isExporting}>Cancel</Button>
                  <Button onClick={() => downloadCsv(selectedReports)} disabled={isExporting || selectedReports.length === 0}>
                    {isExporting ? 'Exporting...' : `Export ${exportFormat.toUpperCase()}`}
                  </Button>
                </div>
              </div>
            </Card>
          </div>
        </div>
      )}
    </>
  );
};

export default AnalyticsPage;
