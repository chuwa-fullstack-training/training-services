import { swaggerUI } from '@hono/swagger-ui';
import { OpenAPIHono } from '@hono/zod-openapi';
import { cors } from 'hono/cors';
import { logger, loggerMiddleware } from './lib/logger';
import { authRateLimiter, publicRateLimiter } from './lib/rate-limit';
import { categoryRouter } from './routers/category';
import { todoRouter } from './routers/todo';
import { userRouter } from './routers/user';

const APP_VERSION: string = Bun.env.npm_package_version ?? 'unknown';

const app = new OpenAPIHono();

// Global middleware - Applied in order
// 1. Logging middleware (must be first to capture all requests)
app.use('*', loggerMiddleware);

// 2. CORS middleware
app.use('*', cors());

// 3. Version header on all responses
app.use('*', async (c, next) => {
  await next();
  c.res.headers.set('X-API-Version', APP_VERSION);
});

// 3. Rate limiting - Apply to auth endpoints (stricter limits)
app.use('/api/auth/*', authRateLimiter);

// 4. Rate limiting - Apply to public endpoints
app.use('/api/categories*', publicRateLimiter);

// Mount routers
app.route('/api/categories', categoryRouter);
app.route('/api', userRouter); // Handles /api/auth/* and /api/users/*
app.route('/api/todos', todoRouter);

// Register Bearer security scheme so Swagger UI shows the Authorize button
app.openAPIRegistry.registerComponent('securitySchemes', 'Bearer', {
  type: 'http',
  scheme: 'bearer',
  bearerFormat: 'JWT',
});

// Swagger UI
app.get('/doc', swaggerUI({ url: '/doc/openapi.json' }));

// OpenAPI spec endpoint
app.doc('/doc/openapi.json', {
  openapi: '3.0.0',
  info: {
    title: 'Toy API',
    version: '2.0.0',
    description: 'Toy API - Hono Framework',
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
    message: 'Toy API - Hono',
    version: APP_VERSION,
    framework: 'Hono',
    documentation: '/doc',
    environment: Bun.env.NODE_ENV || 'development',
  });
});

// Version endpoint
app.get('/version', (c) => {
  return c.json({ version: APP_VERSION });
});

const hostname = Bun.env.HOST_NAME || '127.0.0.1';
const port = Bun.env.PORT || 3001;
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
  'Toy API starting up'
);

console.log(`🔥 Hono server running at http://${hostname}:${port}`);
console.log(`📚 API Documentation: http://${hostname}:${port}/doc`);
console.log(`🌍 Environment: ${env}`);
console.log(`🛡️ Rate limiting: Enabled`);
console.log(`📊 Structured logging: Enabled`);

export default {
  hostname,
  port,
  fetch: app.fetch,
};
