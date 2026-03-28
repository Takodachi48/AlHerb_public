const express = require('express');
const mongoose = require('mongoose');
const Feedback = require('../models/Feedback');
const RecommendationTrainingRun = require('../models/RecommendationTrainingRun');
const ImageClassifierPrediction = require('../models/ImageClassifierPrediction');
const ImageClassifierFeedback = require('../models/ImageClassifierFeedback');
const ImageClassifierTrainingData = require('../models/ImageClassifierTrainingData');
const ImageClassifierModelVersion = require('../models/ImageClassifierModelVersion');
const { asyncHandler } = require('../middleware/asyncHandler');
const { requireInternalKey, requireInternalOrigin } = require('../middleware/internalAccess');
const { logger } = require('../utils/logger');

const router = express.Router();

const isPlainObject = (value) => Boolean(value) && typeof value === 'object' && !Array.isArray(value);
const isNonEmptyString = (value) => typeof value === 'string' && value.trim().length > 0;
const IDEMPOTENCY_HEADER = 'x-idempotency-key';
const INTERNAL_ML_METRICS_WINDOW = Math.max(10, Number.parseInt(process.env.INTERNAL_ML_METRICS_WINDOW || '100', 10) || 100);
const INTERNAL_ML_FAILURE_WARN_THRESHOLD = Math.min(
  1,
  Math.max(0, Number.parseFloat(process.env.INTERNAL_ML_FAILURE_WARN_THRESHOLD || '0.2') || 0.2)
);
const INTERNAL_ML_ALERT_MIN_SAMPLES = Math.max(1, Number.parseInt(process.env.INTERNAL_ML_ALERT_MIN_SAMPLES || '20', 10) || 20);
const INTERNAL_ML_ALERT_COOLDOWN_MS = Math.max(1000, Number.parseInt(process.env.INTERNAL_ML_ALERT_COOLDOWN_MS || '300000', 10) || 300000);

const internalMlMetrics = {
  startedAt: new Date().toISOString(),
  counters: Object.create(null),
  windows: Object.create(null),
  alerts: Object.create(null),
};

const trackMlMetric = (endpoint, field) => {
  if (!internalMlMetrics.counters[endpoint]) {
    internalMlMetrics.counters[endpoint] = {
      success: 0,
      idempotent_hit: 0,
      failure: 0,
    };
  }
  if (typeof internalMlMetrics.counters[endpoint][field] !== 'number') return;
  internalMlMetrics.counters[endpoint][field] += 1;

  if (!internalMlMetrics.windows[endpoint]) {
    internalMlMetrics.windows[endpoint] = [];
  }
  internalMlMetrics.windows[endpoint].push(field);
  if (internalMlMetrics.windows[endpoint].length > INTERNAL_ML_METRICS_WINDOW) {
    internalMlMetrics.windows[endpoint].shift();
  }

  const samples = internalMlMetrics.windows[endpoint];
  const total = samples.length;
  const failures = samples.reduce((acc, item) => acc + (item === 'failure' ? 1 : 0), 0);
  const failureRate = total > 0 ? failures / total : 0;

  if (total < INTERNAL_ML_ALERT_MIN_SAMPLES || failureRate < INTERNAL_ML_FAILURE_WARN_THRESHOLD) {
    return;
  }

  const now = Date.now();
  const lastAlertAt = internalMlMetrics.alerts[endpoint]?.lastAlertAt || 0;
  if (now - lastAlertAt < INTERNAL_ML_ALERT_COOLDOWN_MS) {
    return;
  }

  internalMlMetrics.alerts[endpoint] = {
    lastAlertAt: now,
    total,
    failures,
    failureRate,
  };
  logger.warn(
    `Internal ML write alert: ${endpoint} failure_rate=${(failureRate * 100).toFixed(1)}% ` +
    `(${failures}/${total}) threshold=${(INTERNAL_ML_FAILURE_WARN_THRESHOLD * 100).toFixed(1)}%`
  );
};

const parseDateField = (value, fieldName) => {
  if (value == null) return undefined;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return { error: `Field "${fieldName}" must be a valid ISO 8601 date` };
  }
  return { value: parsed };
};

const parseNumberField = (value, fieldName, { min, max } = {}) => {
  if (value == null) return undefined;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return { error: `Field "${fieldName}" must be a valid number` };
  }
  if (min != null && parsed < min) {
    return { error: `Field "${fieldName}" must be >= ${min}` };
  }
  if (max != null && parsed > max) {
    return { error: `Field "${fieldName}" must be <= ${max}` };
  }
  return { value: parsed };
};

const parseIdempotencyKey = (req) => {
  const key = req.get(IDEMPOTENCY_HEADER);
  if (key == null || key === '') return { key: null };
  if (!isNonEmptyString(key)) {
    return { error: `Header "${IDEMPOTENCY_HEADER}" must be a non-empty string` };
  }
  if (key.length > 128) {
    return { error: `Header "${IDEMPOTENCY_HEADER}" must be at most 128 characters` };
  }
  return { key: key.trim() };
};

const buildWindowSnapshot = () => (
  Object.fromEntries(
    Object.entries(internalMlMetrics.windows).map(([endpoint, samples]) => {
      const total = samples.length;
      const failures = samples.reduce((acc, item) => acc + (item === 'failure' ? 1 : 0), 0);
      const failureRate = total > 0 ? failures / total : 0;
      return [endpoint, { windowSize: total, failures, failureRate }];
    })
  )
);

const buildSummarySnapshot = () => {
  const windows = buildWindowSnapshot();
  const endpoints = Object.keys(internalMlMetrics.counters);
  const summary = endpoints.map((endpoint) => {
    const counts = internalMlMetrics.counters[endpoint] || { success: 0, idempotent_hit: 0, failure: 0 };
    const window = windows[endpoint] || { windowSize: 0, failures: 0, failureRate: 0 };
    const hasEnoughSamples = window.windowSize >= INTERNAL_ML_ALERT_MIN_SAMPLES;
    const alerting = hasEnoughSamples && window.failureRate >= INTERNAL_ML_FAILURE_WARN_THRESHOLD;

    return {
      endpoint,
      status: alerting ? 'alerting' : 'ok',
      counts,
      recent: window,
    };
  });

  return {
    generatedAt: new Date().toISOString(),
    status: summary.some((item) => item.status === 'alerting') ? 'alerting' : 'ok',
    endpoints: summary,
  };
};

router.get('/metrics/ml-writes', requireInternalOrigin, requireInternalKey, (req, res) => {
  const windows = buildWindowSnapshot();

  return res.json({
    startedAt: internalMlMetrics.startedAt,
    counters: internalMlMetrics.counters,
    windows,
    alerts: internalMlMetrics.alerts,
    config: {
      windowSize: INTERNAL_ML_METRICS_WINDOW,
      failureWarnThreshold: INTERNAL_ML_FAILURE_WARN_THRESHOLD,
      alertMinSamples: INTERNAL_ML_ALERT_MIN_SAMPLES,
      alertCooldownMs: INTERNAL_ML_ALERT_COOLDOWN_MS,
    },
  });
});

router.get('/metrics/ml-writes/summary', requireInternalOrigin, requireInternalKey, (req, res) => {
  return res.json(buildSummarySnapshot());
});

router.get('/feedback/training-data', requireInternalOrigin, requireInternalKey, asyncHandler(async (req, res) => {
  try {
    const parsed = Number.parseInt(req.query.limit, 10);
    const limit = Number.isFinite(parsed) && parsed > 0 ? Math.min(parsed, 50000) : 5000;
    const trainingData = await Feedback.getTrainingData(limit);
    res.json(trainingData);
  } catch (error) {
    res.status(500).json({ error: 'Failed to load training data', details: error.message });
  }
}));

router.get('/feedback/count', requireInternalOrigin, requireInternalKey, asyncHandler(async (req, res) => {
  try {
    const query = { isActive: true };
    const since = req.query.since;
    if (since) {
      const parsed = new Date(since);
      if (Number.isNaN(parsed.getTime())) {
        return res.status(400).json({ error: 'Invalid since date. Use ISO 8601 format.' });
      }
      query.createdAt = { $gt: parsed };
    }

    const count = await Feedback.countDocuments(query);
    return res.json({ count });
  } catch (error) {
    return res.status(500).json({ error: 'Failed to count feedback', details: error.message });
  }
}));

router.get('/recommendation/training-runs/latest-successful', requireInternalOrigin, requireInternalKey, asyncHandler(async (req, res) => {
  try {
    const latest = await RecommendationTrainingRun.findOne({ saved: true })
      .sort({ trained_at: -1, createdAt: -1 })
      .lean();

    return res.json({ latest: latest || null });
  } catch (error) {
    return res.status(500).json({ error: 'Failed to load latest recommendation training run', details: error.message });
  }
}));

router.post('/recommendation/training-runs', requireInternalOrigin, requireInternalKey, asyncHandler(async (req, res) => {
  const metricKey = 'POST /internal/recommendation/training-runs';
  try {
    const payload = req.body;

    if (!isPlainObject(payload)) {
      return res.status(400).json({ error: 'Request body must be a JSON object' });
    }

    if (typeof payload.saved !== 'boolean') {
      return res.status(400).json({ error: 'Field "saved" must be a boolean' });
    }

    const trainedAt = parseDateField(payload.trained_at, 'trained_at');
    if (trainedAt?.error) return res.status(400).json({ error: trainedAt.error });

    const runStartedAt = parseDateField(payload.run_started_at, 'run_started_at');
    if (runStartedAt?.error) return res.status(400).json({ error: runStartedAt.error });

    const recordCount = parseNumberField(payload.record_count, 'record_count', { min: 0 });
    if (recordCount?.error) return res.status(400).json({ error: recordCount.error });

    const idempotency = parseIdempotencyKey(req);
    if (idempotency.error) return res.status(400).json({ error: idempotency.error });

    const created = await RecommendationTrainingRun.create({
      ...payload,
      idempotency_key: idempotency.key,
      trained_at: trainedAt?.value ?? payload.trained_at,
      run_started_at: runStartedAt?.value ?? payload.run_started_at,
      record_count: recordCount?.value ?? payload.record_count,
    });
    trackMlMetric(metricKey, 'success');
    return res.status(201).json({ id: created._id.toString() });
  } catch (error) {
    if (error && error.code === 11000 && error.keyPattern?.idempotency_key) {
      const existing = await RecommendationTrainingRun.findOne({ idempotency_key: req.get(IDEMPOTENCY_HEADER) }).lean();
      if (existing) {
        trackMlMetric(metricKey, 'idempotent_hit');
        return res.status(200).json({ id: existing._id.toString(), idempotent: true });
      }
    }
    trackMlMetric(metricKey, 'failure');
    logger.warn(`Internal ML write failed: ${metricKey} - ${error.message}`);
    return res.status(500).json({ error: 'Failed to persist recommendation training run', details: error.message });
  }
}));

router.post('/image-classifier/predictions', requireInternalOrigin, requireInternalKey, asyncHandler(async (req, res) => {
  const metricKey = 'POST /internal/image-classifier/predictions';
  try {
    const payload = req.body;
    if (!isPlainObject(payload)) {
      return res.status(400).json({ error: 'Request body must be a JSON object' });
    }
    if (!isNonEmptyString(payload.prediction_id)) {
      return res.status(400).json({ error: 'Field "prediction_id" is required' });
    }
    if (!isNonEmptyString(payload.image_url)) {
      return res.status(400).json({ error: 'Field "image_url" is required' });
    }

    const predictedHerbId = parseNumberField(payload.predicted_herb_id, 'predicted_herb_id');
    if (predictedHerbId?.error) return res.status(400).json({ error: predictedHerbId.error });

    const confidence = parseNumberField(payload.confidence, 'confidence', { min: 0, max: 1 });
    if (confidence?.error) return res.status(400).json({ error: confidence.error });

    const inferenceTime = parseNumberField(payload.inference_time_ms, 'inference_time_ms', { min: 0 });
    if (inferenceTime?.error) return res.status(400).json({ error: inferenceTime.error });

    const createdAt = parseDateField(payload.created_at, 'created_at');
    if (createdAt?.error) return res.status(400).json({ error: createdAt.error });

    if (payload.top_5_predictions != null && !Array.isArray(payload.top_5_predictions)) {
      return res.status(400).json({ error: 'Field "top_5_predictions" must be an array' });
    }

    const idempotency = parseIdempotencyKey(req);
    if (idempotency.error) return res.status(400).json({ error: idempotency.error });

    const created = await ImageClassifierPrediction.create({
      ...payload,
      idempotency_key: idempotency.key,
      predicted_herb_id: predictedHerbId?.value ?? payload.predicted_herb_id,
      confidence: confidence?.value ?? payload.confidence,
      inference_time_ms: inferenceTime?.value ?? payload.inference_time_ms,
      created_at: createdAt?.value ?? payload.created_at,
    });
    trackMlMetric(metricKey, 'success');
    return res.status(201).json({ id: created._id.toString() });
  } catch (error) {
    if (error && error.code === 11000 && error.keyPattern?.idempotency_key) {
      const existing = await ImageClassifierPrediction.findOne({ idempotency_key: req.get(IDEMPOTENCY_HEADER) }).lean();
      if (existing) {
        trackMlMetric(metricKey, 'idempotent_hit');
        return res.status(200).json({ id: existing._id.toString(), idempotent: true });
      }
    }
    if (error && error.code === 11000) {
      trackMlMetric(metricKey, 'failure');
      return res.status(409).json({ error: 'Prediction already exists' });
    }
    trackMlMetric(metricKey, 'failure');
    logger.warn(`Internal ML write failed: ${metricKey} - ${error.message}`);
    return res.status(500).json({ error: 'Failed to persist prediction', details: error.message });
  }
}));

router.get('/image-classifier/predictions/:predictionId', requireInternalOrigin, requireInternalKey, asyncHandler(async (req, res) => {
  try {
    if (!isNonEmptyString(req.params.predictionId)) {
      return res.status(400).json({ error: 'predictionId is required' });
    }

    const prediction = await ImageClassifierPrediction.findOne({
      prediction_id: req.params.predictionId,
    }).lean();

    if (!prediction) {
      return res.status(404).json({ error: 'Prediction not found' });
    }

    return res.json({ prediction });
  } catch (error) {
    return res.status(500).json({ error: 'Failed to load prediction', details: error.message });
  }
}));

router.post('/image-classifier/feedback', requireInternalOrigin, requireInternalKey, asyncHandler(async (req, res) => {
  const metricKey = 'POST /internal/image-classifier/feedback';
  try {
    const payload = req.body;
    if (!isPlainObject(payload)) {
      return res.status(400).json({ error: 'Request body must be a JSON object' });
    }
    if (!isNonEmptyString(payload.prediction_id)) {
      return res.status(400).json({ error: 'Field "prediction_id" is required' });
    }
    if (!isNonEmptyString(payload.correct_herb_name)) {
      return res.status(400).json({ error: 'Field "correct_herb_name" is required' });
    }
    if (!isNonEmptyString(payload.correct_scientific_name)) {
      return res.status(400).json({ error: 'Field "correct_scientific_name" is required' });
    }

    const herbId = parseNumberField(payload.correct_herb_id, 'correct_herb_id');
    if (herbId?.error) return res.status(400).json({ error: herbId.error });

    const createdAt = parseDateField(payload.created_at, 'created_at');
    if (createdAt?.error) return res.status(400).json({ error: createdAt.error });

    const idempotency = parseIdempotencyKey(req);
    if (idempotency.error) return res.status(400).json({ error: idempotency.error });

    const created = await ImageClassifierFeedback.create({
      ...payload,
      idempotency_key: idempotency.key,
      correct_herb_id: herbId?.value ?? payload.correct_herb_id,
      created_at: createdAt?.value ?? payload.created_at,
    });
    trackMlMetric(metricKey, 'success');
    return res.status(201).json({ id: created._id.toString() });
  } catch (error) {
    if (error && error.code === 11000 && error.keyPattern?.idempotency_key) {
      const existing = await ImageClassifierFeedback.findOne({ idempotency_key: req.get(IDEMPOTENCY_HEADER) }).lean();
      if (existing) {
        trackMlMetric(metricKey, 'idempotent_hit');
        return res.status(200).json({ id: existing._id.toString(), idempotent: true });
      }
    }
    trackMlMetric(metricKey, 'failure');
    logger.warn(`Internal ML write failed: ${metricKey} - ${error.message}`);
    return res.status(500).json({ error: 'Failed to persist feedback', details: error.message });
  }
}));

router.post('/image-classifier/training-data', requireInternalOrigin, requireInternalKey, asyncHandler(async (req, res) => {
  const metricKey = 'POST /internal/image-classifier/training-data';
  try {
    const payload = req.body;
    if (!isPlainObject(payload)) {
      return res.status(400).json({ error: 'Request body must be a JSON object' });
    }
    if (!isNonEmptyString(payload.image_url)) {
      return res.status(400).json({ error: 'Field "image_url" is required' });
    }
    if (!isNonEmptyString(payload.herb_name)) {
      return res.status(400).json({ error: 'Field "herb_name" is required' });
    }
    if (!isNonEmptyString(payload.scientific_name)) {
      return res.status(400).json({ error: 'Field "scientific_name" is required' });
    }

    const herbId = parseNumberField(payload.herb_id, 'herb_id');
    if (herbId?.error) return res.status(400).json({ error: herbId.error });

    const createdAt = parseDateField(payload.created_at, 'created_at');
    if (createdAt?.error) return res.status(400).json({ error: createdAt.error });

    const lastUsedAt = parseDateField(payload.last_used_at, 'last_used_at');
    if (lastUsedAt?.error) return res.status(400).json({ error: lastUsedAt.error });

    if (payload.is_new != null && typeof payload.is_new !== 'boolean') {
      return res.status(400).json({ error: 'Field "is_new" must be a boolean' });
    }
    if (payload.used_in_training != null && typeof payload.used_in_training !== 'boolean') {
      return res.status(400).json({ error: 'Field "used_in_training" must be a boolean' });
    }

    const idempotency = parseIdempotencyKey(req);
    if (idempotency.error) return res.status(400).json({ error: idempotency.error });

    const created = await ImageClassifierTrainingData.create({
      ...payload,
      idempotency_key: idempotency.key,
      herb_id: herbId?.value ?? payload.herb_id,
      created_at: createdAt?.value ?? payload.created_at,
      last_used_at: lastUsedAt?.value ?? payload.last_used_at,
    });
    trackMlMetric(metricKey, 'success');
    return res.status(201).json({ id: created._id.toString() });
  } catch (error) {
    if (error && error.code === 11000 && error.keyPattern?.idempotency_key) {
      const existing = await ImageClassifierTrainingData.findOne({ idempotency_key: req.get(IDEMPOTENCY_HEADER) }).lean();
      if (existing) {
        trackMlMetric(metricKey, 'idempotent_hit');
        return res.status(200).json({ id: existing._id.toString(), idempotent: true });
      }
    }
    trackMlMetric(metricKey, 'failure');
    logger.warn(`Internal ML write failed: ${metricKey} - ${error.message}`);
    return res.status(500).json({ error: 'Failed to persist training data', details: error.message });
  }
}));

router.get('/image-classifier/training-data', requireInternalOrigin, requireInternalKey, asyncHandler(async (req, res) => {
  try {
    const isNewParam = req.query.is_new;
    if (isNewParam != null && isNewParam !== 'true' && isNewParam !== 'false') {
      return res.status(400).json({ error: 'Query "is_new" must be "true" or "false"' });
    }

    const limitParam = Number.parseInt(req.query.limit, 10);
    const limit = Number.isFinite(limitParam) && limitParam > 0 ? Math.min(limitParam, 50000) : 2000;

    const query = {};
    if (isNewParam === 'true') query.is_new = true;
    if (isNewParam === 'false') query.is_new = false;

    const items = await ImageClassifierTrainingData.find(query)
      .sort({ created_at: -1 })
      .limit(limit)
      .lean();

    return res.json({
      items: items.map((item) => ({ ...item, id: item._id?.toString() })),
    });
  } catch (error) {
    return res.status(500).json({ error: 'Failed to load training data', details: error.message });
  }
}));

router.post('/image-classifier/training-data/mark-used', requireInternalOrigin, requireInternalKey, asyncHandler(async (req, res) => {
  const metricKey = 'POST /internal/image-classifier/training-data/mark-used';
  try {
    const ids = Array.isArray(req.body?.sampleIds) ? req.body.sampleIds.filter((id) => isNonEmptyString(id)) : [];
    if (ids.length === 0) {
      return res.status(400).json({ error: 'Field "sampleIds" must contain at least one id' });
    }
    if (!ids.every((id) => mongoose.Types.ObjectId.isValid(id))) {
      return res.status(400).json({ error: 'All sampleIds must be valid ObjectId strings' });
    }

    const result = await ImageClassifierTrainingData.updateMany(
      { _id: { $in: ids.map((id) => new mongoose.Types.ObjectId(id)) } },
      {
        $set: {
          is_new: false,
          used_in_training: true,
          last_used_at: new Date(),
        },
      }
    );

    trackMlMetric(metricKey, 'success');
    return res.json({ modifiedCount: result.modifiedCount });
  } catch (error) {
    trackMlMetric(metricKey, 'failure');
    logger.warn(`Internal ML write failed: ${metricKey} - ${error.message}`);
    return res.status(500).json({ error: 'Failed to mark training data as used', details: error.message });
  }
}));

router.get('/image-classifier/training-state', requireInternalOrigin, requireInternalKey, asyncHandler(async (req, res) => {
  try {
    const [newSamplesCount, lastModel] = await Promise.all([
      ImageClassifierTrainingData.countDocuments({ is_new: true }),
      ImageClassifierModelVersion.findOne().sort({ trained_at: -1 }).lean(),
    ]);

    return res.json({
      newSamplesCount,
      lastModel: lastModel || null,
    });
  } catch (error) {
    return res.status(500).json({ error: 'Failed to load training state', details: error.message });
  }
}));

router.get('/image-classifier/model-versions/active', requireInternalOrigin, requireInternalKey, asyncHandler(async (req, res) => {
  try {
    const active = await ImageClassifierModelVersion.findOne({ is_active: true }).sort({ trained_at: -1 }).lean();
    return res.json({ active: active || null });
  } catch (error) {
    return res.status(500).json({ error: 'Failed to load active model version', details: error.message });
  }
}));

router.post('/image-classifier/model-versions/activate', requireInternalOrigin, requireInternalKey, asyncHandler(async (req, res) => {
  const metricKey = 'POST /internal/image-classifier/model-versions/activate';
  try {
    const payload = req.body;
    if (!isPlainObject(payload)) {
      return res.status(400).json({ error: 'Request body must be a JSON object' });
    }
    if (!isNonEmptyString(payload.version)) {
      return res.status(400).json({ error: 'Field "version" is required' });
    }

    if (payload.model_path != null && !isNonEmptyString(payload.model_path)) {
      return res.status(400).json({ error: 'Field "model_path" must be a non-empty string' });
    }

    const valAccuracy = parseNumberField(payload.val_accuracy, 'val_accuracy');
    if (valAccuracy?.error) return res.status(400).json({ error: valAccuracy.error });

    const valLoss = parseNumberField(payload.val_loss, 'val_loss');
    if (valLoss?.error) return res.status(400).json({ error: valLoss.error });

    const trainedAt = parseDateField(payload.trained_at, 'trained_at');
    if (trainedAt?.error) return res.status(400).json({ error: trainedAt.error });

    const idempotency = parseIdempotencyKey(req);
    if (idempotency.error) return res.status(400).json({ error: idempotency.error });
    if (idempotency.key) {
      const existing = await ImageClassifierModelVersion.findOne({ idempotency_key: idempotency.key }).lean();
      if (existing) {
        trackMlMetric(metricKey, 'idempotent_hit');
        return res.status(200).json({ id: existing._id.toString(), idempotent: true });
      }
    }

    await ImageClassifierModelVersion.updateMany({}, { $set: { is_active: false } });
    const created = await ImageClassifierModelVersion.create({
      ...payload,
      idempotency_key: idempotency.key,
      val_accuracy: valAccuracy?.value ?? payload.val_accuracy,
      val_loss: valLoss?.value ?? payload.val_loss,
      trained_at: trainedAt?.value ?? payload.trained_at,
      is_active: true,
    });
    trackMlMetric(metricKey, 'success');
    return res.status(201).json({ id: created._id.toString() });
  } catch (error) {
    if (error && error.code === 11000 && error.keyPattern?.idempotency_key) {
      const existing = await ImageClassifierModelVersion.findOne({ idempotency_key: req.get(IDEMPOTENCY_HEADER) }).lean();
      if (existing) {
        trackMlMetric(metricKey, 'idempotent_hit');
        return res.status(200).json({ id: existing._id.toString(), idempotent: true });
      }
    }
    trackMlMetric(metricKey, 'failure');
    logger.warn(`Internal ML write failed: ${metricKey} - ${error.message}`);
    return res.status(500).json({ error: 'Failed to activate model version', details: error.message });
  }
}));

module.exports = router;
