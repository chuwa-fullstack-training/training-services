import { swagger } from '@elysiajs/swagger';
import { Elysia } from 'elysia';
import { categoryRouter } from './routers/category';
import { leetcodeRouter } from './routers/leetcode';
import { todoRouter } from './routers/todo';
import { userRouter } from './routers/user';

const app = new Elysia()
  .use(
    swagger({
      documentation: {
        info: {
          title: 'Fullstack Training Utility API',
          version: '1.0.0',
          description: 'API for Fullstack Training Session'
        },
        tags: [
          {
            name: 'Auth',
            description: 'Authentication related endpoints'
          },
          {
            name: 'Category',
            description: 'Category related endpoints'
          },
          {
            name: 'User',
            description: 'User related endpoints'
          },
          {
            name: 'Todo',
            description: 'Todo related endpoints'
          }
          // {
          //   name: 'Leetcode',
          //   description: 'Leetcode related endpoints'
          // }
        ]
      }
    })
  )
  .use(categoryRouter)
  .use(todoRouter)
  .use(userRouter)
  // .use(leetcodeRouter)
  .listen(3000);

console.log(
  `🦊 Elysia is running at ${app.server?.hostname}:${app.server?.port}`
);
