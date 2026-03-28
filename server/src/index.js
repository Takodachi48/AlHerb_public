/**
 * Summary:
 * - Hardened app bootstrap with strict CORS callback, Mongo query sanitization, and compression.
 * - Reordered middleware for correctness/performance: request id -> security -> parsers -> logging -> limiters -> routes.
 * - Fixed routing flow by placing 404 handler before global error handler and removed duplicate process-level handlers.
 */
require('dotenv').config();

const axios = require('axios');
const compression = require('compression');
const cors = require('cors');
const express = require('express');
const helmet = require('helmet');
const mongoSanitize = require('express-mongo-sanitize');
const net = require('net');

const { connectDB, isDatabaseReady } = require('./config/database');
const SearchService = require('./services/searchService');
const { authLimiter, apiLimiter, searchLimiter, inquiryLimiter, chatLimiter, mlLimiter } = require('./middleware/rateLimiter');
const analyticsEventRecorder = require('./middleware/analyticsEventRecorder');
const { errorHandler } = require('./middleware/errorHandler');
const requestIdMiddleware = require('./middleware/requestId');
const { httpLogger, logger, logStartup } = require('./utils/logger');

const app = express();
const PORT = Number(process.env.PORT) || 5000;
const NODE_ENV = process.env.NODE_ENV || 'development';

const parseTrustProxy = (rawValue) => {
  if (rawValue == null || rawValue === '') return undefined;
  const normalized = String(rawValue).trim().toLowerCase();
  if (normalized === 'true') return true;
  if (normalized === 'false') return false;
  if (/^\d+$/.test(normalized)) return Number.parseInt(normalized, 10);
  return rawValue;
};

const validateStartupConfig = () => {
  const errors = [];
  const mongoUri = process.env.MONGODB_URI;
  const internalKey = process.env.INTERNAL_API_KEY;
  const jwtSecret = process.env.JWT_SECRET;

  if (!mongoUri || !/^mongodb(\+srv)?:\/\//.test(mongoUri)) {
    errors.push('MONGODB_URI must be a valid mongodb:// or mongodb+srv:// URI');
  }
  if (!jwtSecret || jwtSecret.length < 32) {
    errors.push('JWT_SECRET must be at least 32 characters');
  }
  if (!internalKey || internalKey.length < 32) {
    errors.push('INTERNAL_API_KEY must be at least 32 characters');
  }

  if (NODE_ENV === 'production') {
    const allowedOrigins = process.env.ALLOWED_ORIGINS;
    if (!allowedOrigins) {
      errors.push('ALLOWED_ORIGINS is required in production');
    } else if (allowedOrigins.split(',').map((entry) => entry.trim()).some((entry) => entry === '*')) {
      errors.push('ALLOWED_ORIGINS must not contain "*" in production');
    }
  }

  if (errors.length > 0) {
    throw new Error(`Startup configuration invalid: ${errors.join('; ')}`);
  }
};

// Needed for correct client IP extraction behind reverse proxies/load balancers.
const trustProxy = parseTrustProxy(process.env.TRUST_PROXY);
if (typeof trustProxy !== 'undefined') {
  app.set('trust proxy', trustProxy);
}

app.disable('x-powered-by');

const allowedOrigins = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(',').map((origin) => origin.trim()).filter(Boolean)
  : ['http://localhost:5173', 'http://localhost:3000', 'http://127.0.0.1:5173'];

const corsOptions = {
  origin(origin, callback) {
    // Allow same-origin/server-to-server requests that do not send Origin.
    if (!origin || allowedOrigins.includes(origin)) {
      return callback(null, true);
    }
    const corsError = new Error('CORS origin is not allowed');
    corsError.status = 403;
    return callback(corsError);
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Internal-Key'],
};

const lazyRoute = (loader, routeName) => {
  let cachedRouter = NODE_ENV === 'test' ? loader() : null;

  if (cachedRouter && typeof cachedRouter !== 'function') {
    throw new Error(`Route module "${routeName}" must export an Express router function`);
  }

  return (req, res, next) => {
    try {
      if (!cachedRouter) {
        cachedRouter = loader();
        if (typeof cachedRouter !== 'function') {
          throw new Error(`Route module "${routeName}" must export an Express router function`);
        }
        logger.info(`Lazy-loaded route module: ${routeName}`);
      }
      return cachedRouter(req, res, next);
    } catch (error) {
      return next(error);
    }
  };
};

// Security and request correlation first.
app.use(requestIdMiddleware);
app.use(helmet({
  contentSecurityPolicy: {
    useDefaults: true,
    directives: {
      defaultSrc: ["'self'"],
      imgSrc: ["'self'", 'data:', 'https:'],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      connectSrc: ["'self'", ...allowedOrigins],
    },
  },
  frameguard: { action: 'deny' },
  referrerPolicy: { policy: 'no-referrer' },
  xContentTypeOptions: true,
}));
app.use(cors(corsOptions));
app.options('*', cors(corsOptions));
app.use(mongoSanitize({ replaceWith: '_' }));

// Keep parser limits low to reduce memory abuse surface.
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: false, limit: '1mb' }));

// Compress response payloads to reduce latency and bandwidth.
app.use(compression({ threshold: 1024 }));

app.use(httpLogger);
app.use(analyticsEventRecorder);

// Apply stricter endpoint-specific limiters before broad API limiter.
app.use('/api/auth', authLimiter);
app.use('/api/herbs/search', searchLimiter);
app.use('/api/herbs/recommend', mlLimiter);
app.use('/api/inquiries', inquiryLimiter);
app.use('/api/chat/send', chatLimiter);
app.use('/api', apiLimiter);

app.use('/api/auth', lazyRoute(() => require('./routes/auth'), 'auth'));
app.use('/api/users', lazyRoute(() => require('./routes/user'), 'user'));
app.use('/api/herbs', lazyRoute(() => require('./routes/herbs'), 'herbs'));
app.use('/api/locations', lazyRoute(() => require('./routes/locations'), 'locations'));
app.use('/api/images', lazyRoute(() => require('./routes/images'), 'images'));
app.use('/api/admin', lazyRoute(() => require('./routes/admin'), 'admin'));
app.use('/api/site-assets', lazyRoute(() => require('./routes/siteAssets'), 'siteAssets'));
app.use('/api/chat', lazyRoute(() => require('./routes/chat'), 'chat'));
app.use('/api/blogs', lazyRoute(() => require('./routes/blogs'), 'blogs'));
app.use('/api/comments', lazyRoute(() => require('./routes/comments'), 'comments'));
app.use('/api/notifications', lazyRoute(() => require('./routes/notifications'), 'notifications'));
app.use('/api/inquiries', lazyRoute(() => require('./routes/inquiries'), 'inquiries'));
app.use('/internal', lazyRoute(() => require('./routes/internal'), 'internal'));

app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'OK',
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
  });
});

const pingHttp = async (url) => {
  try {
    await axios.get(url, { timeout: 3000 });
    return { ok: true };
  } catch (error) {
    return { ok: false, error: error.message };
  }
};

const checkRedis = async () => {
  const required = process.env.REDIS_REQUIRED === 'true';
  if (!required) {
    return { ok: true, status: 'not-required' };
  }

  const redisUrl = process.env.REDIS_URL;
  if (!redisUrl) {
    return { ok: false, error: 'REDIS_URL missing while REDIS_REQUIRED=true' };
  }

  try {
    const parsed = new URL(redisUrl);
    const port = Number(parsed.port || '6379');
    const host = parsed.hostname;

    return await new Promise((resolve) => {
      const socket = net.createConnection({ host, port, timeout: 2000 }, () => {
        socket.destroy();
        resolve({ ok: true });
      });

      socket.on('error', (error) => {
        socket.destroy();
        resolve({ ok: false, error: error.message });
      });
      socket.on('timeout', () => {
        socket.destroy();
        resolve({ ok: false, error: 'timeout' });
      });
    });
  } catch (error) {
    return { ok: false, error: error.message };
  }
};

app.get('/ready', async (req, res) => {
  const db = { ok: isDatabaseReady() };
  const redis = await checkRedis();
  const imageClassifier = await pingHttp(`${(process.env.IMAGE_CLASSIFIER_URL || 'http://127.0.0.1:8000').replace(/\/+$/, '')}/api/v1/health`);
  const recommendationEngine = await pingHttp(`${(process.env.RECOMMENDATION_ENGINE_URL || 'http://127.0.0.1:8001').replace(/\/+$/, '')}/health`);

  const ready = db.ok && redis.ok && imageClassifier.ok && recommendationEngine.ok;
  const status = ready ? 200 : 503;

  return res.status(status).json({
    status: ready ? 'READY' : 'NOT_READY',
    dependencies: {
      db,
      redis,
      imageClassifier,
      recommendationEngine,
    },
    timestamp: new Date().toISOString(),
  });
});

// 404 must run before the global error handler to avoid bypassing unmatched routes.
app.use((req, res) => {
  res.status(404).json({ success: false, error: 'Route not found' });
});

app.use(errorHandler);

const startServer = async () => {
  validateStartupConfig();

  if (NODE_ENV !== 'test') {
    await connectDB();
    if (SearchService.isEnabled()) {
      SearchService.bootstrap().catch((error) => {
        logger.warn(`Meilisearch bootstrap failed: ${error.message}`);
      });
    }
  }

  app.listen(PORT, () => {
    logStartup();
    logger.info(`Server running on port ${PORT}`);
    logger.info(`Health check: http://localhost:${PORT}/health`);
    logger.info(`Readiness check: http://localhost:${PORT}/ready`);
  });
};

if (require.main === module) {
  startServer().catch((error) => {
    logger.error(`Startup failure: ${error.message}`);
    process.exit(1);
  });
}

module.exports = app;
module.exports.startServer = startServer;
