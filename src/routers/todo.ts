import { Elysia, t } from 'elysia';
import { formatDate, prisma } from '../libs';

export const todoRouter = new Elysia({ prefix: '/api/todos' })
  .get(
    '/',
    async ({ query }) => {
      const { userId } = query;
      const todos = await prisma.todo.findMany({
        where: { userId: userId ? userId : undefined }
      });
      return todos.map(todo => ({
        ...todo,
        userId: todo.userId ?? '',
        createdAt: formatDate(todo.createdAt),
        updatedAt: formatDate(todo.updatedAt)
      }));
    },
    {
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
  .post(
    '/',
    async ({ body, query }) => {
      const { categoryId } = body;
      const { userId } = query;
      if (!userId) {
        throw new Error('No user id provided');
      }
      if (!categoryId) {
        const category = await prisma.category.findFirst();
        if (!category) throw new Error('No category');
        body.categoryId = category.id;
      }
      return await prisma.todo.create({
        data: {
          title: body.title,
          completed: body.completed,
          categoryId: +body.categoryId!,
          userId: userId
        }
      });
    },
    {
      body: t.Object({
        title: t.String(),
        completed: t.Optional(t.Boolean()),
        categoryId: t.Optional(t.Numeric())
      }),
      query: t.Object({
        userId: t.Optional(t.String())
      })
    }
  )
  .put(
    '/:id',
    async ({ body, params }) => {
      // update a todo
      return await prisma.todo.update({
        where: { id: params.id },
        data: body
      });
    },
    {
      body: t.Object({
        title: t.Optional(t.String()),
        completed: t.Optional(t.Boolean()),
        categoryId: t.Optional(t.Number())
      }),
      params: t.Object({
        id: t.String()
      })
    }
  )
  .delete(
    '/:id',
    async ({ params, error }) => {
      // delete a todo
      try {
        return await prisma.todo.delete({ where: { id: params.id } });
      } catch (err) {
        return error(400, { error: 'Todo not found' });
      }
    },
    {
      params: t.Object({
        id: t.String()
      })
    }
  );
