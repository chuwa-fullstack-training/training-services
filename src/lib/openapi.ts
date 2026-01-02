import { OpenAPIHono } from '@hono/zod-openapi';

/**
 * Create OpenAPI-enabled Hono app
 */
export function createOpenAPIApp() {
  const app = new OpenAPIHono();

  // OpenAPI documentation endpoint
  app.doc('/openapi.json', {
    openapi: '3.0.0',
    info: {
      title: 'Todo List API - Hono',
      version: '2.0.0',
      description: 'API for Todo List Management with Hono Framework',
    },
    tags: [
      { name: 'Auth', description: 'Authentication endpoints' },
      { name: 'User', description: 'User management endpoints' },
      { name: 'Todo', description: 'Todo CRUD endpoints' },
      { name: 'Category', description: 'Category management endpoints' },
    ],
  });

  return app;
}
