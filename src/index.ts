import { Elysia, t } from 'elysia';
import { swagger } from '@elysiajs/swagger';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const app = new Elysia()
  .use(swagger())
  .get(
    '/todos',
    async () => {
      return await prisma.todo.findMany();
    },
    {
      response: t.Array(
        t.Object({
          id: t.String(),
          title: t.String(),
          completed: t.Boolean()
        })
      )
    }
  )
  .post(
    '/todos',
    async ({ body }) => {
      return await prisma.todo.create({ data: body });
    },
    {
      body: t.Object({
        title: t.String(),
        completed: t.Optional(t.Boolean())
      })
    }
  )
  .put(
    '/todos/:id',
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
        completed: t.Optional(t.Boolean())
      }),
      params: t.Object({
        id: t.String()
      })
    }
  )
  .delete(
    '/todos/:id',
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
  )
  .listen(3000);

console.log(
  `🦊 Elysia is running at ${app.server?.hostname}:${app.server?.port}`
);
