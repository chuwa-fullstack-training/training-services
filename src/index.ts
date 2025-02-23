import { swagger } from '@elysiajs/swagger';
import { Elysia } from 'elysia';
import { categoryRouter } from './routers/category';
import { todoRouter } from './routers/todo';
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
