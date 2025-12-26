const winston = require('winston');
const config = require('../config');

const logger = winston.createLogger({
  level: config.logging?.level || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    config.logging?.format === 'json'
      ? winston.format.json()
      : winston.format.combine(
          winston.format.colorize(),
          winston.format.printf(({ timestamp, level, message, ...meta }) => {
            return `${timestamp} [${level}]: ${message} ${Object.keys(meta).length ? JSON.stringify(meta) : ''}`;
          })
        )
  ),
  defaultMeta: { service: 'code-roach-service' },
  transports: [
    new winston.transports.Console({
      handleExceptions: true,
      handleRejections: true,
    }),
    new winston.transports.File({
      filename: 'logs/code-roach-service.log',
      maxsize: 5242880, // 5MB
      maxFiles: 5,
    }),
  ],
});

// Ensure logs directory exists
const fs = require('fs');
const path = require('path');
const logsDir = path.join(__dirname, '../../logs');
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

function createLogger(context = '') {
  return {
    info: (message, meta = {}) => logger.info(`${context} ${message}`, meta),
    error: (message, error = null, meta = {}) => {
      const errorMeta = error ? { ...meta, error: error.message, stack: error.stack } : meta;
      logger.error(`${context} ${message}`, errorMeta);
    },
    warn: (message, meta = {}) => logger.warn(`${context} ${message}`, meta),
    debug: (message, meta = {}) => logger.debug(`${context} ${message}`, meta),
  };
}

module.exports = {
  logger,
  createLogger
};
