import { jwt } from '@elysiajs/jwt';
import { cookie } from '@elysiajs/cookie';
import { Elysia, t } from 'elysia';
import { prisma } from '../lib';
import { UserAlreadyExistsError } from '../lib/errors';
import { errorSchema, message, messageSchema } from '../lib/message';
import { authMiddleware } from '../lib/auth';

export const userRouter = new Elysia()
  .use(
    jwt({
      name: 'jwt',
      secret: Bun.env.JWT_SECRET!
    })
  )
  .use(cookie())
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
        async ({ body, jwt, error, cookie }) => {
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

          // Set cookie for browser-based auth
          cookie.token = {
            value: token,
            httpOnly: true,
            maxAge: 7 * 24 * 60 * 60, // 7 days
            path: '/',
            sameSite: 'lax'
          };

          return message('Login successful', {
            status: 'success',
            data: {
              token,
              userId: user.id,
              email: user.email
            }
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
      .use(authMiddleware)
      .get(
        '/',
        async () => {
          const users = await prisma.user.findMany({
            select: {
              id: true,
              email: true,
              _count: {
                select: { todos: true, posts: true }
              }
            }
          });
          return users;
        },
        {
          detail: {
            tags: ['User'],
            description: 'Get all users (requires authentication)',
            security: [{ bearerAuth: [] }]
          },
          response: t.Array(
            t.Object({
              id: t.String(),
              email: t.String(),
              _count: t.Object({
                todos: t.Number(),
                posts: t.Number()
              })
            })
          )
        }
      )
      .get(
        '/me',
        async ({ userId }) => {
          const user = await prisma.user.findUnique({
            where: { id: userId },
            select: {
              id: true,
              email: true,
              todos: {
                select: {
                  id: true,
                  title: true,
                  completed: true,
                  categoryId: true
                }
              },
              posts: {
                select: {
                  id: true,
                  title: true,
                  published: true
                }
              }
            }
          });
          return user;
        },
        {
          detail: {
            tags: ['User'],
            description: 'Get current authenticated user profile',
            security: [{ bearerAuth: [] }]
          },
          response: t.Union([
            t.Null(),
            t.Object({
              id: t.String(),
              email: t.String(),
              todos: t.Array(
                t.Object({
                  id: t.String(),
                  title: t.String(),
                  completed: t.Boolean(),
                  categoryId: t.Number()
                })
              ),
              posts: t.Array(
                t.Object({
                  id: t.String(),
                  title: t.String(),
                  published: t.Boolean()
                })
              )
            })
          ])
        }
      )
      .get(
        '/:id',
        async ({ params, userId, error }) => {
          // Users can only view their own full profile
          if (params.id !== userId) {
            return error(403, { message: 'Access denied' });
          }

          const user = await prisma.user.findUnique({
            where: { id: params.id },
            select: {
              id: true,
              email: true,
              todos: {
                select: {
                  id: true,
                  title: true,
                  completed: true,
                  categoryId: true
                }
              },
              posts: {
                select: {
                  id: true,
                  title: true,
                  published: true
                }
              }
            }
          });
          return user;
        },
        {
          detail: {
            tags: ['User'],
            description: 'Get user by ID (can only access own profile)',
            security: [{ bearerAuth: [] }]
          },
          params: t.Object({
            id: t.String()
          }),
          response: t.Union([
            t.Null(),
            t.Object({
              id: t.String(),
              email: t.String(),
              todos: t.Array(
                t.Object({
                  id: t.String(),
                  title: t.String(),
                  completed: t.Boolean(),
                  categoryId: t.Number()
                })
              ),
              posts: t.Array(
                t.Object({
                  id: t.String(),
                  title: t.String(),
                  published: t.Boolean()
                })
              )
            })
          ])
        }
      )
  );
