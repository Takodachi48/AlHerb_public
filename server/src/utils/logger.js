const winston = require('winston');
const path = require('path');

// Define log levels
const levels = {
  error: 0,
  warn: 1,
  info: 2,
  http: 3,
  debug: 4,
};

// Define colors for each level
const colors = {
  error: 'red',
  warn: 'yellow',
  info: 'green',
  http: 'magenta',
  debug: 'white',
};

// Tell winston that you want to link the colors
winston.addColors(colors);

// Define which level to log based on environment
const level = () => {
  const override = process.env.LOG_LEVEL ? String(process.env.LOG_LEVEL).toLowerCase().trim() : '';
  if (override && Object.prototype.hasOwnProperty.call(levels, override)) {
    return override;
  }
  const env = process.env.NODE_ENV || 'development';
  const isDevelopment = env === 'development';
  return isDevelopment ? 'debug' : 'warn';
};

// Define format for logs
const format = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss:ms' }),
  winston.format.colorize({ all: true }),
  winston.format.printf(
    (info) => `${info.timestamp} ${info.level}: ${info.message}`,
  ),
);

// Define transports
const transports = [
  // Console transport
  new winston.transports.Console({
    format: winston.format.combine(
      winston.format.colorize(),
      winston.format.simple()
    ),
  }),

  // File transport for errors
  new winston.transports.File({
    filename: path.join(__dirname, '../../logs/error.log'),
    level: 'error',
    format: winston.format.combine(
      winston.format.timestamp(),
      winston.format.json()
    ),
  }),

  // File transport for all logs
  new winston.transports.File({
    filename: path.join(__dirname, '../../logs/combined.log'),
    format: winston.format.combine(
      winston.format.timestamp(),
      winston.format.json()
    ),
  }),
];

// Create the logger
const logger = winston.createLogger({
  level: level(),
  levels,
  format,
  transports,
  exitOnError: false,
});

// Create logs directory if it doesn't exist
const fs = require('fs');
const logsDir = path.join(__dirname, '../../logs');
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

// Custom logging methods for specific contexts

/**
 * Factory function to create specialized loggers
 * @param {string} type - The log type (e.g., 'auth', 'ml', 'database')
 * @param {string[]} contextFields - Field names for context parameters
 * @returns {Function} Specialized logging function
 */
const createLoggerFactory = (type, contextFields = []) => {
  return (action, ...args) => {
    const context = {};
    contextFields.forEach((field, index) => {
      if (args[index] !== undefined) {
        context[field] = args[index];
      }
    });

    // Last argument is always details object
    const details = args[contextFields.length] || {};

    logger.info(`${type.toUpperCase()}: ${action}`, {
      type,
      action,
      ...context,
      details,
      timestamp: new Date().toISOString(),
    });
  };
};

// Pre-configured loggers using factory
const logAuth = createLoggerFactory('auth', ['userId']);
const logML = createLoggerFactory('ml', ['modelType']);
const logDatabase = createLoggerFactory('database', ['collection']);
const logUserAction = createLoggerFactory('user_action', ['userId']);

// Special loggers with custom logic (can't use simple factory)
const logAPI = (method, url, statusCode, responseTime, userId = null, details = {}) => {
  logger.http(`API: ${method} ${url}`, {
    type: 'api',
    method,
    url,
    statusCode,
    responseTime: `${responseTime}ms`,
    userId,
    details,
    timestamp: new Date().toISOString(),
  });
};

const logSecurity = (event, severity, details = {}) => {
  const level = severity === 'high' ? 'error' : severity === 'medium' ? 'warn' : 'info';
  logger[level](`SECURITY: ${event}`, {
    type: 'security',
    event,
    severity,
    details,
    timestamp: new Date().toISOString(),
  });
};

const logPerformance = (operation, duration, details = {}) => {
  const level = duration > 5000 ? 'warn' : 'info';
  logger[level](`PERFORMANCE: ${operation} took ${duration}ms`, {
    type: 'performance',
    operation,
    duration,
    details,
    timestamp: new Date().toISOString(),
  });
};

const logError = (error, context = {}) => {
  logger.error('APPLICATION ERROR', {
    type: 'error',
    message: error.message,
    stack: error.stack,
    context,
    timestamp: new Date().toISOString(),
  });
};

// Middleware for logging HTTP requests
const httpLogger = (req, res, next) => {
  const start = Date.now();

  res.on('finish', () => {
    const duration = Date.now() - start;
    const userId = req.user ? req.user.uid : null;

    logAPI(
      req.method,
      req.originalUrl,
      res.statusCode,
      duration,
      userId,
      {
        ip: req.ip,
        userAgent: req.get('User-Agent'),
        contentLength: res.get('Content-Length'),
      }
    );
  });

  next();
};

// Function to log system startup
const logStartup = () => {
  logger.info('SYSTEM STARTUP', {
    type: 'system',
    event: 'startup',
    nodeVersion: process.version,
    platform: process.platform,
    env: process.env.NODE_ENV,
    timestamp: new Date().toISOString(),
  });
};

// Function to log system shutdown
const logShutdown = () => {
  logger.info('SYSTEM SHUTDOWN', {
    type: 'system',
    event: 'shutdown',
    timestamp: new Date().toISOString(),
  });
};

// Function to get log statistics
const getLogStats = () => {
  return {
    level: logger.level,
    transports: logger.transports.length,
    uptime: process.uptime(),
    memoryUsage: process.memoryUsage(),
  };
};

// Function to rotate logs (if needed)
const rotateLogs = () => {
  logger.info('LOG ROTATION', {
    type: 'system',
    event: 'log_rotation',
    timestamp: new Date().toISOString(),
  });
};

// Export the main logger and custom functions
module.exports = {
  logger,
  logAuth,
  logAPI,
  logML,
  logDatabase,
  logSecurity,
  logPerformance,
  logUserAction,
  logError,
  httpLogger,
  logStartup,
  logShutdown,
  getLogStats,
  rotateLogs,
};
