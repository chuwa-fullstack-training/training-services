# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

### Essential Commands
```bash
# Development server with hot-reload
bun run dev

# Production build
bun run build

# Production server
bun start

# Run tests (uses .env.test database)
bun test

# Type checking
bunx --bun tsc --noEmit

# Code formatting
prettier --write .

# Update CHANGELOG.md manually (runs automatically via version:* scripts)
bun run scripts/update-changelog.ts
```

### Database Commands
```bash
# Initialize database with migrations
bunx --bun prisma migrate dev --name init

# Reset database (WARNING: deletes all data)
bunx --bun prisma migrate reset

# Seed database with initial data
bunx --bun prisma db seed

# Generate Prisma client after schema changes
bunx prisma generate
```

## Architecture Overview

### Tech Stack
- **Runtime**: Bun (not Node.js)
- **Framework**: Hono (OpenAPI-enabled variant)
- **Database**: PostgreSQL with Prisma ORM
- **Authentication**: JWT with dual support (Authorization header + HttpOnly cookies)
- **Logging**: Pino with hono-pino integration
- **Rate Limiting**: hono-rate-limiter with three-tier configuration
- **GraphQL**: graphql-yoga (schema-first, mounted alongside REST at `/graphql`)

### Key Architectural Patterns

#### 1. Prisma Client Extension Pattern
The application uses Prisma client extensions for custom business logic:
- Located in `src/lib/index.ts`
- PostgreSQL adapter via `pg` pool + `@prisma/adapter-pg`
- Prisma Accelerate extension for query caching
- Custom model methods (e.g., `user.signUp()` with built-in validation and error handling)

#### 2. Middleware Execution Order (Critical)
Defined in `src/index.ts` - order matters:
1. **Logger middleware** (must be first to capture all requests)
2. **CORS middleware**
3. **Auth rate limiter** (`/api/auth/*` - 100 req/15min)
4. **Public rate limiter** (`/api/categories*` - 500 req/15min)
5. **Authenticated routes** use per-user rate limiting (1000 req/15min)

#### 3. Authentication Strategy
Dual token acceptance pattern in `src/lib/auth.ts`:
- **Priority 1**: Check `Authorization: Bearer <token>` header
- **Priority 2**: Fall back to `token` cookie
- Two middleware variants:
  - `authMiddleware`: Returns 401 if unauthenticated (required auth)
  - `optionalAuth`: Silently continues without userId if unauthenticated

#### 4. Router Organization
OpenAPI-first approach using `@hono/zod-openapi`:
- Each router file defines Zod schemas for validation and OpenAPI generation
- Routes use `createRoute()` for OpenAPI metadata
- Router registration in `src/index.ts`:
  - `userRouter` handles both `/api/auth/*` and `/api/users/*`
  - `todoRouter` handles `/api/todos/*`
  - `postRouter` handles `/api/posts/*`
  - `commentRouter` handles `/api/posts/:postId/comments/*` (mounted at `/api/posts`)
  - `categoryRouter` handles `/api/categories/*`

#### 5. Error Handling Pattern
Custom error hierarchy in `src/lib/errors.ts`:
- `AppError` (base class) → general errors
- `UserError` (extends AppError) → 400-level errors
- Specific errors: `UserAlreadyExistsError`, `InvalidUserDataError`
- Prisma errors are caught and transformed to custom errors
- All errors include code, status, and optional details

#### 6. Logging Architecture
Environment-aware logging in `src/lib/logger.ts`:
- **Development**: Pretty-printed with colors via pino-pretty
- **Production**: JSON format for log aggregation tools
- Structured logging helpers:
  - `logAuth()`: Authentication events
  - `logError()`: Error tracking with context
  - `logMetrics()`: Performance metrics
  - `logSlowRequest()`: Requests >1000ms
  - `logDatabase()`: Database operation timing
- Automatic sensitive data redaction (passwords, tokens, cookies)

#### 7. GraphQL Layer
Schema-first GraphQL API using graphql-yoga, coexisting with REST under `src/graphql/`:

```
src/graphql/
  schema.graphql          ← SDL type definitions (source of truth)
  context.ts              ← extracts userId from JWT; exports requireAuth()
  resolvers/
    Query.ts              ← me, todos(categoryId, page, limit), todo(id)
    Mutation.ts           ← createTodo, updateTodo, deleteTodo
    Todo.ts               ← Todo.category nested resolver
    User.ts               ← User.todos nested resolver
  index.ts                ← createYoga() instance, mounted at /graphql
```

**Auth in GraphQL**: `buildContext` in `context.ts` reads the `Authorization: Bearer` header and calls `verify` from `hono/jwt` directly — same JWT secret and algorithm as the REST middleware. The extracted `userId` is passed to every resolver via the context argument. Use `requireAuth(ctx)` at the top of any resolver that requires a logged-in user; it throws `GraphQLError` with `code: UNAUTHENTICATED` rather than returning an HTTP 401.

**Error handling**: GraphQL always responds HTTP 200. Errors appear in the `errors[]` array with an `extensions.code` field (`UNAUTHENTICATED`, `FORBIDDEN`, `NOT_FOUND`, `BAD_REQUEST`).

**N+1 note**: The `Todo.category` resolver issues one `findUnique` per todo. This is intentional for learning purposes. A DataLoader would batch these into a single query.

### Database Schema Notes

#### Key Relationships
- **User → Todo**: One-to-many with cascade delete
- **User → Post**: One-to-many with cascade delete
- **User → Comment**: One-to-many with cascade delete
- **Category → Todo**: One-to-many with cascade delete
- **Post → Comment**: One-to-many with cascade delete

#### ID Strategy
- **User, Todo, Post, Comment**: String `@default(cuid())` - globally unique
- **Category**: Integer `@id @default(autoincrement())` - simple sequential

#### Generated Client Location
Prisma client is generated to `src/generated/` (custom output in schema: `output = "../src/generated"`). Import as `'../generated/client'` from within `src/`.

### Environment Variables Required
```bash
DATABASE_URL=postgresql://...        # PostgreSQL connection string (dev/prod)
JWT_SECRET=your_secret_key          # JWT signing secret
NODE_ENV=development|production      # Environment mode
```

For testing, create `.env.test` with a separate `DATABASE_URL`. The test runner force-applies `.env.test` in `tests/setup.ts` before any module that reads `process.env.DATABASE_URL` is imported — this is necessary because a shell-exported `DATABASE_URL` would otherwise take precedence over file-based env loading.

### Testing Strategy
Tests use Bun's built-in test runner (`bun:test`) against a real PostgreSQL test database.

**Setup files:**
- `tests/setup.ts` — preloaded via `bunfig.toml`; reads `.env.test` with `readFileSync` and writes every key into `process.env` (overriding any shell-exported vars), then runs `prisma migrate deploy` on the test DB.
- `tests/helpers/db.ts` — exports `prisma` and `truncateAndSeed()`, which truncates all tables (`RESTART IDENTITY CASCADE`) and re-creates the required default category (id = 1).
- `tests/helpers/auth.ts` — `createUser(email)`, `createAdmin(email)`, `authHeader(token)`.
- `tests/helpers/factories.ts` — `createTodo()`, `createPost()`, `createComment()`.
- `tests/helpers/app.ts` — re-exports `app` from `src/index.ts` for `app.request()` calls (no live server needed).

**Test layout:**
```
tests/unit/        # Pure-function tests — no DB required
tests/integration/ # HTTP-level tests — each file runs beforeEach(truncateAndSeed)
```

**Running tests:** `bun test` (script sets `NODE_ENV=test`; `.env.test` is applied by the preload).

## Common Development Patterns

### Adding a New Authenticated Route
1. Create route definition with `createRoute()` in router file
2. Add Zod schema for request/response validation
3. Implement handler with OpenAPI metadata
4. Use `authMiddleware` or `optionalAuth` as needed
5. Access user ID via `c.get('userId')`, role via `c.get('role')`

### Post/Comment Visibility Pattern
Post and comment read access uses `canReadPost()` from `src/lib/access.ts`:
- **Admin**: always allowed
- **Published post**: allowed for anyone
- **Draft post**: owner only

This function is shared between REST (`post.ts`, `comment.ts`) and GraphQL resolvers — add any new visibility logic there, not inline in handlers.

### Adding a GraphQL Resolver
1. Add the new field or type to `src/graphql/schema.graphql`
2. Implement the resolver function in the appropriate file under `src/graphql/resolvers/`
   - Root fields go in `Query.ts` or `Mutation.ts`
   - Type-level field resolvers (nested data) go in a file named after the type (e.g., `Todo.ts`)
3. Call `requireAuth(ctx)` at the top of any resolver that requires authentication
4. Register new type resolvers in the `resolvers` map in `src/graphql/index.ts`

### Releasing a new version
The `version:patch/minor/major` scripts handle the full release flow in one command:
1. Bumps `package.json` version
2. Runs `scripts/update-changelog.ts` — reads git commits since last tag, groups by `feat:`/`fix:`/`docs:`, prepends a new entry to `CHANGELOG.md`
3. Stages both files and creates the version commit + git tag

```bash
bun run version:patch   # 2.3.0 → 2.3.1
bun run version:minor   # 2.3.0 → 2.4.0
bun run version:major   # 2.3.0 → 3.0.0
```

`update-changelog.ts` skips `chore:` and `test:` commits — only user-facing changes appear in the changelog.

### Adding Database Operations
- Use Prisma client from `src/lib/index.ts`
- For complex operations, consider adding custom methods via Prisma client extensions
- Always handle Prisma errors (especially `P2002` for unique constraint violations)
- Use transactions for multi-step operations

### Password Hashing
Use Bun's built-in password hashing (bcrypt):
```typescript
await Bun.password.hash(password, { algorithm: 'bcrypt', cost: 10 })
await Bun.password.verify(password, hashedPassword)
```

### JWT Token Management
- Sign tokens: `await signToken(userId, role)` from `src/lib/auth.ts`
- Verify tokens: Handled automatically by middleware
- Set cookie: Use `setCookie(c, 'token', token, { httpOnly: true, ... })`

## API Documentation
- REST (Scalar UI) at `http://localhost:3001/doc`
- OpenAPI spec at `http://localhost:3001/doc/openapi.json`
- All REST routes auto-documented via Zod schemas
- GraphQL playground (GraphiQL) at `http://localhost:3001/graphql` — use the Headers panel to pass `Authorization: Bearer <token>`
- Changelog / release notes at `http://localhost:3001/release` — themed markdown page, reads `CHANGELOG.md` at request time
