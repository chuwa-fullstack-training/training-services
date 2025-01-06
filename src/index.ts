import { Elysia, t } from 'elysia';
import { swagger } from '@elysiajs/swagger';
import { todoRouter } from './routers/todo';
import { categoryRouter } from './routers/category';
import { userRouter } from './routers/user';

const app = new Elysia()
  .use(swagger())
  .use(categoryRouter)
  .use(todoRouter)
  .use(userRouter)
  .listen(3000);

console.log(
  `🦊 Elysia is running at ${app.server?.hostname}:${app.server?.port}`
);
