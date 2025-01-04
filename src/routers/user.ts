import { Elysia, t } from 'elysia';
import { prisma } from '../libs';

export const userRouter = new Elysia({ prefix: '/api/users' })
  .get(
    '/',
    async () => {
      const users = await prisma.user.findMany({
        select: { id: true, email: true, todos: true, posts: true }
      });
      return users;
    },
    {
      response: t.Array(
        t.Object({
          id: t.String(),
          email: t.String(),
          todos: t.Array(t.Object({ id: t.String() })),
          posts: t.Array(t.Object({ id: t.String() }))
        })
      )
    }
  )
  .get(
    '/:id',
    async ({ params }) => {
      const { id } = params;
      const user = await prisma.user.findUnique({
        where: { id },
        select: { id: true, email: true, todos: true, posts: true }
      });
      return user;
    },
    {
      params: t.Object({
        id: t.String()
      }),
      response: t.Union([
        t.Null(),
        t.Object({
          id: t.String(),
          email: t.String(),
          todos: t.Array(t.Object({ id: t.String() })),
          posts: t.Array(t.Object({ id: t.String() }))
        })
      ])
    }
  );
