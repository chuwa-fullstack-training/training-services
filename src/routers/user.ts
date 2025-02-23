import { jwt } from '@elysiajs/jwt';
import { Elysia, t } from 'elysia';
import { prisma } from '../lib';
import { message, messageSchema } from '../lib/message';
import { AppError, UserAlreadyExistsError, UserError } from '../lib/errors';

export const userRouter = new Elysia()
  .use(
    jwt({
      name: 'jwt',
      secret: Bun.env.JWT_SECRET!
    })
  )
  .group('/api/auth', app =>
    app
      .post(
        '/login',
        async ({ body, jwt, error }) => {
          const { email, password } = body;
          if (!email || !password) {
            return error(400, {
              message: 'Email and password are required',
              data: {
                email: !email ? 'Email is required' : undefined,
                password: !password ? 'Password is required' : undefined
              }
            });
          }
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
          body: t.Object({
            email: t.String(),
            password: t.String()
          }),
          response: {
            200: messageSchema,
            400: t.Object({
              message: t.String(),
              data: t.Optional(t.Any())
            })
          }
        }
      )
      .post(
        '/signup',
        async ({ body }) => {
          try {
            const { email, password } = body;
            await prisma.user.signUp(email, password);
            return message('User created successfully');
          } catch (error) {
            if (error instanceof UserAlreadyExistsError) {
              return message(error.message, {
                status: 'error',
                code: 400,
                data: error.details
              });
            }
            if (error instanceof UserError) {
              return message(error.message, {
                status: 'error',
                code: error.status,
                data: error.details
              });
            }

            if (error instanceof AppError) {
              return message('Failed to create user', {
                status: 'error',
                code: error.status,
                data: error.details
              });
            }

            // Unexpected errors
            console.error('Unexpected error:', error);
            return message('An unexpected error occurred', {
              status: 'error',
              code: 500
            });
          }
        },
        {
          body: t.Object({
            email: t.String(),
            password: t.String()
          }),
          response: messageSchema
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
