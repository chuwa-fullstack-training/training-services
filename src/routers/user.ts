import { jwt } from '@elysiajs/jwt';
import { Elysia, t } from 'elysia';
import { prisma } from '../lib';
import { UserAlreadyExistsError } from '../lib/errors';
import { errorSchema, message, messageSchema } from '../lib/message';

export const userRouter = new Elysia()
  .use(
    jwt({
      name: 'jwt',
      secret: Bun.env.JWT_SECRET!
    })
  )
  .group('/api/auth', app =>
    app
      .onError(({ code, error }) => {
        if (code === 'VALIDATION') {
          return {
            message: 'Validation error',
            data: error.all
          };
        }
        return {
          message: 'An unexpected error occurred',
          data: error
        };
      })
      .post(
        '/login',
        async ({ body, jwt, error }) => {
          const { email, password } = body;
          const user = await prisma.user.findUnique({ where: { email } });
          if (!user) {
            return error(400, {
              message: 'User not found'
            });
          }
          const isPasswordValid = await Bun.password.verify(
            password,
            user.password
          );
          if (!isPasswordValid) {
            return error(400, {
              message: 'Invalid password'
            });
          }
          const token = await jwt.sign({ id: user.id });
          return message('Login successful', {
            status: 'success',
            data: { token }
          });
        },
        {
          detail: {
            tags: ['Auth']
          },
          body: t.Object({
            email: t.String({ format: 'email', error: 'Invalid email' }),
            password: t.String({
              minLength: 8,
              maxLength: 16,
              error: 'Password must be between 8 and 16 characters long'
            })
          }),
          response: {
            200: messageSchema,
            400: errorSchema
          }
        }
      )
      .post(
        '/signup',
        async ({ body, error }) => {
          try {
            const { email, password } = body;
            await prisma.user.signUp(email, password);
            return message('User created successfully');
          } catch (e) {
            if (e instanceof UserAlreadyExistsError) {
              return error(400, {
                message: e.message,
                data: e.details
              });
            }
            return error(400, {
              message: 'User creation failed',
              data: e
            });
          }
        },
        {
          detail: {
            tags: ['Auth']
          },
          body: t.Object({
            email: t.String({ format: 'email', error: 'Invalid email' }),
            password: t.String({
              minLength: 8,
              maxLength: 16,
              error: 'Password must be between 8 and 16 characters long'
            })
          }),
          response: {
            200: messageSchema,
            400: errorSchema
          }
        }
      )
  )
  .group('/api/users', app =>
    app
      .get(
        '/',
        async () => {
          const users = await prisma.user.findMany({
            select: { id: true, email: true, todos: true, posts: true }
          });
          return users;
        },
        {
          detail: {
            tags: ['User']
          },
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
          const user = await prisma.user.findUnique({
            where: { id: params.id },
            include: {
              todos: true,
              posts: true
            }
          });
          return user;
        },
        {
          detail: {
            tags: ['User']
          },
          params: t.Object({
            id: t.String()
          }),
          response: t.Union([
            t.Null(),
            t.Object({
              id: t.String(),
              email: t.String(),
              password: t.String(),
              todos: t.Array(t.Object({ id: t.String() })),
              posts: t.Array(t.Object({ id: t.String() }))
            })
          ])
        }
      )
  );
