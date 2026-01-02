# Todo List API - Hono Framework

A production-ready Todo List API built with Hono framework, Prisma ORM, and PostgreSQL.

## Features

- **Authentication**: JWT-based authentication with HttpOnly cookies
- **Database**: PostgreSQL with Prisma ORM
- **Rate Limiting**: Three-tier rate limiting (auth, public, authenticated endpoints)
- **Logging**: Structured logging with Pino (development and production modes)
- **API Documentation**: OpenAPI/Swagger documentation
- **Security**: Input validation, sensitive data redaction, secure defaults

## Tech Stack

- **Runtime**: Bun
- **Framework**: Hono
- **Database**: PostgreSQL (Prisma-hosted)
- **ORM**: Prisma
- **Authentication**: JWT
- **Logging**: Pino with hono-pino
- **Rate Limiting**: hono-rate-limiter

## Getting Started

### Prerequisites

- Bun runtime installed
- PostgreSQL database (Prisma-hosted or self-hosted)

### Installation

```bash
bun install
```

### Environment Setup

Create a `.env` file with the following variables:

```bash
DATABASE_URL=your_postgresql_connection_string
JWT_SECRET=your_secret_key
NODE_ENV=development
```

### Database Setup

Run Prisma migrations:

```bash
bunx prisma migrate dev
```

Seed the database:

```bash
bunx prisma db seed
```

## Development

Start the development server with hot-reload:

```bash
bun run dev
```

The API will be available at `http://localhost:3001`

## API Documentation

Interactive API documentation (Swagger UI) is available at:

```
http://localhost:3001/doc
```

## API Endpoints

### Authentication

- `POST /api/auth/signup` - Create new user account
- `POST /api/auth/login` - Login and receive JWT token

### Users

- `GET /api/users` - List all users (authenticated)
- `GET /api/users/me` - Get current user profile (authenticated)
- `GET /api/users/{id}` - Get user by ID (authenticated, own profile only)

### Todos

- `GET /api/todos` - List user's todos (authenticated)
- `GET /api/todos?categoryId={id}` - Filter todos by category (authenticated)
- `GET /api/todos/{id}` - Get todo by ID (authenticated)
- `POST /api/todos` - Create new todo (authenticated)
- `PUT /api/todos/{id}` - Update todo (authenticated)
- `DELETE /api/todos/{id}` - Delete todo (authenticated)

### Categories

- `GET /api/categories` - List all categories (public)
- `GET /api/categories/{id}` - Get category by ID (public)

## Rate Limiting

The API implements three-tier rate limiting:

- **Auth endpoints** (`/api/auth/*`): 100 requests per 15 minutes
- **Public endpoints** (`/api/categories*`): 500 requests per 15 minutes
- **Authenticated endpoints**: 1000 requests per 15 minutes per user

## Logging

Structured logging with environment-aware configuration:

- **Development**: Pretty-printed colored logs with full debug information
- **Production**: JSON-formatted logs optimized for aggregation tools (ELK, Datadog, CloudWatch)

Features:

- Request/response correlation with UUIDs
- Authentication event tracking
- Error logging with stack traces
- Slow request detection (>1000ms)
- Sensitive data redaction (passwords, tokens, cookies)

## Production Deployment

### Required Environment Variables

```bash
NODE_ENV=production
DATABASE_URL=your_postgresql_connection_string
JWT_SECRET=your_secret_key
```

### Optional Enhancements

- **Redis**: Configure Redis for distributed rate limiting
- **Log Aggregation**: Set up ELK Stack, Datadog, or CloudWatch
- **Monitoring**: Configure alerts for errors, slow requests, rate limit hits
- **Log Rotation**: Implement log rotation for file-based logging

See `RATE_LIMITING_AND_LOGGING_IMPLEMENTATION.md` for detailed production deployment guide.

## Documentation

- `MIGRATION_FINAL_REPORT.md` - PostgreSQL migration completion report
- `RATE_LIMITING_AND_LOGGING_IMPLEMENTATION.md` - Rate limiting and logging implementation guide
- `AUTH_IMPLEMENTATION.md` - Authentication system documentation

## Project Structure

```
.
├── prisma/
│   ├── schema.prisma       # Database schema
│   ├── seed.ts            # Database seeding
│   └── migrations/        # Migration history
├── src/
│   ├── index.hono.ts      # Main application entry
│   ├── hono-routers/      # API route handlers
│   │   ├── category.ts
│   │   ├── todo.ts
│   │   └── user.ts
│   └── lib/               # Shared utilities
│       ├── auth.hono.ts   # JWT authentication
│       ├── logger.hono.ts # Logging configuration
│       ├── rate-limit.hono.ts # Rate limiting
│       ├── errors.ts      # Custom error classes
│       ├── message.hono.ts # Response formatting
│       └── index.ts       # Prisma client
└── docs/                  # Additional documentation
```

## License

This project is for educational purposes.
