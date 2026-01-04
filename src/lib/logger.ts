import { pino } from 'pino';
import { pinoLogger } from 'hono-pino';

/**
 * Production Logging Configuration
 *
 * Features:
 * - Structured JSON logging for production
 * - Pretty-printed output for development
 * - Request/response correlation with performance metrics
 * - Automatic sensitive data redaction
 * - Error tracking with stack traces
 */

// Determine if we're in production
const isProduction = Bun.env.NODE_ENV === 'production';

// Create Pino logger instance
export const logger = pino({
  level: isProduction ? 'info' : 'debug',

  // Production: JSON format for log aggregation
  // Development: Pretty-printed for readability
  transport: !isProduction
    ? {
        target: 'pino-pretty',
        options: {
          colorize: true,
          translateTime: 'SYS:standard',
          ignore: 'pid,hostname',
          singleLine: false,
          // messageFormat: '{level} - {msg}',
        },
      }
    : undefined,

  // Redact sensitive fields
  redact: {
    paths: [
      'req.headers.authorization',
      'req.headers.cookie',
      'res.headers["set-cookie"]',
      'password',
      'token',
      'secret',
    ],
    remove: true,
  },

  // Base configuration
  // formatters: {
  //   level: (label) => {
  //     return { level: label };
  //   },
  // },

  // Add timestamp
  timestamp: pino.stdTimeFunctions.isoTime,

  // Base fields
  base: {
    env: Bun.env.NODE_ENV || 'development',
    app: 'todo-list-service',
  },
});

/**
 * Hono Pino Logger Middleware
 *
 * Logs all HTTP requests with:
 * - Request details (method, path, headers)
 * - Response details (status, headers)
 * - Performance metrics (response time)
 * - Correlation IDs for request tracking
 */
export const loggerMiddleware = pinoLogger({
  pino: logger,

  // Custom request logger
  http: {
    // Include request ID for correlation
    reqId: () => crypto.randomUUID(),

    onResMessage: false,
  },
});

/**
 * Custom logging helpers
 */

// Log slow requests (>1000ms)
export const logSlowRequest = (path: string, method: string, duration: number) => {
  if (duration > 1000) {
    logger.warn(
      {
        type: 'slow_request',
        method,
        path,
        duration,
        threshold: 1000,
      },
      `Slow request detected: ${method} ${path} took ${duration}ms`
    );
  }
};

// Log authentication events
export const logAuth = (
  event: 'login' | 'signup' | 'logout' | 'auth_failed',
  userId?: string,
  email?: string
) => {
  logger.info(
    {
      type: 'auth_event',
      event,
      userId,
      email,
    },
    `Authentication event: ${event}`
  );
};

// Log database operations
export const logDatabase = (operation: string, table: string, duration?: number) => {
  logger.debug(
    {
      type: 'database',
      operation,
      table,
      duration,
    },
    `Database operation: ${operation} on ${table}`
  );
};

// Log errors with full context
export const logError = (error: Error, context?: Record<string, unknown>) => {
  logger.error(
    {
      type: 'error',
      error: {
        message: error.message,
        stack: error.stack,
        name: error.name,
      },
      ...context,
    },
    `Error occurred: ${error.message}`
  );
};

// Log API metrics
export const logMetrics = (metrics: {
  endpoint: string;
  method: string;
  statusCode: number;
  responseTime: number;
  userAgent?: string;
}) => {
  logger.info(
    {
      type: 'metrics',
      ...metrics,
    },
    `API call: ${metrics.method} ${metrics.endpoint} - ${metrics.statusCode} (${metrics.responseTime}ms)`
  );
};

/**
 * Environment-based logging examples:
 *
 * Development:
 * logger.debug('Debug message with context', { userId: '123' });
 * logger.info('Info message');
 * logger.warn('Warning message');
 * logger.error('Error message', { error: new Error('Something failed') });
 *
 * Production:
 * All logs are JSON formatted for aggregation tools (ELK, Datadog, etc.)
 * Use structured logging for better queryability:
 * logger.info({ userId, action: 'create_todo' }, 'User created todo');
 */

/**
 * Production deployment recommendations:
 *
 * 1. Log Rotation:
 *    - Use pino-roll or external log rotation (logrotate)
 *    - Keep logs for 30-90 days based on compliance needs
 *
 * 2. Log Aggregation:
 *    - Send logs to centralized system (Elasticsearch, Datadog, CloudWatch)
 *    - Use pino transports for streaming to external services
 *
 * 3. Monitoring:
 *    - Set up alerts for error rate spikes
 *    - Monitor slow request patterns
 *    - Track authentication failure patterns
 *
 * 4. Performance:
 *    - Pino is one of the fastest loggers (~5-10x faster than Winston)
 *    - Async logging minimizes impact on request processing
 *    - Consider log sampling for very high-traffic endpoints
 */
