import React, { useCallback, useEffect, useMemo, useState } from 'react';
import Card from '../../components/common/Card';
import Button from '../../components/common/Button';
import TabNavigation from '../../components/common/TabNavigation';
import { useConfirmation } from '../../hooks/useConfirmation';
import adminService from '../../services/adminService';

const TABLE_HEAD_CLASS = 'px-3 py-2 text-left text-xs font-semibold text-secondary uppercase tracking-wide';
const TABLE_CELL_CLASS = 'px-3 py-2 text-sm text-primary align-top';

const TableBlock = ({ title, rows }) => (
  <div className="space-y-2">
    <h3 className="text-base font-semibold text-primary">{title}</h3>
    <div className="overflow-x-auto border border-border-primary rounded-lg">
      <table className="min-w-full">
        <thead className="bg-surface-secondary">
          <tr>
            <th className={TABLE_HEAD_CLASS}>Metric</th>
            <th className={TABLE_HEAD_CLASS}>Value</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.label} className="border-t border-border-primary">
              <td className={TABLE_CELL_CLASS}>{row.label}</td>
              <td className={TABLE_CELL_CLASS}>{row.value}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  </div>
);

const MLManagementPage = () => {
  const { openModal } = useConfirmation();
  const [activeTab, setActiveTab] = useState('training');
  const [activeJob, setActiveJob] = useState(null);
  const [jobState, setJobState] = useState('idle');
  const [jobService, setJobService] = useState(null);
  const [jobTaskId, setJobTaskId] = useState(null);
  const [jobMessage, setJobMessage] = useState('');
  const [jobDetail, setJobDetail] = useState(null);
  const [lastStatusSnapshot, setLastStatusSnapshot] = useState(null);
  const [queueHealth, setQueueHealth] = useState(null);
  const [queueHealthError, setQueueHealthError] = useState('');
  const [loadingQueueHealth, setLoadingQueueHealth] = useState(false);
  const [imageInsights, setImageInsights] = useState(null);
  const [imageInsightsError, setImageInsightsError] = useState('');
  const [loadingImageInsights, setLoadingImageInsights] = useState(false);
  const [recommendationInsights, setRecommendationInsights] = useState(null);
  const [recommendationInsightsError, setRecommendationInsightsError] = useState('');
  const [loadingRecommendationInsights, setLoadingRecommendationInsights] = useState(false);
  const [monitoringOverview, setMonitoringOverview] = useState(null);
  const [monitoringOverviewError, setMonitoringOverviewError] = useState('');
  const [loadingMonitoringOverview, setLoadingMonitoringOverview] = useState(false);
  const [chatbotInsights, setChatbotInsights] = useState(null);
  const [chatbotInsightsError, setChatbotInsightsError] = useState('');
  const [loadingChatbotInsights, setLoadingChatbotInsights] = useState(false);
  const [chatbotSettings, setChatbotSettings] = useState(null);
  const [chatbotSettingsError, setChatbotSettingsError] = useState('');
  const [updatingChatbotSettings, setUpdatingChatbotSettings] = useState(false);

  const isBusy = activeJob !== null || jobState === 'queued' || jobState === 'running';
  const imageQueueUnavailable = queueHealth?.status !== 'ok';
  const tabs = useMemo(() => ([
    { id: 'training', label: 'Training' },
    { id: 'image', label: 'Image Classifier Monitoring & Management' },
    // { id: 'recommendation', label: 'Recommendation Engine Monitoring & Management' }, // Disabled
    { id: 'chatbot', label: 'Chatbot Monitoring & Management' },
  ]), []);

  const actions = useMemo(() => ([
    {
      id: 'image-classifier',
      title: 'Image Classifier Retrain',
      description: 'Force a manual retrain for the image-classifier service (bypasses trigger limits).',
      confirmMessage: 'Trigger image-classifier retraining now? This bypasses normal trigger thresholds.',
      run: () => adminService.triggerImageClassifierRetrain(),
    },
    // {
    //   id: 'recommendation-engine',
    //   title: 'Recommendation Engine Retrain',
    //   description: 'Force a manual retrain for the recommendation-engine service (bypasses schedule checks).',
    //   confirmMessage: 'Trigger recommendation-engine retraining now? This may take a few minutes to complete.',
    //   run: () => adminService.triggerRecommendationRetrain(),
    // }, // Disabled
  ]), []);

  const loadQueueHealth = useCallback(async () => {
    setLoadingQueueHealth(true);
    try {
      const data = await adminService.getImageClassifierQueueHealth();
      setQueueHealth(data);
      setQueueHealthError('');
    } catch (error) {
      setQueueHealth(null);
      setQueueHealthError(error?.message || 'Failed to check queue health.');
    } finally {
      setLoadingQueueHealth(false);
    }
  }, []);

  const loadImageInsights = useCallback(async () => {
    setLoadingImageInsights(true);
    try {
      const data = await adminService.getImageClassifierInsights(168, { forceRefresh: true });
      setImageInsights(data || null);
      setImageInsightsError('');
    } catch (error) {
      setImageInsights(null);
      setImageInsightsError(error?.message || 'Failed to load image-classifier insights.');
    } finally {
      setLoadingImageInsights(false);
    }
  }, []);

  const loadRecommendationInsights = useCallback(async () => {
    setLoadingRecommendationInsights(true);
    try {
      const data = await adminService.getRecommendationInsights(30, { forceRefresh: true });
      setRecommendationInsights(data || null);
      setRecommendationInsightsError('');
    } catch (error) {
      setRecommendationInsights(null);
      setRecommendationInsightsError(error?.message || 'Failed to load recommendation insights.');
    } finally {
      setLoadingRecommendationInsights(false);
    }
  }, []);

  const loadMonitoringOverview = useCallback(async () => {
    setLoadingMonitoringOverview(true);
    try {
      const data = await adminService.getMonitoringOverview({ forceRefresh: true });
      setMonitoringOverview(data || null);
      setMonitoringOverviewError('');
    } catch (error) {
      setMonitoringOverview(null);
      setMonitoringOverviewError(error?.message || 'Failed to load monitoring overview.');
    } finally {
      setLoadingMonitoringOverview(false);
    }
  }, []);

  const loadChatbotInsights = useCallback(async () => {
    setLoadingChatbotInsights(true);
    try {
      const data = await adminService.getChatbotInsights(24, 20, { forceRefresh: true });
      setChatbotInsights(data || null);
      setChatbotInsightsError('');
    } catch (error) {
      setChatbotInsights(null);
      setChatbotInsightsError(error?.message || 'Failed to load chatbot insights.');
    } finally {
      setLoadingChatbotInsights(false);
    }
  }, []);

  const loadChatbotSettings = useCallback(async () => {
    try {
      const data = await adminService.getChatbotSettings({ forceRefresh: true });
      setChatbotSettings(data || null);
      setChatbotSettingsError('');
    } catch (error) {
      setChatbotSettings(null);
      setChatbotSettingsError(error?.message || 'Failed to load chatbot settings.');
    }
  }, []);

  useEffect(() => {
    loadQueueHealth();
    loadImageInsights();
    loadRecommendationInsights();
    loadMonitoringOverview();
    loadChatbotInsights();
    loadChatbotSettings();
  }, [loadQueueHealth, loadImageInsights, loadRecommendationInsights, loadMonitoringOverview, loadChatbotInsights, loadChatbotSettings]);

  const pollImageRetrainStatus = async (taskId) => {
    const maxAttempts = 120;
    const intervalMs = 2000;
    for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
      const status = await adminService.getImageClassifierRetrainStatus(taskId);
      setLastStatusSnapshot(status || null);
      if (!status?.ready) {
        setJobState('running');
        setJobMessage('Image classifier retrain is running.');
        // eslint-disable-next-line no-await-in-loop
        await new Promise((resolve) => setTimeout(resolve, intervalMs));
        // eslint-disable-next-line no-continue
        continue;
      }

      if (!status?.successful) {
        throw new Error(status?.error || 'Image-classifier retrain task failed.');
      }

      const detail = status?.result || status;
      if (detail?.status === 'failed') {
        throw new Error(detail?.reason || 'Image-classifier retrain failed.');
      }
      return detail;
    }
    throw new Error('Timed out waiting for image-classifier retrain completion.');
  };

  const runImageClassifierPolling = (taskId) => {
    pollImageRetrainStatus(taskId)
      .then((detail) => {
        setJobState('success');
        setJobMessage('Image Classifier Retrain completed successfully.');
        setJobDetail(detail);
      })
      .catch((error) => {
        setJobState('error');
        setJobMessage(error?.message || 'Image classifier retrain failed.');
        setJobDetail(null);
      });
  };

  const handleTrigger = (action) => {
    if (isBusy) return;

    openModal({
      title: `Confirm ${action.title}`,
      message: action.confirmMessage,
      confirmText: 'Trigger Retrain',
      cancelText: 'Cancel',
      type: 'warning',
      onConfirm: async () => {
        setActiveJob(action.id);
        setJobService(action.id);
        setJobTaskId(null);
        setJobDetail(null);
        setLastStatusSnapshot(null);
        setJobMessage('Triggering retrain...');
        setJobState('running');

        try {
          const triggerResponse = await action.run();

          if (action.id === 'image-classifier') {
            const taskId = triggerResponse?.task_id;
            if (!taskId) {
              throw new Error('Image-classifier retrain did not return a task id.');
            }
            setJobTaskId(taskId);
            setJobState('queued');
            setJobMessage('Image classifier retrain queued successfully.');
            runImageClassifierPolling(taskId);
            return true;
          }

          const responseStatus = String(triggerResponse?.status || triggerResponse?.state || '').toLowerCase();
          const isQueued = responseStatus.includes('queue') || responseStatus === 'queued' || Boolean(triggerResponse?.task_id);
          setJobState('success');
          setJobMessage(
            isQueued
              ? 'Recommendation Engine Retrain queued successfully (async).'
              : 'Recommendation Engine Retrain triggered successfully.'
          );
          setJobDetail(triggerResponse?.result || triggerResponse);
          return true;
        } catch (error) {
          setJobState('error');
          setJobMessage(error?.message || `Failed to trigger ${action.title}.`);
          setJobDetail(null);
          return true;
        } finally {
          setActiveJob(null);
        }
      },
    });
  };

  const showJobCard = jobState !== 'idle';
  const jobToneClass = jobState === 'error'
    ? 'text-intent-danger'
    : jobState === 'success'
      ? 'text-intent-success'
      : 'text-secondary';
  const statusLabel = jobState === 'running'
    ? 'running'
    : jobState === 'queued'
      ? 'queued'
      : jobState;
  const formatNumber = (value) => {
    if (value == null) return 'N/A';
    if (typeof value === 'number') return Number.isInteger(value) ? value.toString() : value.toFixed(4);
    return String(value);
  };
  const formatDate = (value) => {
    if (!value) return 'N/A';
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? String(value) : parsed.toLocaleString();
  };

  const imageMonitoringRows = [
    { label: 'Queue Status', value: queueHealth?.status || queueHealthError || 'Unknown' },
    { label: 'Queue Broker', value: queueHealth?.queue?.broker || 'Unknown' },
    { label: 'Predictions (7d)', value: formatNumber(imageInsights?.predictions?.total) },
    { label: 'Avg Confidence', value: formatNumber(imageInsights?.predictions?.avgConfidence) },
    { label: 'Low Confidence %', value: formatNumber(imageInsights?.predictions?.lowConfidenceRate) },
    { label: 'Feedback Submitted', value: formatNumber(imageInsights?.feedback?.submittedCount) },
    { label: 'Feedback Rate %', value: formatNumber(imageInsights?.feedback?.submittedRate) },
    { label: 'P95 Inference (ms)', value: formatNumber(imageInsights?.performance?.p95InferenceMs) },
    { label: 'Active Model Version', value: imageInsights?.model?.active?.version || 'N/A' },
    { label: 'Latest Val Accuracy', value: formatNumber(imageInsights?.model?.latest?.val_accuracy) },
    { label: 'Latest Val Loss', value: formatNumber(imageInsights?.model?.latest?.val_loss) },
    { label: 'Retrain Threshold', value: formatNumber(imageInsights?.training?.retrainThreshold) },
  ];

  const recommendationMonitoringRows = [
    { label: 'Volume (30d)', value: formatNumber(recommendationInsights?.recommendations?.volume30d) },
    { label: 'Fallback Rate %', value: formatNumber(recommendationInsights?.recommendations?.fallbackRate) },
    { label: 'Severe Side Effect %', value: formatNumber(recommendationInsights?.feedback?.severeSideEffectRate) },
    { label: 'Average Rating (30d)', value: formatNumber(recommendationInsights?.feedback?.avgRatingRecent30d) },
    { label: 'Previous Rating (30d)', value: formatNumber(recommendationInsights?.feedback?.avgRatingPrevious30d) },
    { label: 'Rating Delta', value: formatNumber(recommendationInsights?.feedback?.ratingDelta) },
    { label: 'Latest Training At', value: formatDate(recommendationInsights?.model?.latestTrainingRun?.trained_at) },
    { label: 'Latest CV Accuracy Mean', value: formatNumber(recommendationInsights?.model?.latestTrainingRun?.cv_scores?.accuracy_mean) },
    { label: 'Latest CV RMSE Mean', value: formatNumber(recommendationInsights?.model?.latestTrainingRun?.cv_scores?.rmse_mean) },
  ];

  const chatbotMonitoringRows = [
    { label: 'Chatbot Enabled', value: chatbotSettings == null ? 'Unknown' : (chatbotSettings.chatbotEnabled ? 'Enabled' : 'Disabled') },
    { label: 'Conversations (24h)', value: formatNumber(chatbotInsights?.usage?.conversationCount) },
    { label: 'Messages (24h)', value: formatNumber(chatbotInsights?.usage?.messageCount) },
    { label: 'User Messages (24h)', value: formatNumber(chatbotInsights?.usage?.userMessages) },
    { label: 'Assistant Messages (24h)', value: formatNumber(chatbotInsights?.usage?.assistantMessages) },
    { label: 'Avg Assistant Response (ms)', value: formatNumber(chatbotInsights?.usage?.avgAssistantResponseMs) },
    { label: 'Provider', value: chatbotInsights?.provider?.name || 'N/A' },
    { label: 'Provider Status', value: chatbotInsights?.provider?.status || 'N/A' },
    { label: 'Provider Response (ms)', value: formatNumber(chatbotInsights?.provider?.responseTimeMs) },
    { label: 'API Key Configured', value: String(Boolean(chatbotInsights?.provider?.apiKeyConfigured)) },
    { label: 'Configured Model', value: chatbotInsights?.provider?.configuredModel || 'N/A' },
    { label: 'Configured Model Available', value: String(Boolean(chatbotInsights?.provider?.configuredModelAvailable)) },
    { label: 'Provider Model Count', value: formatNumber(chatbotInsights?.provider?.modelCount) },
    { label: 'Groq Models URL', value: chatbotInsights?.provider?.modelsUrl || 'N/A' },
    { label: 'Groq Completions URL', value: chatbotInsights?.provider?.configuredCompletionsUrl || 'N/A' },
    { label: 'Provider Error', value: chatbotInsights?.provider?.error || 'None' },
    { label: 'Users (from Monitoring Overview)', value: formatNumber(monitoringOverview?.users?.total) },
    { label: 'Missing Demographics', value: formatNumber(monitoringOverview?.users?.missingDemographics) },
    { label: 'Domain Symptoms', value: formatNumber(monitoringOverview?.domain?.symptoms) },
  ];

  const handleToggleChatbot = async () => {
    if (!chatbotSettings || updatingChatbotSettings) return;
    setUpdatingChatbotSettings(true);
    try {
      const next = !chatbotSettings.chatbotEnabled;
      const updated = await adminService.updateChatbotSettings({ chatbotEnabled: next });
      setChatbotSettings(updated || { chatbotEnabled: next });
      setChatbotSettingsError('');
    } catch (error) {
      setChatbotSettingsError(error?.message || 'Failed to update chatbot settings.');
    } finally {
      setUpdatingChatbotSettings(false);
    }
  };

  return (
    <div className="bg-transparent">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        
        <TabNavigation
          variant="panel"
          items={tabs}
          value={activeTab}
          onChange={setActiveTab}
          className="mb-6"
        />

        {activeTab === 'training' && (
          <Card className="border-border-primary">
            <div className="p-4 space-y-4">
              <h2 className="text-lg font-semibold text-primary">Training</h2>
              <div className="overflow-x-auto border border-border-primary rounded-lg">
                <table className="min-w-full">
                  <thead className="bg-surface-secondary">
                    <tr>
                      <th className={TABLE_HEAD_CLASS}>Service</th>
                      <th className={TABLE_HEAD_CLASS}>Description</th>
                      <th className={TABLE_HEAD_CLASS}>State</th>
                      <th className={TABLE_HEAD_CLASS}>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {actions.map((action) => {
                      const isTriggering = activeJob === action.id;
                      const serviceInProgress = jobService === action.id && (jobState === 'queued' || jobState === 'running');
                      const queueBlocked = action.id === 'image-classifier' && imageQueueUnavailable;
                      const disabled = isBusy || queueBlocked;
                      const serviceState = serviceInProgress
                        ? statusLabel
                        : action.id === 'image-classifier'
                          ? (queueHealth?.status || queueHealthError || 'unknown')
                          : 'ready';

                      return (
                        <tr key={action.id} className="border-t border-border-primary">
                          <td className={TABLE_CELL_CLASS}>{action.title}</td>
                          <td className={TABLE_CELL_CLASS}>{action.description}</td>
                          <td className={TABLE_CELL_CLASS}>
                            <span className={queueBlocked ? 'text-intent-danger' : 'text-primary'}>
                              {serviceState}
                            </span>
                          </td>
                          <td className={TABLE_CELL_CLASS}>
                            <Button
                              variant="primary"
                              onClick={() => handleTrigger(action)}
                              disabled={disabled}
                              loading={isTriggering}
                            >
                              {isTriggering ? 'Triggering...' : serviceInProgress ? 'Retraining...' : 'Trigger Retraining'}
                            </Button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              {imageQueueUnavailable ? (
                <p className="text-sm text-intent-danger">
                  Image classifier queue is unavailable. Start Redis to enable retraining.
                </p>
              ) : null}
            </div>
          </Card>
        )}

        {activeTab === 'image' && (
          <Card className="border-border-primary">
            <div className="p-4 space-y-4">
              <div className="flex items-center justify-between gap-3">
                <h2 className="text-lg font-semibold text-primary">Image Classifier Monitoring & Management</h2>
                <div className="flex gap-2">
                  <Button
                    variant="secondary"
                    onClick={loadQueueHealth}
                    disabled={loadingQueueHealth || isBusy}
                  >
                    {loadingQueueHealth ? 'Checking Queue...' : 'Refresh Queue'}
                  </Button>
                  <Button
                    variant="secondary"
                    onClick={loadImageInsights}
                    disabled={loadingImageInsights || isBusy}
                  >
                    {loadingImageInsights ? 'Loading Metrics...' : 'Refresh Metrics'}
                  </Button>
                </div>
              </div>
              <TableBlock title="Monitoring" rows={imageMonitoringRows} />
              
              {/* Classification Counts Section */}
              {imageInsights?.classifications && imageInsights.classifications.length > 0 && (
                <div className="space-y-2">
                  <h3 className="text-base font-semibold text-primary">
                    Classification Counts (Last 7 days)
                  </h3>
                  <div className="text-xs text-tertiary mb-2">
                    Retrain Threshold: {formatNumber(imageInsights?.training?.retrainThreshold)} for each class
                  </div>
                  <div className="overflow-x-auto border border-border-primary rounded-lg">
                    <table className="min-w-full">
                      <thead className="bg-surface-secondary">
                        <tr>
                          <th className={TABLE_HEAD_CLASS}>Herb Name</th>
                          <th className={TABLE_HEAD_CLASS}>Count</th>
                          <th className={TABLE_HEAD_CLASS}>Percentage</th>
                        </tr>
                      </thead>
                      <tbody>
                        {imageInsights.classifications.map((classification, index) => {
                          const totalClassifications = imageInsights.classifications.reduce((sum, c) => sum + c.count, 0);
                          const percentage = totalClassifications > 0 
                            ? ((classification.count / totalClassifications) * 100).toFixed(1)
                            : '0.0';
                          return (
                            <tr key={index} className="border-t border-border-primary">
                              <td className={TABLE_CELL_CLASS}>{classification.herb_name || 'Unknown'}</td>
                              <td className={TABLE_CELL_CLASS}>{formatNumber(classification.count)}</td>
                              <td className={TABLE_CELL_CLASS}>{percentage}%</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
              
              {imageInsightsError ? <p className="text-sm text-intent-danger">{imageInsightsError}</p> : null}
              {queueHealthError ? <p className="text-sm text-intent-danger">{queueHealthError}</p> : null}
            </div>
          </Card>
        )}

        {/* Recommendation tab disabled */}
        {/* {activeTab === 'recommendation' && (
          <Card className="border-border-primary">
            <div className="p-4 space-y-4">
              <div className="flex items-center justify-between gap-3">
                <h2 className="text-lg font-semibold text-primary">Recommendation Engine Monitoring & Management</h2>
                <Button
                  variant="secondary"
                  onClick={loadRecommendationInsights}
                  disabled={loadingRecommendationInsights || isBusy}
                >
                  {loadingRecommendationInsights ? 'Loading Metrics...' : 'Refresh Metrics'}
                </Button>
              </div>
              <TableBlock title="Monitoring" rows={recommendationMonitoringRows} />
              {recommendationInsightsError ? (
                <p className="text-sm text-intent-danger">{recommendationInsightsError}</p>
              ) : null}
            </div>
          </Card>
        )} */}

        {activeTab === 'chatbot' && (
          <Card className="border-border-primary">
            <div className="p-4 space-y-4">
              <div className="flex items-center justify-between gap-3">
                <h2 className="text-lg font-semibold text-primary">Chatbot Monitoring & Management</h2>
                <div className="flex gap-2">
                  <Button
                    variant="secondary"
                    onClick={loadChatbotInsights}
                    disabled={loadingChatbotInsights}
                  >
                    {loadingChatbotInsights ? 'Loading Metrics...' : 'Refresh Chatbot Metrics'}
                  </Button>
                  <Button
                    variant="secondary"
                    onClick={loadMonitoringOverview}
                    disabled={loadingMonitoringOverview}
                  >
                    {loadingMonitoringOverview ? 'Loading...' : 'Refresh Overview'}
                  </Button>
                </div>
              </div>
              <TableBlock title="Monitoring" rows={chatbotMonitoringRows} />
              {chatbotInsightsError ? (
                <p className="text-sm text-intent-danger">{chatbotInsightsError}</p>
              ) : null}
              {monitoringOverviewError ? (
                <p className="text-sm text-intent-danger">{monitoringOverviewError}</p>
              ) : null}
              {chatbotSettingsError ? (
                <p className="text-sm text-intent-danger">{chatbotSettingsError}</p>
              ) : null}
              <div className="overflow-x-auto border border-border-primary rounded-lg">
                <table className="min-w-full">
                  <thead className="bg-surface-secondary">
                    <tr>
                      <th className={TABLE_HEAD_CLASS}>Management Item</th>
                      <th className={TABLE_HEAD_CLASS}>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="border-t border-border-primary">
                      <td className={TABLE_CELL_CLASS}>Global chatbot availability</td>
                      <td className={TABLE_CELL_CLASS}>
                        <Button
                          variant={chatbotSettings?.chatbotEnabled ? 'secondary' : 'primary'}
                          onClick={handleToggleChatbot}
                          disabled={updatingChatbotSettings || !chatbotSettings}
                        >
                          {updatingChatbotSettings
                            ? 'Updating...'
                            : chatbotSettings?.chatbotEnabled
                              ? 'Disable Chatbot'
                              : 'Enable Chatbot'}
                        </Button>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </Card>
        )}

        {showJobCard && (
          <Card className="border-border-primary">
            <div className={`p-4 text-sm space-y-2 ${jobToneClass}`}>
              <div>{jobMessage}</div>
              <div className="text-primary">service: {jobService || 'unknown'}</div>
              <div className="text-primary">status: {statusLabel}</div>
              {jobTaskId ? <div className="text-primary">task_id: {jobTaskId}</div> : null}
              {lastStatusSnapshot && (
                <div className="text-primary">
                  <div>last_ready: {String(lastStatusSnapshot.ready)}</div>
                  <div>last_successful: {String(lastStatusSnapshot.successful)}</div>
                  {lastStatusSnapshot.error ? <div>last_error: {String(lastStatusSnapshot.error)}</div> : null}
                  <details className="mt-1">
                    <summary>last_status_payload</summary>
                    <pre className="text-xs overflow-x-auto whitespace-pre-wrap">
                      {JSON.stringify(lastStatusSnapshot, null, 2)}
                    </pre>
                  </details>
                </div>
              )}
              {jobDetail && (
                <div className="text-primary">
                  <div>result_status: {String(jobDetail.status || jobDetail.state || 'unknown')}</div>
                  {jobDetail.version ? <div>version: {jobDetail.version}</div> : null}
                  {jobDetail.val_accuracy != null ? <div>val_accuracy: {jobDetail.val_accuracy}</div> : null}
                  {jobDetail.val_loss != null ? <div>val_loss: {jobDetail.val_loss}</div> : null}
                  {jobDetail.trained_at ? <div>trained_at: {jobDetail.trained_at}</div> : null}
                  {jobDetail.reason ? <div>reason: {jobDetail.reason}</div> : null}
                  {jobDetail.cv_scores?.accuracy_mean != null ? <div>cv_accuracy_mean: {jobDetail.cv_scores.accuracy_mean}</div> : null}
                  {jobDetail.cv_scores?.rmse_mean != null ? <div>cv_rmse_mean: {jobDetail.cv_scores.rmse_mean}</div> : null}
                </div>
              )}
            </div>
          </Card>
        )}
      </div>
    </div>
  );
};

export default MLManagementPage;
