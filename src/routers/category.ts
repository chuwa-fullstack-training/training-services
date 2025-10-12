import { Elysia, t } from 'elysia';
import { prisma } from '../lib';

export const categoryRouter = new Elysia({ prefix: '/api/categories' })
  .get(
    '/',
    async () => {
      return await prisma.category.findMany({
        select: { id: true, name: true, todos: true }
      });
    },
    {
      detail: {
        tags: ['Category']
      },
      response: t.Array(
        t.Object({
          id: t.Number(),
          name: t.String(),
          todos: t.Array(t.Object({ id: t.String() }))
        })
      )
    }
  )
  .get(
    '/:id',
    async ({ params }) => {
      const { id } = params;
      const category = await prisma.category.findUnique({
        where: { id: +id },
        select: { id: true, name: true, todos: true }
      });
      return category;
    },
    {
      detail: {
        tags: ['Category']
      },
      response: t.Union([
        t.Null(),
        t.Object({
          id: t.Number(),
          name: t.String(),
          todos: t.Array(t.Object({ id: t.String() }))
        })
      ])
    }
  )
  // .post(
  //   '/',
  //   async ({ body }) => {
  //     const { name } = body;
  //     return await prisma.category.create({ data: { name } });
  //   },
  //   {
  //     body: t.Object({ name: t.String() }),
  //     response: t.Object({ id: t.Number(), name: t.String() })
  //   }
  // );
