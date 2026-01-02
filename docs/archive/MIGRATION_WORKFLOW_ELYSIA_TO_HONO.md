# Elysia → Hono Migration Workflow

**Todo List API Service Framework Migration**

**Estimated Total Time**: 13-18 hours
**Strategy**: Phased incremental migration with parallel operation
**Risk Level**: Medium (requires careful validation)

---

## Table of Contents

1. [Prerequisites & Overview](#prerequisites--overview)
2. [Phase 1: Foundation Setup](#phase-1-foundation-setup-2-3-hours)
3. [Phase 2: Core Infrastructure Migration](#phase-2-core-infrastructure-migration-3-4-hours)
4. [Phase 3: Router Migration](#phase-3-router-migration-5-6-hours)
5. [Phase 4: Integration & Testing](#phase-4-integration--testing-2-3-hours)
6. [Phase 5: Cleanup & Optimization](#phase-5-cleanup--optimization-1-2-hours)
7. [Rollback Strategy](#rollback-strategy)
8. [Common Issues & Solutions](#common-issues--solutions)

---

## Prerequisites & Overview

### Framework Comparison

| Feature            | Elysia                 | Hono                | Migration Impact              |
| ------------------ | ---------------------- | ------------------- | ----------------------------- |
| **Routing**        | `new Elysia()`         | `new Hono()`        | Low - Similar API             |
| **Validation**     | TypeBox (`t.Object`)   | Zod (`z.object`)    | **High - Full rewrite**       |
| **JWT**            | `@elysiajs/jwt`        | `hono/jwt`          | Medium - Different API        |
| **Cookies**        | `@elysiajs/cookie`     | `hono/cookie`       | Low - Similar                 |
| **OpenAPI**        | `@elysiajs/swagger`    | `@hono/zod-openapi` | **High - Different approach** |
| **Middleware**     | `.use()`, `.resolve()` | `.use()`, context   | Medium - Pattern change       |
| **Error Handling** | `.onError()`           | Middleware pattern  | Medium                        |
| **Type Safety**    | Built-in               | Zod inference       | High - Schema rewrite         |

### Current Features to Preserve

✅ JWT authentication with bcrypt password hashing
✅ Cookie-based and Bearer token auth
✅ Todo CRUD with user ownership
✅ Category management
✅ User management
✅ Swagger/OpenAPI documentation
✅ Custom error handling
✅ Request/response validation
✅ Date formatting with dayjs

### Migration Strategy

- **Incremental**: Migrate one router at a time
- **Parallel**: Keep Elysia running until migration complete
- **Testable**: Validate each phase before proceeding
- **Reversible**: Easy rollback if issues arise

---

## Phase 1: Foundation Setup (2-3 hours)

### Step 1.1: Install Hono Dependencies

```bash
# Install Hono core and helpers
bun add hono

# Install validation and OpenAPI support
bun add zod @hono/zod-validator @hono/zod-openapi

# Install JWT support
bun add hono@latest  # JWT is built-in

# For development
bun add -d @types/node
```

**Validation**: Check `package.json` contains new dependencies

### Step 1.2: Create Parallel Structure

```bash
# Create new Hono entry point (don't delete old one yet)
touch src/index.hono.ts

# Create new Hono routers directory
mkdir -p src/hono-routers
```

### Step 1.3: Update TypeScript Configuration

**File**: `tsconfig.json`

Ensure compatibility:

```json
{
  "compilerOptions": {
    "target": "ES2021",
    "module": "ES2022",
    "moduleResolution": "node",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "types": ["bun-types"]
  }
}
```

### Step 1.4: Create Base Hono App

**File**: `src/index.hono.ts`

```typescript
import { Hono } from 'hono';
import { logger } from 'hono/logger';
import { cors } from 'hono/cors';

const app = new Hono();

// Basic middleware
app.use('*', logger());
app.use('*', cors());

// Health check
app.get('/', (c) => {
  return c.json({
    message: 'Todo List API - Hono Version',
    version: '2.0.0',
    framework: 'Hono',
  });
});

// Start server
const port = 3001; // Use different port during migration
console.log(`🔥 Hono server running at http://localhost:${port}`);

export default {
  port,
  fetch: app.fetch,
};
```

### Step 1.5: Test Base Setup

```bash
# Start Hono server
bun run src/index.hono.ts

# In another terminal, test
curl http://localhost:3001
```

**Expected Response**:

```json
{
  "message": "Todo List API - Hono Version",
  "version": "2.0.0",
  "framework": "Hono"
}
```

**Success Criteria**:

- ✅ Hono dependencies installed
- ✅ Base app runs on port 3001
- ✅ Health check endpoint responds
- ✅ Old Elysia app still works on port 3000

---

## Phase 2: Core Infrastructure Migration (3-4 hours)

### Step 2.1: Convert Message Helpers (TypeBox → Zod)

**File**: `src/lib/message.hono.ts`

```typescript
import { z } from 'zod';
import { MessageResponse } from '../types';

// Zod schemas (replace TypeBox)
export const messageSchema = z.object({
  message: z.string(),
  status: z.enum(['success', 'info', 'warning', 'error']),
  data: z.any().optional(),
});

export const errorSchema = z.object({
  message: z.string(),
  data: z.any().optional(),
});

// Helper function (unchanged logic)
export const message = (
  message: string,
  options?: { status?: MessageResponse['status']; data?: unknown }
): MessageResponse => {
  return {
    message,
    status: options?.status ?? 'success',
    ...((options?.data && { data: options.data }) || {}),
  };
};
```

**Validation**: TypeScript compiles without errors

### Step 2.2: Error Classes (No Changes Needed)

**File**: `src/lib/errors.ts`

✅ No changes required - error classes are framework-agnostic

### Step 2.3: Prisma Client (No Changes Needed)

**File**: `src/lib/index.ts`

✅ No changes required - Prisma extension is framework-agnostic

### Step 2.4: Create Hono Auth Middleware

**File**: `src/lib/auth.hono.ts`

```typescript
import { createMiddleware } from 'hono/factory';
import { sign, verify } from 'hono/jwt';
import { getCookie } from 'hono/cookie';
import type { Context } from 'hono';

const JWT_SECRET = Bun.env.JWT_SECRET!;

// Type for authenticated context
type AuthVariables = {
  userId: string;
};

/**
 * Required authentication middleware
 * Injects userId into context or returns 401
 */
export const authMiddleware = createMiddleware<{ Variables: AuthVariables }>(async (c, next) => {
  // Try Authorization header first
  const authHeader = c.req.header('Authorization');
  let token: string | undefined;

  if (authHeader?.startsWith('Bearer ')) {
    token = authHeader.substring(7);
  } else {
    // Fall back to cookie
    token = getCookie(c, 'token');
  }

  if (!token) {
    return c.json({ message: 'Authentication required' }, 401);
  }

  try {
    const payload = await verify(token, JWT_SECRET);

    if (!payload || typeof payload.id !== 'string') {
      return c.json({ message: 'Invalid or expired token' }, 401);
    }

    // Set userId in context
    c.set('userId', payload.id as string);
    await next();
  } catch (error) {
    return c.json({ message: 'Invalid or expired token' }, 401);
  }
});

/**
 * Optional authentication middleware
 * Sets userId if authenticated, but doesn't require it
 */
export const optionalAuth = createMiddleware<{ Variables: Partial<AuthVariables> }>(
  async (c, next) => {
    const authHeader = c.req.header('Authorization');
    let token: string | undefined;

    if (authHeader?.startsWith('Bearer ')) {
      token = authHeader.substring(7);
    } else {
      token = getCookie(c, 'token');
    }

    if (token) {
      try {
        const payload = await verify(token, JWT_SECRET);
        if (payload && typeof payload.id === 'string') {
          c.set('userId', payload.id as string);
        }
      } catch {
        // Silently ignore invalid tokens for optional auth
      }
    }

    await next();
  }
);

/**
 * Helper to sign JWT tokens
 */
export const signToken = async (userId: string): Promise<string> => {
  return await sign({ id: userId }, JWT_SECRET);
};
```

**Validation**: TypeScript compiles without errors

### Step 2.5: Set Up OpenAPI Documentation

**File**: `src/lib/openapi.hono.ts`

```typescript
import { createRoute, OpenAPIHono, z } from '@hono/zod-openapi';

/**
 * Create OpenAPI-enabled Hono app
 */
export function createOpenAPIApp() {
  const app = new OpenAPIHono();

  // OpenAPI documentation endpoint
  app.doc('/openapi.json', {
    openapi: '3.0.0',
    info: {
      title: 'Todo List API - Hono',
      version: '2.0.0',
      description: 'API for Todo List Management with Hono Framework',
    },
    tags: [
      { name: 'Auth', description: 'Authentication endpoints' },
      { name: 'User', description: 'User management endpoints' },
      { name: 'Todo', description: 'Todo CRUD endpoints' },
      { name: 'Category', description: 'Category management endpoints' },
    ],
  });

  return app;
}

/**
 * Helper to create authenticated route
 */
export function createAuthRoute<T extends z.ZodType>(config: {
  method: 'get' | 'post' | 'put' | 'delete';
  path: string;
  summary: string;
  tags: string[];
  request?: {
    body?: { content: { 'application/json': { schema: T } } };
    query?: T;
    params?: T;
  };
  responses: Record<
    number,
    { description: string; content: { 'application/json': { schema: T } } }
  >;
}) {
  return createRoute({
    ...config,
    security: [{ Bearer: [] }],
  });
}
```

**Success Criteria**:

- ✅ All infrastructure files created
- ✅ No compilation errors
- ✅ Auth middleware logic matches Elysia version
- ✅ OpenAPI setup ready for routers

---

## Phase 3: Router Migration (5-6 hours)

### Step 3.1: Migrate Category Router

**File**: `src/hono-routers/category.ts`

```typescript
import { OpenAPIHono, createRoute, z } from '@hono/zod-openapi';
import { prisma } from '../lib';

// Zod schemas
const CategorySchema = z.object({
  id: z.number(),
  name: z.string(),
  todos: z.array(z.object({ id: z.string() })),
});

const CategoryArraySchema = z.array(CategorySchema);

export const categoryRouter = new OpenAPIHono();

// GET /api/categories - List all categories
const listCategoriesRoute = createRoute({
  method: 'get',
  path: '/',
  tags: ['Category'],
  summary: 'Get all categories',
  responses: {
    200: {
      description: 'List of categories',
      content: {
        'application/json': {
          schema: CategoryArraySchema,
        },
      },
    },
  },
});

categoryRouter.openapi(listCategoriesRoute, async (c) => {
  const categories = await prisma.category.findMany({
    select: { id: true, name: true, todos: true },
  });
  return c.json(categories, 200);
});

// GET /api/categories/:id - Get category by ID
const getCategoryRoute = createRoute({
  method: 'get',
  path: '/{id}',
  tags: ['Category'],
  summary: 'Get category by ID',
  request: {
    params: z.object({
      id: z.string().transform(Number),
    }),
  },
  responses: {
    200: {
      description: 'Category details',
      content: {
        'application/json': {
          schema: CategorySchema.nullable(),
        },
      },
    },
  },
});

categoryRouter.openapi(getCategoryRoute, async (c) => {
  const { id } = c.req.valid('param');
  const category = await prisma.category.findUnique({
    where: { id },
    select: { id: true, name: true, todos: true },
  });
  return c.json(category, 200);
});
```

**Validation**:

```bash
# Test compilation
bun run --bun src/hono-routers/category.ts

# Should compile without errors
```

### Step 3.2: Migrate User Router

**File**: `src/hono-routers/user.ts`

```typescript
import { OpenAPIHono, createRoute, z } from '@hono/zod-openapi';
import { setCookie } from 'hono/cookie';
import { prisma } from '../lib';
import { message, messageSchema, errorSchema } from '../lib/message.hono';
import { authMiddleware, signToken } from '../lib/auth.hono';
import { UserAlreadyExistsError } from '../lib/errors';

export const userRouter = new OpenAPIHono();

// Zod schemas
const LoginSchema = z.object({
  email: z.string().email({ message: 'Invalid email' }),
  password: z.string().min(8).max(16, 'Password must be between 8 and 16 characters'),
});

const SignupSchema = z.object({
  email: z.string().email({ message: 'Invalid email' }),
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
    return c.json({ message: 'User not found' }, 400);
  }

  const isPasswordValid = await Bun.password.verify(password, user.password);
  if (!isPasswordValid) {
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

  return c.json(
    message('Login successful', {
      status: 'success',
      data: {
        token,
        userId: user.id,
        email: user.email,
      },
    }),
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
    return c.json(message('User created successfully'), 200);
  } catch (e) {
    if (e instanceof UserAlreadyExistsError) {
      return c.json(
        {
          message: e.message,
          data: e.details,
        },
        400
      );
    }
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

userRouter.openapi(listUsersRoute, authMiddleware, async (c) => {
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

userRouter.openapi(getMeRoute, authMiddleware, async (c) => {
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

userRouter.openapi(getUserRoute, authMiddleware, async (c) => {
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
```

### Step 3.3: Migrate Todo Router

**File**: `src/hono-routers/todo.ts`

```typescript
import { OpenAPIHono, createRoute, z } from '@hono/zod-openapi';
import { prisma, formatDate } from '../lib';
import { authMiddleware } from '../lib/auth.hono';

export const todoRouter = new OpenAPIHono();

// Zod schemas
const TodoSchema = z.object({
  id: z.string(),
  title: z.string(),
  completed: z.boolean(),
  categoryId: z.number(),
  userId: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

const CreateTodoSchema = z.object({
  title: z.string().min(1).max(200),
  completed: z.boolean().optional(),
  categoryId: z.number().optional(),
});

const UpdateTodoSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  completed: z.boolean().optional(),
  categoryId: z.number().optional(),
});

// GET /api/todos - List user's todos
const listTodosRoute = createRoute({
  method: 'get',
  path: '/',
  tags: ['Todo'],
  summary: 'Get all todos for authenticated user',
  security: [{ Bearer: [] }],
  request: {
    query: z.object({
      categoryId: z.string().transform(Number).optional(),
    }),
  },
  responses: {
    200: {
      description: 'List of todos',
      content: {
        'application/json': {
          schema: z.array(TodoSchema),
        },
      },
    },
  },
});

todoRouter.openapi(listTodosRoute, authMiddleware, async (c) => {
  const userId = c.get('userId');
  const query = c.req.valid('query');

  const todos = await prisma.todo.findMany({
    where: {
      userId,
      categoryId: query.categoryId || undefined,
    },
  });

  return c.json(
    todos.map((todo) => ({
      ...todo,
      userId: todo.userId ?? '',
      createdAt: formatDate(todo.createdAt),
      updatedAt: formatDate(todo.updatedAt),
    })),
    200
  );
});

// GET /api/todos/:id - Get single todo
const getTodoRoute = createRoute({
  method: 'get',
  path: '/{id}',
  tags: ['Todo'],
  summary: 'Get todo by ID (must be owned by user)',
  security: [{ Bearer: [] }],
  request: {
    params: z.object({
      id: z.string(),
    }),
  },
  responses: {
    200: {
      description: 'Todo details',
      content: {
        'application/json': {
          schema: TodoSchema,
        },
      },
    },
    403: {
      description: 'Access denied',
      content: {
        'application/json': {
          schema: z.object({ message: z.string() }),
        },
      },
    },
    404: {
      description: 'Todo not found',
      content: {
        'application/json': {
          schema: z.object({ message: z.string() }),
        },
      },
    },
  },
});

todoRouter.openapi(getTodoRoute, authMiddleware, async (c) => {
  const { id } = c.req.valid('param');
  const userId = c.get('userId');

  const todo = await prisma.todo.findUnique({ where: { id } });

  if (!todo) {
    return c.json({ message: 'Todo not found' }, 404);
  }

  if (todo.userId !== userId) {
    return c.json({ message: 'Access denied' }, 403);
  }

  return c.json(
    {
      ...todo,
      userId: todo.userId ?? '',
      createdAt: formatDate(todo.createdAt),
      updatedAt: formatDate(todo.updatedAt),
    },
    200
  );
});

// POST /api/todos - Create todo
const createTodoRoute = createRoute({
  method: 'post',
  path: '/',
  tags: ['Todo'],
  summary: 'Create new todo',
  security: [{ Bearer: [] }],
  request: {
    body: {
      content: {
        'application/json': {
          schema: CreateTodoSchema,
        },
      },
    },
  },
  responses: {
    200: {
      description: 'Todo created',
      content: {
        'application/json': {
          schema: TodoSchema,
        },
      },
    },
    400: {
      description: 'No categories available',
      content: {
        'application/json': {
          schema: z.object({ message: z.string() }),
        },
      },
    },
  },
});

todoRouter.openapi(createTodoRoute, authMiddleware, async (c) => {
  const userId = c.get('userId');
  const body = c.req.valid('json');

  let categoryId = body.categoryId;

  if (!categoryId) {
    const category = await prisma.category.findFirst();
    if (!category) {
      return c.json({ message: 'No categories available. Please create a category first.' }, 400);
    }
    categoryId = category.id;
  }

  const todo = await prisma.todo.create({
    data: {
      title: body.title,
      completed: body.completed ?? false,
      categoryId,
      userId,
    },
  });

  return c.json(
    {
      ...todo,
      userId: todo.userId ?? '',
      createdAt: formatDate(todo.createdAt),
      updatedAt: formatDate(todo.updatedAt),
    },
    200
  );
});

// PUT /api/todos/:id - Update todo
const updateTodoRoute = createRoute({
  method: 'put',
  path: '/{id}',
  tags: ['Todo'],
  summary: 'Update todo (must be owned by user)',
  security: [{ Bearer: [] }],
  request: {
    params: z.object({
      id: z.string(),
    }),
    body: {
      content: {
        'application/json': {
          schema: UpdateTodoSchema,
        },
      },
    },
  },
  responses: {
    200: {
      description: 'Todo updated',
      content: {
        'application/json': {
          schema: TodoSchema,
        },
      },
    },
    403: {
      description: 'Access denied',
      content: {
        'application/json': {
          schema: z.object({ message: z.string() }),
        },
      },
    },
    404: {
      description: 'Todo not found',
      content: {
        'application/json': {
          schema: z.object({ message: z.string() }),
        },
      },
    },
  },
});

todoRouter.openapi(updateTodoRoute, authMiddleware, async (c) => {
  const { id } = c.req.valid('param');
  const userId = c.get('userId');
  const body = c.req.valid('json');

  const existingTodo = await prisma.todo.findUnique({ where: { id } });

  if (!existingTodo) {
    return c.json({ message: 'Todo not found' }, 404);
  }

  if (existingTodo.userId !== userId) {
    return c.json({ message: 'Access denied' }, 403);
  }

  const todo = await prisma.todo.update({
    where: { id },
    data: body,
  });

  return c.json(
    {
      ...todo,
      userId: todo.userId ?? '',
      createdAt: formatDate(todo.createdAt),
      updatedAt: formatDate(todo.updatedAt),
    },
    200
  );
});

// DELETE /api/todos/:id - Delete todo
const deleteTodoRoute = createRoute({
  method: 'delete',
  path: '/{id}',
  tags: ['Todo'],
  summary: 'Delete todo (must be owned by user)',
  security: [{ Bearer: [] }],
  request: {
    params: z.object({
      id: z.string(),
    }),
  },
  responses: {
    200: {
      description: 'Todo deleted',
      content: {
        'application/json': {
          schema: z.object({
            message: z.string(),
            id: z.string(),
          }),
        },
      },
    },
    403: {
      description: 'Access denied',
      content: {
        'application/json': {
          schema: z.object({ message: z.string() }),
        },
      },
    },
    404: {
      description: 'Todo not found',
      content: {
        'application/json': {
          schema: z.object({ message: z.string() }),
        },
      },
    },
  },
});

todoRouter.openapi(deleteTodoRoute, authMiddleware, async (c) => {
  const { id } = c.req.valid('param');
  const userId = c.get('userId');

  const existingTodo = await prisma.todo.findUnique({ where: { id } });

  if (!existingTodo) {
    return c.json({ message: 'Todo not found' }, 404);
  }

  if (existingTodo.userId !== userId) {
    return c.json({ message: 'Access denied' }, 403);
  }

  await prisma.todo.delete({ where: { id } });

  return c.json(
    {
      message: 'Todo deleted successfully',
      id,
    },
    200
  );
});
```

**Success Criteria**:

- ✅ All routers compile without errors
- ✅ Feature parity with Elysia versions
- ✅ Auth middleware properly integrated
- ✅ OpenAPI schemas defined

---

## Phase 4: Integration & Testing (2-3 hours)

### Step 4.1: Wire Routers to Main App

**File**: `src/index.hono.ts` (update)

```typescript
import { Hono } from 'hono';
import { logger } from 'hono/logger';
import { cors } from 'hono/cors';
import { swaggerUI } from '@hono/swagger-ui';
import { categoryRouter } from './hono-routers/category';
import { userRouter } from './hono-routers/user';
import { todoRouter } from './hono-routers/todo';

const app = new Hono();

// Global middleware
app.use('*', logger());
app.use('*', cors());

// Mount routers
app.route('/api/categories', categoryRouter);
app.route('/api', userRouter); // Handles /api/auth/* and /api/users/*
app.route('/api/todos', todoRouter);

// Swagger UI
app.get('/swagger', swaggerUI({ url: '/openapi.json' }));

// OpenAPI spec endpoint
app.get('/openapi.json', (c) => {
  return c.json(
    app.getOpenAPIDocument({
      openapi: '3.0.0',
      info: {
        title: 'Todo List API',
        version: '2.0.0',
        description: 'Todo List Management API - Hono Framework',
      },
    })
  );
});

// Health check
app.get('/', (c) => {
  return c.json({
    message: 'Todo List API - Hono',
    version: '2.0.0',
    framework: 'Hono',
    documentation: '/swagger',
  });
});

const port = 3000; // Switch to production port
console.log(`🔥 Hono server running at http://localhost:${port}`);
console.log(`📚 API Documentation: http://localhost:${port}/swagger`);

export default {
  port,
  fetch: app.fetch,
};
```

### Step 4.2: Update Package Scripts

**File**: `package.json`

```json
{
  "scripts": {
    "dev": "bun run --watch src/index.hono.ts",
    "dev:old": "bun run --watch src/index.ts",
    "start": "NODE_ENV=production bun src/index.hono.ts",
    "build": "bun build src/index.hono.ts --target bun --outdir ./dist"
  }
}
```

### Step 4.3: Manual Testing Checklist

**Authentication Tests**:

```bash
# 1. Signup
curl -X POST http://localhost:3000/api/auth/signup \
  -H "Content-Type: application/json" \
  -d '{"email":"test@hono.com","password":"test1234"}'

# Expected: {"message":"User created successfully","status":"success"}

# 2. Login
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@hono.com","password":"test1234"}'

# Expected: {"message":"Login successful", "data":{"token":"...", ...}}
# Save the token from response

# 3. Set token variable
TOKEN="<paste-token-here>"

# 4. Get current user
curl http://localhost:3000/api/users/me \
  -H "Authorization: Bearer $TOKEN"

# Expected: User profile with todos and posts
```

**Todo Tests**:

```bash
# 1. List todos (should be empty)
curl http://localhost:3000/api/todos \
  -H "Authorization: Bearer $TOKEN"

# Expected: []

# 2. Create todo
curl -X POST http://localhost:3000/api/todos \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"title":"Test Hono Migration","completed":false,"categoryId":1}'

# Expected: Todo object with ID

# 3. List todos (should have 1)
curl http://localhost:3000/api/todos \
  -H "Authorization: Bearer $TOKEN"

# Expected: Array with 1 todo

# 4. Update todo
TODO_ID="<paste-id-from-create>"
curl -X PUT http://localhost:3000/api/todos/$TODO_ID \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"completed":true}'

# Expected: Updated todo with completed:true

# 5. Delete todo
curl -X DELETE http://localhost:3000/api/todos/$TODO_ID \
  -H "Authorization: Bearer $TOKEN"

# Expected: {"message":"Todo deleted successfully","id":"..."}
```

**Category Tests**:

```bash
# List categories
curl http://localhost:3000/api/categories

# Expected: Array of categories

# Get category by ID
curl http://localhost:3000/api/categories/1

# Expected: Category object with todos
```

**Documentation Test**:

```bash
# Open in browser
open http://localhost:3000/swagger

# Verify: Swagger UI loads with all endpoints documented
```

### Step 4.4: Validation Checklist

- [ ] ✅ Signup works and creates user
- [ ] ✅ Login returns JWT token and sets cookie
- [ ] ✅ Auth middleware rejects requests without token (401)
- [ ] ✅ Auth middleware accepts valid token
- [ ] ✅ Todo CRUD works with ownership validation
- [ ] ✅ Category endpoints return data
- [ ] ✅ User endpoints require authentication
- [ ] ✅ Swagger UI displays at /swagger
- [ ] ✅ OpenAPI spec available at /openapi.json
- [ ] ✅ Error responses have correct format
- [ ] ✅ Date formatting works (createdAt, updatedAt)
- [ ] ✅ Cookie-based auth works (test in browser)

**Success Criteria**:

- ✅ All manual tests pass
- ✅ Feature parity with Elysia version
- ✅ No regressions in functionality

---

## Phase 5: Cleanup & Optimization (1-2 hours)

### Step 5.1: Remove Elysia Dependencies

```bash
# Remove Elysia packages
bun remove elysia @elysiajs/jwt @elysiajs/cookie @elysiajs/swagger @sinclair/typebox
```

### Step 5.2: Delete Old Files

```bash
# Remove old routers
rm -rf src/routers/

# Remove old index
rm src/index.ts

# Rename Hono files to primary
mv src/index.hono.ts src/index.ts
mv src/hono-routers/ src/routers/
mv src/lib/message.hono.ts src/lib/message.ts
mv src/lib/auth.hono.ts src/lib/auth.ts

# Remove old openapi helper if created
rm -f src/lib/openapi.hono.ts
mv src/lib/openapi.hono.ts src/lib/openapi.ts
```

### Step 5.3: Update Imports

**Files to update**:

- `src/routers/category.ts`
- `src/routers/user.ts`
- `src/routers/todo.ts`
- `src/index.ts`

Remove `.hono` from all imports:

```typescript
// Before
import { message } from '../lib/message.hono';
import { authMiddleware } from '../lib/auth.hono';

// After
import { message } from '../lib/message';
import { authMiddleware } from '../lib/auth';
```

### Step 5.4: Update CLAUDE.md

**File**: `CLAUDE.md`

Update these sections:

```markdown
## Tech Stack

- **Runtime**: Bun (replaces Node.js)
- **Web Framework**: Hono (high-performance TypeScript framework) ← Changed
- **ORM**: Prisma with SQLite
- **Authentication**: JWT via Hono's built-in JWT + bcrypt ← Changed
- **Validation**: Zod validation ← Changed
- **API Docs**: Swagger UI via @hono/zod-openapi ← Changed

## Key Patterns

### Router Organization

Each router is a Hono instance with:

- **Prefix**: Routes grouped by domain (e.g., `/api/todos`, `/api/auth`)
- **Type Safety**: Request/response schemas defined with Zod ← Changed
- **OpenAPI Integration**: Routes defined with @hono/zod-openapi ← Changed
```

### Step 5.5: Final Validation

```bash
# 1. Clean build
rm -rf dist/
bun run build

# 2. Run production mode
bun start

# 3. Run all tests again
# (Use the test commands from Step 4.3)

# 4. Check Swagger documentation
open http://localhost:3000/swagger
```

**Success Criteria**:

- ✅ No Elysia dependencies in package.json
- ✅ All old files removed
- ✅ Production build works
- ✅ All tests still pass
- ✅ Documentation updated
- ✅ No TypeScript errors

---

## Rollback Strategy

If critical issues arise during migration:

### Quick Rollback (Minutes)

```bash
# 1. Switch back to old entry point
# Edit package.json
{
  "scripts": {
    "dev": "bun run --watch src/index.ts",  # ← Change back
  }
}

# 2. Restart server
bun run dev

# Old Elysia app should work immediately
```

### Full Rollback (1 hour)

```bash
# 1. Git revert (if using version control)
git log --oneline  # Find commit before migration
git revert <commit-hash>

# 2. Reinstall Elysia dependencies
bun install

# 3. Clean up Hono files
rm -rf src/hono-routers/
rm src/index.hono.ts
rm src/lib/*.hono.ts

# 4. Remove Hono dependencies
bun remove hono zod @hono/zod-validator @hono/zod-openapi
```

---

## Common Issues & Solutions

### Issue 1: "Cannot find module 'hono'"

**Cause**: Dependencies not installed
**Solution**:

```bash
bun install
# or
bun add hono zod @hono/zod-validator @hono/zod-openapi
```

### Issue 2: TypeScript errors about Zod schemas

**Cause**: Schema definition mismatch
**Solution**: Ensure Zod schema matches TypeScript type:

```typescript
// Correct
const schema = z.object({
  id: z.string(),
  name: z.string(),
});

type MyType = z.infer<typeof schema>; // Infer type from schema
```

### Issue 3: JWT verification fails

**Cause**: JWT_SECRET not set or different algorithm
**Solution**:

```bash
# Check .env file
cat .env | grep JWT_SECRET

# Ensure same secret as before
# Hono JWT uses HS256 by default (same as Elysia)
```

### Issue 4: Cookie not being set

**Cause**: Cookie options incorrect
**Solution**:

```typescript
import { setCookie } from 'hono/cookie';

setCookie(c, 'token', token, {
  httpOnly: true,
  maxAge: 7 * 24 * 60 * 60,
  path: '/',
  sameSite: 'Lax', // Capital L
});
```

### Issue 5: OpenAPI documentation not showing

**Cause**: Routes not registered with OpenAPIHono
**Solution**:

```typescript
// Use OpenAPIHono, not regular Hono
import { OpenAPIHono } from '@hono/zod-openapi';

const router = new OpenAPIHono(); // ← Correct

// Use .openapi() method, not .get()
router.openapi(route, handler); // ← Correct
```

### Issue 6: Auth middleware not working

**Cause**: Middleware not properly typed
**Solution**:

```typescript
import { createMiddleware } from 'hono/factory';

type AuthVariables = {
  userId: string;
};

export const authMiddleware = createMiddleware<{ Variables: AuthVariables }>(async (c, next) => {
  // ... auth logic
  c.set('userId', userId); // Type-safe
  await next();
});
```

### Issue 7: Request validation fails silently

**Cause**: Missing validator middleware
**Solution**:

```typescript
import { zValidator } from '@hono/zod-validator';

// For non-OpenAPI routes
app.post('/path', zValidator('json', schema), async (c) => {
  const data = c.req.valid('json'); // Validated
});
```

---

## Migration Completion Checklist

### Pre-Migration

- [ ] Backup current codebase (git commit)
- [ ] Document current API behavior
- [ ] Set up test environment

### Phase 1: Foundation

- [ ] Install Hono dependencies
- [ ] Create parallel structure
- [ ] Base Hono app runs
- [ ] Health check works

### Phase 2: Infrastructure

- [ ] Message helpers converted
- [ ] Auth middleware created
- [ ] OpenAPI setup complete
- [ ] No TypeScript errors

### Phase 3: Routers

- [ ] Category router migrated
- [ ] User router migrated
- [ ] Todo router migrated
- [ ] All routers compile

### Phase 4: Integration

- [ ] Routers wired to app
- [ ] Package scripts updated
- [ ] All manual tests pass
- [ ] Swagger UI works

### Phase 5: Cleanup

- [ ] Elysia dependencies removed
- [ ] Old files deleted
- [ ] Documentation updated
- [ ] Production build works

### Post-Migration

- [ ] All features working
- [ ] Performance acceptable
- [ ] Documentation accurate
- [ ] Team trained on Hono

---

## Performance Comparison

After migration, compare performance:

```bash
# Install benchmarking tool
bun add -d autocannon

# Benchmark Elysia (before)
autocannon -c 100 -d 10 http://localhost:3000/api/categories

# Benchmark Hono (after)
autocannon -c 100 -d 10 http://localhost:3000/api/categories

# Compare requests/sec, latency, throughput
```

**Expected Results**:

- Similar or better performance with Hono
- Lower memory usage
- Comparable latency

---

## Next Steps After Migration

1. **Add Rate Limiting**

   ```bash
   bun add @hono/rate-limiter
   ```

2. **Add Request Logging**

   ```typescript
   import { logger } from 'hono/logger';
   app.use('*', logger());
   ```

3. **Add CORS Configuration**

   ```typescript
   import { cors } from 'hono/cors';
   app.use(
     '*',
     cors({
       origin: ['http://localhost:3000'],
       credentials: true,
     })
   );
   ```

4. **Set Up Testing**

   ```bash
   bun add -d vitest @hono/testing
   ```

5. **Address Security Issues from Analysis**
   - Remove hardcoded credentials
   - Add auth to category endpoints
   - Implement rate limiting

---

## Estimated Timeline Summary

| Phase                   | Duration        | Blocking?                        |
| ----------------------- | --------------- | -------------------------------- |
| Phase 1: Foundation     | 2-3 hours       | Yes                              |
| Phase 2: Infrastructure | 3-4 hours       | Yes                              |
| Phase 3: Routers        | 5-6 hours       | Partially (can do incrementally) |
| Phase 4: Integration    | 2-3 hours       | Yes                              |
| Phase 5: Cleanup        | 1-2 hours       | No                               |
| **Total**               | **13-18 hours** | -                                |

**Recommended Schedule**:

- **Day 1 (4 hours)**: Phases 1-2
- **Day 2 (6 hours)**: Phase 3
- **Day 3 (4 hours)**: Phases 4-5

---

## Success Metrics

Migration is successful when:

- ✅ **100% feature parity** with Elysia version
- ✅ **All API endpoints** return correct responses
- ✅ **Authentication flows** work (signup, login, protected routes)
- ✅ **OpenAPI documentation** displays all endpoints
- ✅ **No TypeScript errors** in codebase
- ✅ **Production build** completes successfully
- ✅ **All manual tests** pass
- ✅ **Zero Elysia dependencies** remain
- ✅ **Documentation** reflects Hono usage

---

## Pre-Migration Checklist

Before starting the migration, ensure:

- [ ] **Git Status Clean**: All changes committed, working directory clean
- [ ] **Create Feature Branch**: `git checkout -b migration/elysia-to-hono`
- [ ] **Backup Database**: Copy `prisma/dev.db` to safe location
- [ ] **Document Current State**: Run all endpoints and save response examples
- [ ] **Environment Variables**: Verify `.env` file has `JWT_SECRET` and `DATABASE_URL`
- [ ] **Dependencies Up-to-Date**: Run `bun install` to sync lockfile
- [ ] **Current Tests Pass**: Verify existing functionality works (manual testing)
- [ ] **Read Analysis Report**: Review `/sc:analyze` findings for issues to fix during migration

---

## Migration Execution Checklist

### Phase 1: Foundation Setup ✓

- [ ] Install Hono core dependencies
  ```bash
  bun add hono @hono/zod-openapi zod
  ```
- [ ] Install Hono plugins
  ```bash
  bun add @hono/zod-validator hono-rate-limiter
  ```
- [ ] Create parallel directory structure
  ```bash
  mkdir -p src/lib/hono src/routers/hono
  ```
- [ ] Verify TypeScript compilation: `bun run build`
- [ ] Commit: `git commit -m "chore: install Hono dependencies"`

### Phase 2: Core Infrastructure Migration ✓

- [ ] **Step 2.1**: Create Zod schemas in `src/types/schemas.hono.ts`
  - [ ] Message schema
  - [ ] Error schema
  - [ ] User schemas (signup, login, response)
  - [ ] Todo schemas (create, update, response)
  - [ ] Category schemas
  - [ ] Verify: TypeScript compiles

- [ ] **Step 2.2**: Create auth middleware in `src/lib/auth.hono.ts`
  - [ ] Implement `authMiddleware` with JWT verification
  - [ ] Implement `optionalAuth` for public endpoints
  - [ ] Add `signToken` helper function
  - [ ] Test: Manual JWT token generation/verification

- [ ] **Step 2.3**: Create OpenAPI setup in `src/lib/openapi.hono.ts`
  - [ ] Configure OpenAPIHono app
  - [ ] Define API metadata (title, version, tags)
  - [ ] Create helper functions for route creation
  - [ ] Verify: TypeScript compiles

- [ ] **Step 2.4**: Update message helpers in `src/lib/message.hono.ts`
  - [ ] Port response helper functions
  - [ ] Use Zod schemas for validation
  - [ ] Verify: TypeScript compiles

- [ ] Commit: `git commit -m "feat: create Hono core infrastructure"`

### Phase 3: Router Migration ✓

#### Category Router (`src/routers/category.hono.ts`)

- [ ] Create category router file
- [ ] Define Zod schemas for category operations
- [ ] Implement GET `/api/categories` (list all)
- [ ] Implement POST `/api/categories` (create)
- [ ] Implement GET `/api/categories/:id` (get one)
- [ ] Implement PUT `/api/categories/:id` (update)
- [ ] Implement DELETE `/api/categories/:id` (delete)
- [ ] **Security Fix**: Add `authMiddleware` to all routes
- [ ] **Performance Fix**: Remove `select: { todos: true }` to prevent N+1 queries
- [ ] Test manually: All CRUD operations work
- [ ] Commit: `git commit -m "feat: migrate category router to Hono with security fixes"`

#### User Router (`src/routers/user.hono.ts`)

- [ ] Create user router file
- [ ] Define Zod schemas (signup, login, user response)
- [ ] Implement POST `/api/auth/signup`
  - [ ] Password hashing with bcrypt
  - [ ] Email validation
  - [ ] Return success message
- [ ] Implement POST `/api/auth/login`
  - [ ] Password verification
  - [ ] JWT token generation
  - [ ] HttpOnly cookie setting (7-day expiry)
  - [ ] Return token + set cookie
- [ ] Implement GET `/api/users/me` (authenticated)
- [ ] Implement GET `/api/users` (authenticated, admin only if applicable)
- [ ] Implement GET `/api/users/:id` (authenticated, ownership check)
- [ ] Implement PUT `/api/users/:id` (authenticated, ownership check)
- [ ] Implement DELETE `/api/users/:id` (authenticated, ownership check)
- [ ] Add `.onError()` handler for validation errors
- [ ] Test manually: Signup → Login → Get profile → Update → Delete
- [ ] Commit: `git commit -m "feat: migrate user and auth routers to Hono"`

#### Todo Router (`src/routers/todo.hono.ts`)

- [ ] Create todo router file
- [ ] Define Zod schemas (create, update, todo response)
- [ ] Implement GET `/api/todos` (list with optional categoryId filter)
  - [ ] Use `authMiddleware` (remove duplicate auth logic)
  - [ ] Filter by `userId` from context
  - [ ] Support `categoryId` query parameter
  - [ ] Format dates with `formatDate()`
- [ ] Implement GET `/api/todos/:id` (get one)
  - [ ] Ownership verification (`todo.userId === userId`)
  - [ ] Return 403 if unauthorized
- [ ] Implement POST `/api/todos` (create)
  - [ ] Validate category exists and belongs to user
  - [ ] Create todo with userId from context
  - [ ] Return formatted response
- [ ] Implement PUT `/api/todos/:id` (update)
  - [ ] Ownership verification
  - [ ] Allow title, completed, categoryId updates
- [ ] Implement DELETE `/api/todos/:id` (delete)
  - [ ] Ownership verification
  - [ ] Soft delete or hard delete based on requirements
- [ ] **Refactor**: Remove duplicate auth logic (lines 9-33 in Elysia version)
- [ ] Test manually: Full CRUD cycle for todos
- [ ] Commit: `git commit -m "feat: migrate todo router to Hono with auth refactor"`

### Phase 4: Integration & Testing ✓

- [ ] **Step 4.1**: Create main Hono app in `src/index.hono.ts`
  - [ ] Import OpenAPI app creator
  - [ ] Import all Hono routers
  - [ ] Mount routers with `.route()` method
  - [ ] Add 404 handler
  - [ ] Add global error handler
  - [ ] Configure server to listen on port 3000

- [ ] **Step 4.2**: Update package.json scripts

  ```json
  {
    "scripts": {
      "dev:hono": "bun --watch src/index.hono.ts",
      "dev": "bun --watch src/index.ts",
      "start:hono": "bun src/index.hono.ts",
      "build:hono": "bun build src/index.hono.ts --outfile dist/index.hono.js --target bun"
    }
  }
  ```

- [ ] **Step 4.3**: Manual Testing (Hono version)
  - [ ] Start Hono server: `bun run dev:hono`
  - [ ] **Auth Flow**:
    - [ ] POST `/api/auth/signup` → 200 success
    - [ ] POST `/api/auth/login` → 200 with token + cookie
    - [ ] Verify cookie is HttpOnly and has 7-day expiry
  - [ ] **User Endpoints** (with auth token):
    - [ ] GET `/api/users/me` → Returns current user
    - [ ] GET `/api/users/:id` → Returns specific user (ownership check)
    - [ ] PUT `/api/users/:id` → Updates user (ownership check)
  - [ ] **Category Endpoints** (with auth token):
    - [ ] GET `/api/categories` → Returns categories for current user
    - [ ] POST `/api/categories` → Creates category
    - [ ] GET `/api/categories/:id` → Returns specific category
    - [ ] PUT `/api/categories/:id` → Updates category
    - [ ] DELETE `/api/categories/:id` → Deletes category
    - [ ] Verify 401 without auth token
  - [ ] **Todo Endpoints** (with auth token):
    - [ ] GET `/api/todos` → Returns todos for current user
    - [ ] GET `/api/todos?categoryId=1` → Filters by category
    - [ ] POST `/api/todos` → Creates todo
    - [ ] GET `/api/todos/:id` → Returns specific todo
    - [ ] PUT `/api/todos/:id` → Updates todo
    - [ ] DELETE `/api/todos/:id` → Deletes todo
    - [ ] Verify 401 without auth token
    - [ ] Verify 403 when accessing another user's todo
  - [ ] **OpenAPI Documentation**:
    - [ ] Visit `/doc` → Swagger UI renders correctly
    - [ ] All endpoints visible and documented
    - [ ] Security schemas show Bearer auth
    - [ ] Test endpoints directly from Swagger UI

- [ ] **Step 4.4**: Feature Parity Verification
  - [ ] Compare Elysia and Hono responses side-by-side
  - [ ] Verify date formatting matches (`MM/DD/YYYY HH:mm:ss`)
  - [ ] Verify error messages match
  - [ ] Verify HTTP status codes match
  - [ ] Verify cookie behavior matches (expiry, HttpOnly flag)

- [ ] **Step 4.5**: Performance Testing
  - [ ] Test large dataset: Create 100 todos, list all
  - [ ] Verify no N+1 queries in category endpoints
  - [ ] Verify response times acceptable (<100ms for simple queries)

- [ ] Commit: `git commit -m "feat: integrate Hono app and complete testing"`

### Phase 5: Cleanup & Optimization ✓

- [ ] **Step 5.1**: Switch to Hono as primary
  - [ ] Rename `src/index.ts` → `src/index.elysia.backup.ts`
  - [ ] Rename `src/index.hono.ts` → `src/index.ts`
  - [ ] Update `package.json` scripts:
    ```json
    {
      "dev": "bun --watch src/index.ts",
      "start": "bun src/index.ts",
      "build": "bun build src/index.ts --outfile dist/index.js --target bun"
    }
    ```

- [ ] **Step 5.2**: Remove Elysia files
  - [ ] Delete `src/routers/user.ts` (Elysia version)
  - [ ] Delete `src/routers/todo.ts` (Elysia version)
  - [ ] Delete `src/routers/category.ts` (Elysia version)
  - [ ] Delete `src/lib/auth.ts` (Elysia version)
  - [ ] Delete `src/index.elysia.backup.ts`
  - [ ] Rename Hono files to remove `.hono` suffix:
    ```bash
    mv src/routers/category.hono.ts src/routers/category.ts
    mv src/routers/user.hono.ts src/routers/user.ts
    mv src/routers/todo.hono.ts src/routers/todo.ts
    mv src/lib/auth.hono.ts src/lib/auth.ts
    mv src/lib/message.hono.ts src/lib/message.ts
    mv src/lib/openapi.hono.ts src/lib/openapi.ts
    mv src/types/schemas.hono.ts src/types/schemas.ts
    ```

- [ ] **Step 5.3**: Remove dead code
  - [ ] Delete `src/controllers/todo.ts` (100% commented out)
  - [ ] Delete `src/models/todo.ts` (empty file)
  - [ ] Delete `src/setup.ts` (empty file)

- [ ] **Step 5.4**: Remove Elysia dependencies

  ```bash
  bun remove elysia @elysiajs/swagger @elysiajs/jwt @elysiajs/cookie
  ```

- [ ] **Step 5.5**: Update documentation
  - [ ] Update `CLAUDE.md`:
    - [ ] Replace Elysia references with Hono
    - [ ] Document Zod validation instead of TypeBox
    - [ ] Document `@hono/zod-openapi` for API docs
    - [ ] Update example router code
    - [ ] Document new auth middleware usage
  - [ ] Update `README.md`:
    - [ ] Replace "Elysia template" with "Hono framework"
    - [ ] Update tech stack section
    - [ ] Add Hono documentation links
  - [ ] Update `AUTH_IMPLEMENTATION.md` if needed

- [ ] **Step 5.6**: Security improvements (from analysis)
  - [ ] Remove hardcoded credentials from `src/routers/leetcode.ts:91`
    - [ ] Use environment variable `LEETCODE_SESSION`
    - [ ] Add to `.env.example` with placeholder
  - [ ] Implement rate limiting:
    ```typescript
    import { rateLimiter } from 'hono-rate-limiter';
    app.use(
      '*',
      rateLimiter({
        windowMs: 15 * 60 * 1000, // 15 minutes
        max: 100, // limit each IP to 100 requests per windowMs
      })
    );
    ```
  - [ ] Add CORS configuration:
    ```typescript
    import { cors } from 'hono/cors';
    app.use(
      '*',
      cors({
        origin: ['http://localhost:3000'],
        credentials: true,
      })
    );
    ```

- [ ] **Step 5.7**: Performance improvements (from analysis)
  - [ ] Add database indexes to `prisma/schema.prisma`:

    ```prisma
    model Todo {
      // ... existing fields ...
      @@index([userId])
      @@index([categoryId])
    }

    model Category {
      // ... existing fields ...
      @@index([userId])
    }
    ```

  - [ ] Run migration: `bunx prisma migrate dev --name add_performance_indexes`
  - [ ] Add pagination support to list endpoints (optional):
    ```typescript
    const { page = 1, limit = 20 } = c.req.query();
    const skip = (page - 1) * limit;
    const todos = await prisma.todo.findMany({
      where: { userId },
      skip,
      take: limit,
    });
    ```

- [ ] **Step 5.8**: Final verification
  - [ ] Run TypeScript build: `bun run build` → No errors
  - [ ] Run dev server: `bun run dev` → Starts successfully
  - [ ] Test all endpoints one final time
  - [ ] Verify OpenAPI docs at `/doc`
  - [ ] Check bundle size: `ls -lh dist/`

- [ ] Commit: `git commit -m "chore: remove Elysia dependencies and optimize app"`

### Post-Migration Checklist

- [ ] **Code Quality**:
  - [ ] No TypeScript errors: `bun run build`
  - [ ] No Elysia imports remaining: `grep -r "@elysiajs" src/`
  - [ ] All routers use Hono patterns
  - [ ] All validation uses Zod schemas
  - [ ] Error handling consistent across routers

- [ ] **Functionality**:
  - [ ] All API endpoints respond correctly
  - [ ] Authentication flow works (signup → login → protected routes)
  - [ ] Authorization checks work (users can't access others' resources)
  - [ ] JWT tokens verified correctly
  - [ ] HttpOnly cookies set correctly (7-day expiry)
  - [ ] Date formatting correct (`MM/DD/YYYY HH:mm:ss`)

- [ ] **Documentation**:
  - [ ] OpenAPI docs accessible at `/doc`
  - [ ] All endpoints documented with correct schemas
  - [ ] `CLAUDE.md` updated with Hono patterns
  - [ ] `README.md` updated with new tech stack
  - [ ] Security fixes documented

- [ ] **Performance**:
  - [ ] No N+1 queries (category endpoints optimized)
  - [ ] Database indexes added for foreign keys
  - [ ] Response times acceptable (<100ms for simple queries)

- [ ] **Security**:
  - [ ] No hardcoded credentials in code
  - [ ] Authentication required for all sensitive endpoints
  - [ ] Rate limiting enabled
  - [ ] CORS configured properly
  - [ ] Category endpoints now require authentication

- [ ] **Cleanup**:
  - [ ] No dead code files (`controllers/todo.ts`, `models/todo.ts`, `setup.ts`)
  - [ ] No `.hono` file suffixes
  - [ ] No Elysia dependencies in `package.json`
  - [ ] Clean git status

- [ ] **Final Steps**:
  - [ ] Merge feature branch: `git checkout main && git merge migration/elysia-to-hono`
  - [ ] Tag release: `git tag -a v2.0.0 -m "Migration from Elysia to Hono"`
  - [ ] Push to remote: `git push && git push --tags`
  - [ ] Update deployment if applicable
  - [ ] Announce migration to team

---

**Migration workflow complete. Ready for execution.**
