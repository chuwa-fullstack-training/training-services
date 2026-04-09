import { OpenAPIHono, createRoute, z } from '@hono/zod-openapi';
import { prisma } from '../lib';
import { optionalAuth, authMiddleware } from '../lib/auth';
import { errorSchema } from '../lib/message';

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
  middleware: optionalAuth,
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
    403: {
      description: 'Forbidden - admin role required for includeTodos',
      content: {
        'application/json': {
          schema: errorSchema,
        },
      },
    },
  },
});

categoryRouter.openapi(listCategoriesRoute, async (c) => {
  const { includeTodos } = c.req.valid('query');

  if (includeTodos && c.get('role' as never) !== 'ADMIN') {
    return c.json({ message: 'Forbidden' }, 403);
  }

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
  middleware: optionalAuth,
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
    403: {
      description: 'Forbidden - admin role required for includeTodos',
      content: {
        'application/json': {
          schema: errorSchema,
        },
      },
    },
  },
});

categoryRouter.openapi(getCategoryRoute, async (c) => {
  const { id } = c.req.valid('param');
  const { includeTodos } = c.req.valid('query');

  if (includeTodos && c.get('role' as never) !== 'ADMIN') {
    return c.json({ message: 'Forbidden' }, 403);
  }

  const withTodos = includeTodos ?? false;

  const category = await prisma.category.findUnique({
    where: { id },
    select: withTodos ? { id: true, name: true, todos: true } : { id: true, name: true },
  });
  return c.json(category, 200);
});

// POST /api/categories - Create category (admin only)
const createCategoryRoute = createRoute({
  method: 'post',
  path: '/',
  tags: ['Category'],
  summary: 'Create a new category (admin only)',
  security: [{ Bearer: [] }],
  middleware: authMiddleware,
  request: {
    body: {
      content: {
        'application/json': {
          schema: z.object({
            name: z.string().min(1).max(100),
          }),
        },
      },
    },
  },
  responses: {
    200: {
      description: 'Category created',
      content: {
        'application/json': {
          schema: CategorySchema,
        },
      },
    },
    403: {
      description: 'Forbidden',
      content: {
        'application/json': {
          schema: errorSchema,
        },
      },
    },
  },
});

categoryRouter.openapi(createCategoryRoute, async (c) => {
  if (c.get('role' as never) !== 'ADMIN') {
    return c.json({ message: 'Forbidden' }, 403);
  }

  const { name } = c.req.valid('json');

  const category = await prisma.category.create({
    select: { id: true, name: true },
    data: { name },
  });

  return c.json(category, 200);
});

// PUT /api/categories/:id - Update category (admin only)
const updateCategoryRoute = createRoute({
  method: 'put',
  path: '/{id}',
  tags: ['Category'],
  summary: 'Update a category (admin only)',
  security: [{ Bearer: [] }],
  middleware: authMiddleware,
  request: {
    params: z.object({
      id: z.string().transform(Number),
    }),
    body: {
      content: {
        'application/json': {
          schema: z.object({
            name: z.string().min(1).max(100),
          }),
        },
      },
    },
  },
  responses: {
    200: {
      description: 'Category updated',
      content: {
        'application/json': {
          schema: CategorySchema,
        },
      },
    },
    403: {
      description: 'Forbidden',
      content: {
        'application/json': {
          schema: errorSchema,
        },
      },
    },
    404: {
      description: 'Category not found',
      content: {
        'application/json': {
          schema: errorSchema,
        },
      },
    },
  },
});

categoryRouter.openapi(updateCategoryRoute, async (c) => {
  if (c.get('role' as never) !== 'ADMIN') {
    return c.json({ message: 'Forbidden' }, 403);
  }

  const { id } = c.req.valid('param');
  const { name } = c.req.valid('json');

  const existing = await prisma.category.findUnique({ where: { id } });
  if (!existing) {
    return c.json({ message: 'Category not found' }, 404);
  }

  const category = await prisma.category.update({
    where: { id },
    select: { id: true, name: true },
    data: { name },
  });

  return c.json(category, 200);
});

// DELETE /api/categories/:id - Delete category (admin only)
// Reassigns affected todos to category id=1 before deleting
const deleteCategoryRoute = createRoute({
  method: 'delete',
  path: '/{id}',
  tags: ['Category'],
  summary: 'Delete a category (admin only). Affected todos are reassigned to the default category (id=1)',
  security: [{ Bearer: [] }],
  middleware: authMiddleware,
  request: {
    params: z.object({
      id: z.string().transform(Number),
    }),
  },
  responses: {
    200: {
      description: 'Category deleted',
      content: {
        'application/json': {
          schema: z.object({ message: z.string(), id: z.number() }),
        },
      },
    },
    400: {
      description: 'Cannot delete the default category',
      content: {
        'application/json': {
          schema: errorSchema,
        },
      },
    },
    403: {
      description: 'Forbidden',
      content: {
        'application/json': {
          schema: errorSchema,
        },
      },
    },
    404: {
      description: 'Category not found',
      content: {
        'application/json': {
          schema: errorSchema,
        },
      },
    },
  },
});

categoryRouter.openapi(deleteCategoryRoute, async (c) => {
  if (c.get('role' as never) !== 'ADMIN') {
    return c.json({ message: 'Forbidden' }, 403);
  }

  const { id } = c.req.valid('param');

  if (id === 1) {
    return c.json({ message: 'Cannot delete the default category' }, 400);
  }

  const existing = await prisma.category.findUnique({ where: { id } });
  if (!existing) {
    return c.json({ message: 'Category not found' }, 404);
  }

  await prisma.$transaction([
    prisma.todo.updateMany({
      where: { categoryId: id },
      data: { categoryId: 1 },
    }),
    prisma.category.delete({ where: { id } }),
  ]);

  return c.json({ message: 'Category deleted successfully', id }, 200);
});
