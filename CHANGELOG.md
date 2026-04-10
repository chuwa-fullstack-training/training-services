# Changelog

All notable changes to this project will be documented in this file.
Format follows [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

## [2.3.0] - 2026-04-09

### Added
- Schema-first GraphQL API using graphql-yoga, coexisting with REST at `/graphql`
- GraphiQL playground at `/graphql` with JWT auth support via Headers panel
- GraphQL queries: `me`, `todos` (paginated + category filter), `todo(id)`
- GraphQL mutations: `login`, `signup`, `createTodo`, `updateTodo`, `deleteTodo`
- Nested resolvers for `Todo.category` and `User.todos`
- Reuses existing JWT auth logic via GraphQL context

## [2.2.2] - 2026-04-09

### Added
- Scalar UI as API documentation interface at `/doc` (replaces Swagger UI)

## [2.2.1] - 2026-04-09

### Added
- Display `updatedAt` timestamp on todo items
- Sort todos by `updatedAt` in todo list

## [2.2.0] - 2026-04-09

### Added
- Frontend todo app served at `/app`

## [2.1.2] - 2026-04-09

### Added
- Create, update, and delete category APIs (admin only)

## [2.1.1] - 2026-04-09

### Changed
- Updated README with RBAC documentation, pagination guide, and ER diagram

## [2.1.0] - 2026-04-09

### Added
- Pagination support for `GET /api/todos` (`page`, `limit` query params; default page=1, limit=10, max=100)
- Role-based access control with `ADMIN` and `USER` roles encoded in JWT

## [2.0.1] - 2026-04-09

### Fixed
- JWT algorithm option and Swagger Bearer security scheme
- Hostname output and logger defaults
- Prisma generated client path

## [2.0.0] - 2026-04-09

### Added
- `X-API-Version` response header on all requests
- `GET /version` endpoint
- Version bump scripts (`version:patch`, `version:minor`, `version:major`)
- JWT authentication with message handler

### Changed
- Migrated database from SQLite to PostgreSQL with Prisma adapter
- Migrated framework from Elysia to Hono

### Fixed
- Development documentation and configuration
