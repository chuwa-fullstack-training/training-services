import { Elysia, t } from 'elysia';
import { jwt } from '@elysiajs/jwt';
import { cookie } from '@elysiajs/cookie';
import { formatDate, prisma } from '../lib';

export const todoRouter = new Elysia({ prefix: '/api/todos' })
  .use(jwt({ name: 'jwt', secret: Bun.env.JWT_SECRET! }))
  .use(cookie())
  .resolve(async ({ jwt, cookie, headers, set }) => {
    const authHeader = headers['authorization'];
    let token: string | undefined;

    if (authHeader?.startsWith('Bearer ')) {
      token = authHeader.substring(7);
    } else {
      token = cookie.token?.value as string | undefined;
    }

    if (!token) {
      set.status = 401;
      throw new Error('Authentication required');
    }

    const payload = await jwt.verify(token);
    if (!payload || typeof payload.id !== 'string') {
      set.status = 401;
      throw new Error('Invalid or expired token');
    }

    return {
      userId: payload.id as string
    };
  })
  .get(
    '/',
    async ({ userId, query }) => {
      // Users can only see their own todos
      const { categoryId} = query;
      const todos = await prisma.todo.findMany({
        where: {
          userId: userId,
          categoryId: categoryId ? categoryId : undefined
        }
      });
      return todos.map(todo => ({
        ...todo,
        userId: todo.userId ?? '',
        createdAt: formatDate(todo.createdAt),
        updatedAt: formatDate(todo.updatedAt)
      }));
    },
    {
      detail: {
        tags: ['Todo'],
        description: 'Get all todos for the authenticated user',
        security: [{ bearerAuth: [] }]
      },
      query: t.Object({
        categoryId: t.Optional(t.Number())
      }),
      response: t.Array(
        t.Object({
          id: t.String(),
          title: t.String(),
          completed: t.Boolean(),
          categoryId: t.Number(),
          userId: t.String(),
          createdAt: t.String(),
          updatedAt: t.String()
        })
      )
    }
  )
  .get(
    '/:id',
    async ({ params, userId, set }) => {
      const todo = await prisma.todo.findUnique({ where: { id: params.id } });

      if (!todo) {
        set.status = 404;
        throw new Error('Todo not found');
      }

      // Authorization: users can only access their own todos
      if (todo.userId !== userId) {
        set.status = 403;
        throw new Error('Access denied');
      }

      return {
        ...todo,
        userId: todo.userId ?? '',
        createdAt: formatDate(todo.createdAt),
        updatedAt: formatDate(todo.updatedAt)
      };
    },
    {
      detail: {
        tags: ['Todo'],
        description: 'Get a specific todo by ID (must be owned by authenticated user)',
        security: [{ bearerAuth: [] }]
      },
      params: t.Object({ id: t.String() }),
      response: t.Object({
        id: t.String(),
        title: t.String(),
        completed: t.Boolean(),
        categoryId: t.Number(),
        userId: t.String(),
        createdAt: t.String(),
        updatedAt: t.String()
      })
    }
  )
  .post(
    '/',
    async ({ body, userId, set }) => {
      // Get categoryId from body or use default
      let categoryId = body.categoryId;

      if (!categoryId) {
        const category = await prisma.category.findFirst();
        if (!category) {
          set.status = 400;
          throw new Error('No categories available. Please create a category first.');
        }
        categoryId = category.id;
      }

      const todo = await prisma.todo.create({
        data: {
          title: body.title,
          completed: body.completed ?? false,
          categoryId: categoryId,
          userId: userId
        }
      });

      return {
        ...todo,
        userId: todo.userId ?? '',
        createdAt: formatDate(todo.createdAt),
        updatedAt: formatDate(todo.updatedAt)
      };
    },
    {
      detail: {
        tags: ['Todo'],
        description: 'Create a new todo for the authenticated user',
        security: [{ bearerAuth: [] }]
      },
      body: t.Object({
        title: t.String({ minLength: 1, maxLength: 200 }),
        completed: t.Optional(t.Boolean()),
        categoryId: t.Optional(t.Number())
      }),
      response: t.Object({
        id: t.String(),
        title: t.String(),
        completed: t.Boolean(),
        categoryId: t.Number(),
        userId: t.String(),
        createdAt: t.String(),
        updatedAt: t.String()
      })
    }
  )
  .put(
    '/:id',
    async ({ body, params, userId, set }) => {
      // First check if todo exists and belongs to user
      const existingTodo = await prisma.todo.findUnique({
        where: { id: params.id }
      });

      if (!existingTodo) {
        set.status = 404;
        throw new Error('Todo not found');
      }

      // Authorization: users can only update their own todos
      if (existingTodo.userId !== userId) {
        set.status = 403;
        throw new Error('Access denied');
      }

      // Update the todo
      const todo = await prisma.todo.update({
        where: { id: params.id },
        data: body
      });

      return {
        ...todo,
        userId: todo.userId ?? '',
        createdAt: formatDate(todo.createdAt),
        updatedAt: formatDate(todo.updatedAt)
      };
    },
    {
      detail: {
        tags: ['Todo'],
        description: 'Update a todo (must be owned by authenticated user)',
        security: [{ bearerAuth: [] }]
      },
      body: t.Object({
        title: t.Optional(t.String({ minLength: 1, maxLength: 200 })),
        completed: t.Optional(t.Boolean()),
        categoryId: t.Optional(t.Number())
      }),
      params: t.Object({
        id: t.String()
      }),
      response: t.Object({
        id: t.String(),
        title: t.String(),
        completed: t.Boolean(),
        categoryId: t.Number(),
        userId: t.String(),
        createdAt: t.String(),
        updatedAt: t.String()
      })
    }
  )
  .delete(
    '/:id',
    async ({ params, userId, set }) => {
      // First check if todo exists and belongs to user
      const existingTodo = await prisma.todo.findUnique({
        where: { id: params.id }
      });

      if (!existingTodo) {
        set.status = 404;
        throw new Error('Todo not found');
      }

      // Authorization: users can only delete their own todos
      if (existingTodo.userId !== userId) {
        set.status = 403;
        throw new Error('Access denied');
      }

      // Delete the todo
      await prisma.todo.delete({ where: { id: params.id } });

      return {
        message: 'Todo deleted successfully',
        id: params.id
      };
    },
    {
      detail: {
        tags: ['Todo'],
        description: 'Delete a todo (must be owned by authenticated user)',
        security: [{ bearerAuth: [] }]
      },
      params: t.Object({
        id: t.String()
      }),
      response: t.Object({
        message: t.String(),
        id: t.String()
      })
    }
  );
