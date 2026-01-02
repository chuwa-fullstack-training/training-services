import { OpenAPIHono } from '@hono/zod-openapi';
import { cors } from 'hono/cors';
import { swaggerUI } from '@hono/swagger-ui';
import { categoryRouter } from './routers/category';
import { userRouter } from './routers/user';
import { todoRouter } from './routers/todo';
import { loggerMiddleware, logger, logMetrics } from './lib/logger';
import { authRateLimiter, publicRateLimiter } from './lib/rate-limit';

const app = new OpenAPIHono();

// Global middleware - Applied in order
// 1. Logging middleware (first to capture all requests)
app.use('*', loggerMiddleware);

// 2. CORS middleware
app.use('*', cors());

// 3. Rate limiting - Apply to auth endpoints (stricter limits)
app.use('/api/auth/*', authRateLimiter);

// 4. Rate limiting - Apply to public endpoints
app.use('/api/categories*', publicRateLimiter);

// Mount routers
app.route('/api/categories', categoryRouter);
app.route('/api', userRouter); // Handles /api/auth/* and /api/users/*
app.route('/api/todos', todoRouter);

// Swagger UI
app.get('/doc', swaggerUI({ url: '/doc/openapi.json' }));

// OpenAPI spec endpoint
app.doc('/doc/openapi.json', {
  openapi: '3.0.0',
  info: {
    title: 'Todo List API',
    version: '2.0.0',
    description: 'Todo List Management API - Hono Framework',
  },
  tags: [
    { name: 'Auth', description: 'Authentication endpoints' },
    { name: 'User', description: 'User management endpoints' },
    { name: 'Todo', description: 'Todo CRUD endpoints' },
    { name: 'Category', description: 'Category management endpoints' },
  ],
});

// Health check
app.get('/', (c) => {
  logger.debug('Health check endpoint accessed');
  return c.json({
    message: 'Todo List API - Hono',
    version: '2.0.0',
    framework: 'Hono',
    documentation: '/doc',
    environment: Bun.env.NODE_ENV || 'development',
  });
});

const port = 3001;
const env = Bun.env.NODE_ENV || 'development';

logger.info(
  {
    port,
    env,
    features: {
      rateLimit: true,
      logging: true,
      cors: true,
      authentication: true,
    },
  },
  'Todo List API starting up'
);

console.log(`🔥 Hono server running at http://localhost:${port}`);
console.log(`📚 API Documentation: http://localhost:${port}/doc`);
console.log(`🌍 Environment: ${env}`);
console.log(`🛡️  Rate limiting: Enabled`);
console.log(`📊 Structured logging: Enabled`);

export default {
  port,
  fetch: app.fetch,
};
