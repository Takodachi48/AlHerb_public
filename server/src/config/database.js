const mongoose = require('mongoose');
const { logger } = require('../utils/logger');

let reconnectAttempts = 0;
const maxReconnectAttempts = 5;
const reconnectDelay = 5000; // 5 seconds
const transientDisconnectGraceMs = 3000;
let reconnectTimer = null;
let disconnectGraceTimer = null;
let isShuttingDown = false;
let connectPromise = null;

const getMongoUri = () => {
  const uri = process.env.MONGODB_URI;
  if (typeof uri !== 'string') return null;
  if (!uri.startsWith('mongodb://') && !uri.startsWith('mongodb+srv://')) {
    return null;
  }
  return uri;
};

const clearReconnectTimer = () => {
  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }
};

const clearDisconnectGraceTimer = () => {
  if (disconnectGraceTimer) {
    clearTimeout(disconnectGraceTimer);
    disconnectGraceTimer = null;
  }
};

const scheduleReconnect = (reason = 'unknown') => {
  if (isShuttingDown) return;
  if (mongoose.connection.readyState === 1) return;
  if (reconnectTimer) return;
  if (connectPromise) return;

  if (reconnectAttempts >= maxReconnectAttempts) {
    logger.error(`Max reconnection attempts reached after ${reason}. Shutting down...`);
    process.exit(1);
    return;
  }

  reconnectAttempts += 1;
  const delay = reconnectDelay * (2 ** (reconnectAttempts - 1));
  logger.warn(`MongoDB disconnected (${reason}). Reconnect ${reconnectAttempts}/${maxReconnectAttempts} in ${delay}ms`);

  reconnectTimer = setTimeout(async () => {
    reconnectTimer = null;

    try {
      await connectDB();
    } catch (error) {
      logger.error(`Reconnection failed: ${error.message}`);
      scheduleReconnect('reconnect-failure');
    }
  }, delay);
};

const connectDB = async () => {
  if (isShuttingDown) {
    throw new Error('Database connection aborted: shutdown in progress');
  }

  if (mongoose.connection.readyState === 1) {
    return mongoose.connection;
  }

  if (connectPromise) {
    return connectPromise;
  }

  const mongoUri = getMongoUri();
  if (!mongoUri) {
    throw new Error('No valid MongoDB URI found. Set MONGODB_URI.');
  }

  try {
    connectPromise = mongoose.connect(mongoUri, {
      maxPoolSize: 10,
      minPoolSize: 5,
      maxIdleTimeMS: 45000,
      serverSelectionTimeoutMS: 15000,
      socketTimeoutMS: 45000,
      family: 4,
      retryWrites: true,
      retryReads: true,
    });

    const conn = await connectPromise;
    connectPromise = null;

    logger.info('MongoDB Connected successfully');
    reconnectAttempts = 0; // Reset reconnect attempts on successful connection
    clearReconnectTimer();
    clearDisconnectGraceTimer();
    return conn;
  } catch (error) {
    connectPromise = null;
    logger.error('MongoDB connection error:', error);
    scheduleReconnect('connect-failure');
    throw error;
  }
};

// Handle connection events with proper logging and reconnection
mongoose.connection.on('connected', () => {
  logger.info('Mongoose connected to MongoDB');
  reconnectAttempts = 0; // Reset on successful connection
  clearReconnectTimer();
  clearDisconnectGraceTimer();
});

mongoose.connection.on('error', (err) => {
  logger.error('Mongoose connection error:', err);
});

mongoose.connection.on('disconnected', () => {
  if (isShuttingDown) return;

  clearDisconnectGraceTimer();
  disconnectGraceTimer = setTimeout(() => {
    disconnectGraceTimer = null;

    if (mongoose.connection.readyState !== 1) {
      scheduleReconnect('disconnected-event');
    }
  }, transientDisconnectGraceMs);
});

// Handle process termination gracefully
const gracefulShutdown = async (signal) => {
  try {
    isShuttingDown = true;
    clearReconnectTimer();
    clearDisconnectGraceTimer();
    logger.info(`Received ${signal}. Closing MongoDB connection...`);
    await mongoose.connection.close();
    logger.info('MongoDB connection closed successfully');
    process.exit(0);
  } catch (error) {
    logger.error('Error during MongoDB connection closure:', error);
    process.exit(1);
  }
};

// Graceful shutdown handlers
process.on('SIGINT', () => gracefulShutdown('SIGINT'));
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason) => {
  logger.error(`Unhandled Rejection: ${String(reason)}`);
  // Don't exit the process, but log it for monitoring
});

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  logger.error(`Uncaught Exception: ${error.message}`);
  // Attempt graceful shutdown
  gracefulShutdown('uncaughtException');
});

const isDatabaseReady = () => mongoose.connection.readyState === 1;

module.exports = {
  connectDB,
  isDatabaseReady,
};
