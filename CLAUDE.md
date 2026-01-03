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

# Run tests
bun test

# Type checking
bunx --bun tsc --noEmit

# Code formatting
prettier --write .
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
Prisma client is generated to `prisma/generated/client` (custom output location)

### Environment Variables Required
```bash
DATABASE_URL=postgresql://...        # PostgreSQL connection string
JWT_SECRET=your_secret_key          # JWT signing secret
NODE_ENV=development|production      # Environment mode
```

### Testing Strategy
- Tests use Bun's built-in test runner
- No separate test configuration needed
- Run with `bun test`

## Common Development Patterns

### Adding a New Authenticated Route
1. Create route definition with `createRoute()` in router file
2. Add Zod schema for request/response validation
3. Implement handler with OpenAPI metadata
4. Use `authMiddleware` or `optionalAuth` as needed
5. Access user ID via `c.get('userId')`

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
- Sign tokens: `await signToken(userId)` from `src/lib/auth.ts`
- Verify tokens: Handled automatically by middleware
- Set cookie: Use `setCookie(c, 'token', token, { httpOnly: true, ... })`

## API Documentation
- Swagger UI available at `http://localhost:3001/doc`
- OpenAPI spec at `http://localhost:3001/doc/openapi.json`
- All routes auto-documented via Zod schemas
