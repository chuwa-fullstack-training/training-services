import { OpenAPIHono, createRoute, z } from '@hono/zod-openapi';
import { prisma, formatDate } from '../lib';
import { authMiddleware } from '../lib/auth';

export const todoRouter = new OpenAPIHono();

// Zod schemas
const TodoSchema = z.object({
  id: z.string(),
  title: z.string(),
  completed: z.boolean(),
  categoryId: z.number(),
  userId: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

const CreateTodoSchema = z.object({
  title: z.string().min(1).max(200),
  completed: z.boolean().optional(),
  categoryId: z.number().optional(),
});

const UpdateTodoSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  completed: z.boolean().optional(),
  categoryId: z.number().optional(),
});

// GET /api/todos - List user's todos
const listTodosRoute = createRoute({
  method: 'get',
  path: '/',
  tags: ['Todo'],
  summary: 'Get all todos for authenticated user',
  security: [{ Bearer: [] }],
  middleware: authMiddleware,
  request: {
    query: z.object({
      categoryId: z.string().transform(Number).optional(),
    }),
  },
  responses: {
    200: {
      description: 'List of todos',
      content: {
        'application/json': {
          schema: z.array(TodoSchema),
        },
      },
    },
  },
});

todoRouter.openapi(listTodosRoute, async (c) => {
  const userId = c.get('userId');
  const query = c.req.valid('query');

  const todos = await prisma.todo.findMany({
    where: {
      userId,
      categoryId: query.categoryId || undefined,
    },
  });

  return c.json(
    todos.map((todo) => ({
      ...todo,
      userId: todo.userId ?? '',
      createdAt: formatDate(todo.createdAt),
      updatedAt: formatDate(todo.updatedAt),
    })),
    200
  );
});

// GET /api/todos/:id - Get single todo
const getTodoRoute = createRoute({
  method: 'get',
  path: '/{id}',
  tags: ['Todo'],
  summary: 'Get todo by ID (must be owned by user)',
  security: [{ Bearer: [] }],
  middleware: authMiddleware,
  request: {
    params: z.object({
      id: z.string(),
    }),
  },
  responses: {
    200: {
      description: 'Todo details',
      content: {
        'application/json': {
          schema: TodoSchema,
        },
      },
    },
    403: {
      description: 'Access denied',
      content: {
        'application/json': {
          schema: z.object({ message: z.string() }),
        },
      },
    },
    404: {
      description: 'Todo not found',
      content: {
        'application/json': {
          schema: z.object({ message: z.string() }),
        },
      },
    },
  },
});

todoRouter.openapi(getTodoRoute, async (c) => {
  const { id } = c.req.valid('param');
  const userId = c.get('userId');

  const todo = await prisma.todo.findUnique({ where: { id } });

  if (!todo) {
    return c.json({ message: 'Todo not found' }, 404);
  }

  if (todo.userId !== userId) {
    return c.json({ message: 'Access denied' }, 403);
  }

  return c.json(
    {
      ...todo,
      userId: todo.userId ?? '',
      createdAt: formatDate(todo.createdAt),
      updatedAt: formatDate(todo.updatedAt),
    },
    200
  );
});

// POST /api/todos - Create todo
const createTodoRoute = createRoute({
  method: 'post',
  path: '/',
  tags: ['Todo'],
  summary: 'Create new todo',
  security: [{ Bearer: [] }],
  middleware: authMiddleware,
  request: {
    body: {
      content: {
        'application/json': {
          schema: CreateTodoSchema,
        },
      },
    },
  },
  responses: {
    200: {
      description: 'Todo created',
      content: {
        'application/json': {
          schema: TodoSchema,
        },
      },
    },
    400: {
      description: 'No categories available',
      content: {
        'application/json': {
          schema: z.object({ message: z.string() }),
        },
      },
    },
  },
});

todoRouter.openapi(createTodoRoute, async (c) => {
  const userId = c.get('userId');
  const body = c.req.valid('json');

  let categoryId = body.categoryId;

  if (!categoryId) {
    const category = await prisma.category.findFirst();
    if (!category) {
      return c.json({ message: 'No categories available. Please create a category first.' }, 400);
    }
    categoryId = category.id;
  }

  const todo = await prisma.todo.create({
    data: {
      title: body.title,
      completed: body.completed ?? false,
      categoryId,
      userId,
    },
  });

  return c.json(
    {
      ...todo,
      userId: todo.userId ?? '',
      createdAt: formatDate(todo.createdAt),
      updatedAt: formatDate(todo.updatedAt),
    },
    200
  );
});

// PUT /api/todos/:id - Update todo
const updateTodoRoute = createRoute({
  method: 'put',
  path: '/{id}',
  tags: ['Todo'],
  summary: 'Update todo (must be owned by user)',
  security: [{ Bearer: [] }],
  middleware: authMiddleware,
  request: {
    params: z.object({
      id: z.string(),
    }),
    body: {
      content: {
        'application/json': {
          schema: UpdateTodoSchema,
        },
      },
    },
  },
  responses: {
    200: {
      description: 'Todo updated',
      content: {
        'application/json': {
          schema: TodoSchema,
        },
      },
    },
    403: {
      description: 'Access denied',
      content: {
        'application/json': {
          schema: z.object({ message: z.string() }),
        },
      },
    },
    404: {
      description: 'Todo not found',
      content: {
        'application/json': {
          schema: z.object({ message: z.string() }),
        },
      },
    },
  },
});

todoRouter.openapi(updateTodoRoute, async (c) => {
  const { id } = c.req.valid('param');
  const userId = c.get('userId');
  const body = c.req.valid('json');

  const existingTodo = await prisma.todo.findUnique({ where: { id } });

  if (!existingTodo) {
    return c.json({ message: 'Todo not found' }, 404);
  }

  if (existingTodo.userId !== userId) {
    return c.json({ message: 'Access denied' }, 403);
  }

  const todo = await prisma.todo.update({
    where: { id },
    data: body,
  });

  return c.json(
    {
      ...todo,
      userId: todo.userId ?? '',
      createdAt: formatDate(todo.createdAt),
      updatedAt: formatDate(todo.updatedAt),
    },
    200
  );
});

// DELETE /api/todos/:id - Delete todo
const deleteTodoRoute = createRoute({
  method: 'delete',
  path: '/{id}',
  tags: ['Todo'],
  summary: 'Delete todo (must be owned by user)',
  security: [{ Bearer: [] }],
  middleware: authMiddleware,
  request: {
    params: z.object({
      id: z.string(),
    }),
  },
  responses: {
    200: {
      description: 'Todo deleted',
      content: {
        'application/json': {
          schema: z.object({
            message: z.string(),
            id: z.string(),
          }),
        },
      },
    },
    403: {
      description: 'Access denied',
      content: {
        'application/json': {
          schema: z.object({ message: z.string() }),
        },
      },
    },
    404: {
      description: 'Todo not found',
      content: {
        'application/json': {
          schema: z.object({ message: z.string() }),
        },
      },
    },
  },
});

todoRouter.openapi(deleteTodoRoute, async (c) => {
  const { id } = c.req.valid('param');
  const userId = c.get('userId');

  const existingTodo = await prisma.todo.findUnique({ where: { id } });

  if (!existingTodo) {
    return c.json({ message: 'Todo not found' }, 404);
  }

  if (existingTodo.userId !== userId) {
    return c.json({ message: 'Access denied' }, 403);
  }

  await prisma.todo.delete({ where: { id } });

  return c.json(
    {
      message: 'Todo deleted successfully',
      id,
    },
    200
  );
});
