import { OpenAPIHono, createRoute, z } from '@hono/zod-openapi';
import { setCookie } from 'hono/cookie';
import { prisma } from '../lib';
import { message, messageSchema, errorSchema } from '../lib/message';
import { authMiddleware, signToken } from '../lib/auth';
import { UserAlreadyExistsError } from '../lib/errors';
import { logger, logAuth, logError } from '../lib/logger';

export const userRouter = new OpenAPIHono();

// Zod schemas
const LoginSchema = z.object({
  email: z.email({ message: 'Invalid email' }),
  password: z.string().min(8).max(16, 'Password must be between 8 and 16 characters'),
});

const SignupSchema = z.object({
  email: z.email({ message: 'Invalid email' }),
  password: z.string().min(8).max(16, 'Password must be between 8 and 16 characters'),
});

const LoginResponseSchema = z.object({
  message: z.string(),
  status: z.literal('success'),
  data: z.object({
    token: z.string(),
    userId: z.string(),
    email: z.string(),
  }),
});

const UserProfileSchema = z.object({
  id: z.string(),
  email: z.string(),
  todos: z.array(
    z.object({
      id: z.string(),
      title: z.string(),
      completed: z.boolean(),
      categoryId: z.number(),
    })
  ),
  posts: z.array(
    z.object({
      id: z.string(),
      title: z.string(),
      published: z.boolean(),
    })
  ),
});

// POST /api/auth/login
const loginRoute = createRoute({
  method: 'post',
  path: '/auth/login',
  tags: ['Auth'],
  summary: 'User login',
  request: {
    body: {
      content: {
        'application/json': {
          schema: LoginSchema,
        },
      },
    },
  },
  responses: {
    200: {
      description: 'Login successful',
      content: {
        'application/json': {
          schema: LoginResponseSchema,
        },
      },
    },
    400: {
      description: 'Invalid credentials',
      content: {
        'application/json': {
          schema: errorSchema,
        },
      },
    },
  },
});

userRouter.openapi(loginRoute, async (c) => {
  const { email, password } = c.req.valid('json');

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    logAuth('auth_failed', undefined, email);
    return c.json({ message: 'User not found' }, 400);
  }

  const isPasswordValid = await Bun.password.verify(password, user.password);
  if (!isPasswordValid) {
    logAuth('auth_failed', user.id, email);
    return c.json({ message: 'Invalid password' }, 400);
  }

  const token = await signToken(user.id);

  // Set HttpOnly cookie
  setCookie(c, 'token', token, {
    httpOnly: true,
    maxAge: 7 * 24 * 60 * 60, // 7 days
    path: '/',
    sameSite: 'Lax',
  });

  logAuth('login', user.id, email);

  return c.json(
    {
      message: 'Login successful',
      status: 'success' as const,
      data: {
        token,
        userId: user.id,
        email: user.email,
      },
    },
    200
  );
});

// POST /api/auth/signup
const signupRoute = createRoute({
  method: 'post',
  path: '/auth/signup',
  tags: ['Auth'],
  summary: 'User signup',
  request: {
    body: {
      content: {
        'application/json': {
          schema: SignupSchema,
        },
      },
    },
  },
  responses: {
    200: {
      description: 'User created successfully',
      content: {
        'application/json': {
          schema: messageSchema,
        },
      },
    },
    400: {
      description: 'User creation failed',
      content: {
        'application/json': {
          schema: errorSchema,
        },
      },
    },
  },
});

userRouter.openapi(signupRoute, async (c) => {
  try {
    const { email, password } = c.req.valid('json');
    await prisma.user.signUp(email, password);
    logAuth('signup', undefined, email);
    return c.json(message('User created successfully'), 200);
  } catch (e) {
    if (e instanceof UserAlreadyExistsError) {
      logAuth('auth_failed', undefined, (e as any).email);
      return c.json(
        {
          message: e.message,
          data: e.details,
        },
        400
      );
    }
    logError(e as Error, { operation: 'signup' });
    return c.json(
      {
        message: 'User creation failed',
        data: e,
      },
      400
    );
  }
});

// GET /api/users - List all users (requires auth)
const listUsersRoute = createRoute({
  method: 'get',
  path: '/users',
  tags: ['User'],
  summary: 'Get all users (requires authentication)',
  security: [{ Bearer: [] }],
  middleware: authMiddleware,
  responses: {
    200: {
      description: 'List of users',
      content: {
        'application/json': {
          schema: z.array(
            z.object({
              id: z.string(),
              email: z.string(),
              _count: z.object({
                todos: z.number(),
                posts: z.number(),
              }),
            })
          ),
        },
      },
    },
  },
});

userRouter.openapi(listUsersRoute, async (c) => {
  const users = await prisma.user.findMany({
    select: {
      id: true,
      email: true,
      _count: {
        select: { todos: true, posts: true },
      },
    },
  });
  return c.json(users, 200);
});

// GET /api/users/me - Get current user profile
const getMeRoute = createRoute({
  method: 'get',
  path: '/users/me',
  tags: ['User'],
  summary: 'Get current authenticated user profile',
  security: [{ Bearer: [] }],
  middleware: authMiddleware,
  responses: {
    200: {
      description: 'User profile',
      content: {
        'application/json': {
          schema: UserProfileSchema.nullable(),
        },
      },
    },
  },
});

userRouter.openapi(getMeRoute, async (c) => {
  const userId = c.get('userId');
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
          categoryId: true,
        },
      },
      posts: {
        select: {
          id: true,
          title: true,
          published: true,
        },
      },
    },
  });
  return c.json(user, 200);
});

// GET /api/users/:id - Get user by ID (must own profile)
const getUserRoute = createRoute({
  method: 'get',
  path: '/users/{id}',
  tags: ['User'],
  summary: 'Get user by ID (can only access own profile)',
  security: [{ Bearer: [] }],
  middleware: authMiddleware,
  request: {
    params: z.object({
      id: z.string(),
    }),
  },
  responses: {
    200: {
      description: 'User profile',
      content: {
        'application/json': {
          schema: UserProfileSchema.nullable(),
        },
      },
    },
    403: {
      description: 'Access denied',
      content: {
        'application/json': {
          schema: errorSchema,
        },
      },
    },
  },
});

userRouter.openapi(getUserRoute, async (c) => {
  const { id } = c.req.valid('param');
  const userId = c.get('userId');

  // Authorization check
  if (id !== userId) {
    return c.json({ message: 'Access denied' }, 403);
  }

  const user = await prisma.user.findUnique({
    where: { id },
    select: {
      id: true,
      email: true,
      todos: {
        select: {
          id: true,
          title: true,
          completed: true,
          categoryId: true,
        },
      },
      posts: {
        select: {
          id: true,
          title: true,
          published: true,
        },
      },
    },
  });
  return c.json(user, 200);
});
