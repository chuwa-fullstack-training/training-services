import { OpenAPIHono, createRoute, z } from '@hono/zod-openapi';
import { prisma } from '../lib';

// Zod schemas
const CategorySchema = z.object({
  id: z.number(),
  name: z.string(),
  todos: z.array(z.object({ id: z.string() })).optional(),
});

const CategoryArraySchema = z.array(CategorySchema);

export const categoryRouter = new OpenAPIHono();

// GET /api/categories - List all categories
const listCategoriesRoute = createRoute({
  method: 'get',
  path: '/',
  tags: ['Category'],
  summary: 'Get all categories',
  request: {
    query: z.object({
      includeTodos: z
        .enum(['true', 'false'])
        .transform((value) => value === 'true')
        .optional(),
    }),
  },
  responses: {
    200: {
      description: 'List of categories',
      content: {
        'application/json': {
          schema: CategoryArraySchema,
        },
      },
    },
  },
});

categoryRouter.openapi(listCategoriesRoute, async (c) => {
  const { includeTodos } = c.req.valid('query');
  const withTodos = includeTodos ?? false;

  const categories = await prisma.category.findMany({
    select: withTodos ? { id: true, name: true, todos: true } : { id: true, name: true },
  });
  return c.json(categories, 200);
});

// GET /api/categories/:id - Get category by ID
const getCategoryRoute = createRoute({
  method: 'get',
  path: '/{id}',
  tags: ['Category'],
  summary: 'Get category by ID',
  request: {
    params: z.object({
      id: z.string().transform(Number),
    }),
    query: z.object({
      includeTodos: z
        .enum(['true', 'false'])
        .transform((value) => value === 'true')
        .optional(),
    }),
  },
  responses: {
    200: {
      description: 'Category details',
      content: {
        'application/json': {
          schema: CategorySchema.nullable(),
        },
      },
    },
  },
});

categoryRouter.openapi(getCategoryRoute, async (c) => {
  const { id } = c.req.valid('param');
  const { includeTodos } = c.req.valid('query');
  const withTodos = includeTodos ?? false;

  const category = await prisma.category.findUnique({
    where: { id },
    select: withTodos ? { id: true, name: true, todos: true } : { id: true, name: true },
  });
  return c.json(category, 200);
});
