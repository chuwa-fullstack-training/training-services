# SQLite to PostgreSQL Migration Workflow

**Database Migration to Supabase PostgreSQL**

**Project**: Todo List API
**Current DB**: SQLite (`prisma/dev.db`)
**Target DB**: Supabase PostgreSQL with connection pooling
**Estimated Time**: 4-6 hours
**Risk Level**: Medium (data migration required)

---

## Table of Contents

1. [Prerequisites & Overview](#prerequisites--overview)
2. [Phase 1: Environment Setup](#phase-1-environment-setup-1-2-hours)
3. [Phase 2: Schema Migration](#phase-2-schema-migration-1-2-hours)
4. [Phase 3: Data Migration](#phase-3-data-migration-1-hour)
5. [Phase 4: Testing & Validation](#phase-4-testing--validation-30-60-minutes)
6. [Phase 5: Production Cutover](#phase-5-production-cutover-30-minutes)
7. [Rollback Strategy](#rollback-strategy)
8. [Common Issues & Solutions](#common-issues--solutions)

---

## Prerequisites & Overview

### Current State Analysis

**Database Schema:**

- ✅ 5 models: Category, Todo, User, Post, Comment
- ✅ Relations: One-to-many (User → Todos, Category → Todos, User → Posts, Post → Comments)
- ✅ ID Strategy: `autoincrement()` for Category, `cuid()` for all others
- ✅ Migrations: 5 existing migrations in `prisma/migrations/`
- ✅ Seed data: Users, Categories, Todos with relationships

**Key Differences: SQLite vs PostgreSQL**

| Feature               | SQLite            | PostgreSQL         | Migration Impact       |
| --------------------- | ----------------- | ------------------ | ---------------------- |
| **ID Types**          | INTEGER, TEXT     | SERIAL, UUID, TEXT | Low - Prisma handles   |
| **Autoincrement**     | `autoincrement()` | `autoincrement()`  | None - same syntax     |
| **CUID**              | TEXT              | TEXT               | None - works same      |
| **Timestamps**        | TEXT/INTEGER      | TIMESTAMP          | Low - Prisma converts  |
| **Cascading Deletes** | Limited           | Full support       | Medium - need to add   |
| **Indexes**           | Basic             | Advanced           | Low - optional upgrade |
| **Full-text Search**  | Limited           | Built-in           | Optional enhancement   |
| **JSON Support**      | Limited           | Native JSONB       | Optional enhancement   |

### Supabase Connection Details

**Connection Types:**

1. **Pooled Connection (DATABASE_URL)**: For application queries
   - Uses PgBouncer for connection pooling
   - Port: 6543
   - Best for: High-concurrency applications

2. **Direct Connection (DIRECT_URL)**: For migrations & admin tasks
   - Direct PostgreSQL connection
   - Port: 5432
   - Best for: Schema migrations, admin operations

**Connection String Format:**

```bash
# Pooled (for app runtime)
DATABASE_URL="postgresql://postgres.mgqvbyyazcbuxqeoqyzv:[YOUR-PASSWORD]@aws-0-us-west-2.pooler.supabase.com:6543/postgres?pgbouncer=true"

# Direct (for migrations)
DIRECT_URL="postgresql://postgres.mgqvbyyazcbuxqeoqyzv:[YOUR-PASSWORD]@aws-0-us-west-2.pooler.supabase.com:5432/postgres"
```

### Migration Strategy

**Approach**: Blue-Green Deployment

- Parallel operation during testing
- Zero-downtime cutover
- Easy rollback capability

**Data Migration Method**: Export-Transform-Import

- Export SQLite data to JSON
- Transform if needed
- Import to PostgreSQL via Prisma

---

## Phase 1: Environment Setup (1-2 hours)

### Step 1.1: Backup Current SQLite Database

```bash
# Create backup directory
mkdir -p backups/$(date +%Y%m%d)

# Backup SQLite database
cp prisma/dev.db backups/$(date +%Y%m%d)/dev.db.backup

# Backup migrations
cp -r prisma/migrations backups/$(date +%Y%m%d)/migrations.backup

# Verify backup
ls -lh backups/$(date +%Y%m%d)/
```

**Success Criteria**:

- ✅ SQLite database backed up
- ✅ Migrations directory backed up
- ✅ Backup size matches original (~64KB)

### Step 1.2: Export Current Data

Create data export script:

**File**: `scripts/export-sqlite-data.ts`

```typescript
import { PrismaClient } from '@prisma/client';
import { writeFile } from 'fs/promises';

const prisma = new PrismaClient();

async function exportData() {
  console.log('📦 Exporting SQLite data...');

  const data = {
    users: await prisma.user.findMany({
      select: {
        id: true,
        email: true,
        password: true,
      },
    }),
    categories: await prisma.category.findMany(),
    todos: await prisma.todo.findMany(),
    posts: await prisma.post.findMany(),
    comments: await prisma.comment.findMany(),
  };

  const exportPath = `backups/${new Date().toISOString().split('T')[0]}/sqlite-data.json`;
  await writeFile(exportPath, JSON.stringify(data, null, 2));

  console.log('✅ Data exported successfully');
  console.log('📊 Export Summary:');
  console.log(`   Users: ${data.users.length}`);
  console.log(`   Categories: ${data.categories.length}`);
  console.log(`   Todos: ${data.todos.length}`);
  console.log(`   Posts: ${data.posts.length}`);
  console.log(`   Comments: ${data.comments.length}`);
  console.log(`   Location: ${exportPath}`);

  return data;
}

exportData()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
```

**Run export:**

```bash
bun run scripts/export-sqlite-data.ts
```

**Success Criteria**:

- ✅ JSON file created in `backups/YYYY-MM-DD/sqlite-data.json`
- ✅ All record counts displayed
- ✅ File size reasonable (typically < 1MB for small datasets)

### Step 1.3: Configure Environment Variables

**File**: `.env`

```bash
# IMPORTANT: Keep old DATABASE_URL as backup
# DATABASE_URL="file:./prisma/dev.db"  # OLD - SQLite (commented for safety)

# Supabase PostgreSQL connections
DATABASE_URL="postgresql://postgres.mgqvbyyazcbuxqeoqyzv:[YOUR-PASSWORD]@aws-0-us-west-2.pooler.supabase.com:6543/postgres?pgbouncer=true"
DIRECT_URL="postgresql://postgres.mgqvbyyazcbuxqeoqyzv:[YOUR-PASSWORD]@aws-0-us-west-2.pooler.supabase.com:5432/postgres"

# JWT Secret (unchanged)
JWT_SECRET="your-jwt-secret-here"
```

**File**: `.env.example`

```bash
# Database connections
DATABASE_URL="postgresql://postgres.PROJECT:[YOUR-PASSWORD]@aws-0-REGION.pooler.supabase.com:6543/postgres?pgbouncer=true"
DIRECT_URL="postgresql://postgres.PROJECT:[YOUR-PASSWORD]@aws-0-REGION.pooler.supabase.com:5432/postgres"

# Authentication
JWT_SECRET="your-secret-key-here"
```

**Security Checklist**:

- [ ] `.env` is in `.gitignore`
- [ ] Password is from Supabase dashboard (not placeholder)
- [ ] Connection strings tested with `psql` or database client
- [ ] `.env.example` has no real credentials

### Step 1.4: Update Prisma Schema

**File**: `prisma/schema.prisma`

```prisma
// This is your Prisma schema file,
// learn more about it in the docs: https://pris.ly/d/prisma-schema

generator client {
  provider = "prisma-client-js"
  seed     = "./seed.ts"
}

datasource db {
  provider  = "postgresql"  // Changed from "sqlite"
  url       = env("DATABASE_URL")
  directUrl = env("DIRECT_URL")  // Added for migrations
}

model Category {
  id    Int    @id @default(autoincrement())
  name  String
  todos Todo[]
}

model Todo {
  id         String   @id @default(cuid())
  title      String
  completed  Boolean  @default(false)
  category   Category @relation(fields: [categoryId], references: [id], onDelete: Cascade)  // Added onDelete
  categoryId Int
  user       User?    @relation(fields: [userId], references: [id], onDelete: Cascade)  // Added onDelete
  userId     String?
  createdAt  DateTime @default(now())
  updatedAt  DateTime @default(now()) @updatedAt
}

model User {
  id       String    @id @default(cuid())
  email    String    @unique
  password String
  todos    Todo[]
  posts    Post[]
  comment  Comment[]
}

model Post {
  id        String    @id @default(cuid())
  title     String
  content   String
  published Boolean   @default(false)
  author    User      @relation(fields: [authorId], references: [id], onDelete: Cascade)  // Added onDelete
  authorId  String
  comment   Comment[]
  createdAt DateTime  @default(now())
  updatedAt DateTime  @default(now()) @updatedAt
}

model Comment {
  id        String   @id @default(cuid())
  content   String
  post      Post     @relation(fields: [postId], references: [id], onDelete: Cascade)  // Added onDelete
  postId    String
  author    User     @relation(fields: [authorId], references: [id], onDelete: Cascade)  // Added onDelete
  authorId  String
  createdAt DateTime @default(now())
  updatedAt DateTime @default(now()) @updatedAt
}
```

**Key Changes**:

1. ✅ `provider = "postgresql"` (was "sqlite")
2. ✅ Added `directUrl = env("DIRECT_URL")` for migrations
3. ✅ Added `onDelete: Cascade` to all foreign key relations
4. ✅ No changes to ID strategies (autoincrement and cuid work in PostgreSQL)

### Step 1.5: Test Database Connection

```bash
# Test connection with Prisma
bunx prisma db execute --stdin <<< "SELECT version();"

# Expected output: PostgreSQL version info
```

If connection fails:

- Verify password in `.env`
- Check Supabase project is running
- Verify network/firewall allows connections
- Try direct connection (port 5432) first

**Success Criteria**:

- ✅ PostgreSQL version displayed
- ✅ No connection errors
- ✅ Prisma recognizes PostgreSQL provider

---

## Phase 2: Schema Migration (1-2 hours)

### Step 2.1: Reset Migration History

**IMPORTANT**: This creates a clean migration history for PostgreSQL.

```bash
# Remove SQLite migration history (keep as backup)
mv prisma/migrations prisma/migrations.sqlite.backup

# Create migrations directory
mkdir -p prisma/migrations
```

### Step 2.2: Create Initial PostgreSQL Migration

```bash
# Generate initial migration for PostgreSQL
bunx prisma migrate dev --name init_postgresql

# This will:
# 1. Create migration SQL in prisma/migrations/
# 2. Apply migration to Supabase PostgreSQL
# 3. Generate Prisma Client for PostgreSQL
```

**Expected Output**:

```
Prisma schema loaded from prisma/schema.prisma
Datasource "db": PostgreSQL database "postgres"

PostgreSQL database postgres created at aws-0-us-west-2.pooler.supabase.com:5432

Applying migration `20250102_init_postgresql`

The following migration(s) have been created and applied from new schema changes:

migrations/
  └─ 20250102_init_postgresql/
    └─ migration.sql

Your database is now in sync with your schema.

✔ Generated Prisma Client (v6.x.x) to ./node_modules/@prisma/client
```

### Step 2.3: Verify Schema Creation

```bash
# Check tables were created
bunx prisma db execute --stdin <<< "
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
ORDER BY table_name;
"
```

**Expected Tables**:

- Category
- Comment
- Post
- Todo
- User
- \_prisma_migrations (internal)

### Step 2.4: Review Migration SQL

**File**: `prisma/migrations/YYYYMMDD_init_postgresql/migration.sql`

Review the generated SQL to ensure:

- ✅ All tables created
- ✅ Foreign key constraints added
- ✅ Indexes on foreign keys
- ✅ CASCADE delete rules applied
- ✅ Default values preserved

**Success Criteria**:

- ✅ Migration applied successfully
- ✅ All 5 tables exist in PostgreSQL
- ✅ Foreign key constraints visible
- ✅ Prisma Client regenerated for PostgreSQL

---

## Phase 3: Data Migration (1 hour)

### Step 3.1: Create Import Script

**File**: `scripts/import-to-postgresql.ts`

```typescript
import { PrismaClient } from '@prisma/client';
import { readFile } from 'fs/promises';

const prisma = new PrismaClient();

async function importData() {
  console.log('📥 Importing data to PostgreSQL...');

  // Read exported data
  const dataPath =
    process.argv[2] || `backups/${new Date().toISOString().split('T')[0]}/sqlite-data.json`;
  const rawData = await readFile(dataPath, 'utf-8');
  const data = JSON.parse(rawData);

  console.log('📊 Data to import:');
  console.log(`   Users: ${data.users.length}`);
  console.log(`   Categories: ${data.categories.length}`);
  console.log(`   Todos: ${data.todos.length}`);
  console.log(`   Posts: ${data.posts.length}`);
  console.log(`   Comments: ${data.comments.length}`);

  // Use transaction for atomicity
  await prisma.$transaction(async (tx) => {
    console.log('\n🔄 Step 1: Importing Users...');
    for (const user of data.users) {
      await tx.user.create({
        data: {
          id: user.id,
          email: user.email,
          password: user.password,
        },
      });
    }
    console.log(`   ✅ ${data.users.length} users imported`);

    console.log('\n🔄 Step 2: Importing Categories...');
    for (const category of data.categories) {
      await tx.category.create({
        data: {
          id: category.id,
          name: category.name,
        },
      });
    }
    console.log(`   ✅ ${data.categories.length} categories imported`);

    console.log('\n🔄 Step 3: Importing Todos...');
    for (const todo of data.todos) {
      await tx.todo.create({
        data: {
          id: todo.id,
          title: todo.title,
          completed: todo.completed,
          categoryId: todo.categoryId,
          userId: todo.userId,
          createdAt: new Date(todo.createdAt),
          updatedAt: new Date(todo.updatedAt),
        },
      });
    }
    console.log(`   ✅ ${data.todos.length} todos imported`);

    console.log('\n🔄 Step 4: Importing Posts...');
    for (const post of data.posts) {
      await tx.post.create({
        data: {
          id: post.id,
          title: post.title,
          content: post.content,
          published: post.published,
          authorId: post.authorId,
          createdAt: new Date(post.createdAt),
          updatedAt: new Date(post.updatedAt),
        },
      });
    }
    console.log(`   ✅ ${data.posts.length} posts imported`);

    console.log('\n🔄 Step 5: Importing Comments...');
    for (const comment of data.comments) {
      await tx.comment.create({
        data: {
          id: comment.id,
          content: comment.content,
          postId: comment.postId,
          authorId: comment.authorId,
          createdAt: new Date(comment.createdAt),
          updatedAt: new Date(comment.updatedAt),
        },
      });
    }
    console.log(`   ✅ ${data.comments.length} comments imported`);
  });

  console.log('\n✅ Data import completed successfully!');
}

importData()
  .catch((error) => {
    console.error('❌ Import failed:', error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
```

### Step 3.2: Run Data Import

```bash
# Import data
bun run scripts/import-to-postgresql.ts

# Or specify custom export file
bun run scripts/import-to-postgresql.ts backups/20250102/sqlite-data.json
```

### Step 3.3: Verify Data Integrity

```bash
# Check record counts
bunx prisma db execute --stdin <<< "
SELECT
  'users' as table_name, COUNT(*) as count FROM \"User\"
UNION ALL
SELECT 'categories', COUNT(*) FROM \"Category\"
UNION ALL
SELECT 'todos', COUNT(*) FROM \"Todo\"
UNION ALL
SELECT 'posts', COUNT(*) FROM \"Post\"
UNION ALL
SELECT 'comments', COUNT(*) FROM \"Comment\";
"
```

**Verify counts match SQLite export:**

- Users: [expected count]
- Categories: [expected count]
- Todos: [expected count]
- Posts: [expected count]
- Comments: [expected count]

### Step 3.4: Test Relationships

```bash
# Test user → todos relationship
bunx prisma db execute --stdin <<< "
SELECT u.email, COUNT(t.id) as todo_count
FROM \"User\" u
LEFT JOIN \"Todo\" t ON u.id = t.\"userId\"
GROUP BY u.email
ORDER BY todo_count DESC;
"
```

**Success Criteria**:

- ✅ All data imported without errors
- ✅ Record counts match SQLite
- ✅ Relationships intact (foreign keys work)
- ✅ No orphaned records

---

## Phase 4: Testing & Validation (30-60 minutes)

### Step 4.1: Update Application Configuration

**No code changes needed!** Prisma Client adapts automatically.

Verify environment:

```bash
# Check DATABASE_URL points to PostgreSQL
grep DATABASE_URL .env

# Expected: postgresql://...
```

### Step 4.2: Regenerate Prisma Client

```bash
# Regenerate client for PostgreSQL
bunx prisma generate

# Restart development server
bun run dev:hono  # Or dev for Elysia
```

### Step 4.3: API Testing Checklist

**Authentication Tests:**

```bash
# Set base URL
API_URL="http://localhost:3001"

# 1. Test login with existing user
curl -X POST $API_URL/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"aaron@test.com","password":"password"}'

# Expected: Token returned, cookie set

# 2. Save token
TOKEN="<paste-token-here>"

# 3. Test protected endpoint
curl $API_URL/api/users/me \
  -H "Authorization: Bearer $TOKEN"

# Expected: User profile with todos
```

**Todo CRUD Tests:**

```bash
# List todos
curl $API_URL/api/todos \
  -H "Authorization: Bearer $TOKEN"

# Expected: Existing todos from migration

# Filter by category
curl "$API_URL/api/todos?categoryId=2" \
  -H "Authorization: Bearer $TOKEN"

# Create new todo
curl -X POST $API_URL/api/todos \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"title":"PostgreSQL Migration Test","categoryId":1}'

# Update todo
TODO_ID="<paste-id>"
curl -X PUT $API_URL/api/todos/$TODO_ID \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"completed":true}'

# Delete todo
curl -X DELETE $API_URL/api/todos/$TODO_ID \
  -H "Authorization: Bearer $TOKEN"
```

**Category Tests:**

```bash
# List categories
curl $API_URL/api/categories

# Expected: All categories from seed data

# Get specific category
curl $API_URL/api/categories/1

# Expected: Category with associated todos
```

**User Tests:**

```bash
# Get current user
curl $API_URL/api/users/me \
  -H "Authorization: Bearer $TOKEN"

# List all users
curl $API_URL/api/users \
  -H "Authorization: Bearer $TOKEN"
```

### Step 4.4: Performance Testing

```bash
# Test query performance
bunx prisma db execute --stdin <<< "
EXPLAIN ANALYZE
SELECT t.*, c.name as category_name, u.email
FROM \"Todo\" t
LEFT JOIN \"Category\" c ON t.\"categoryId\" = c.id
LEFT JOIN \"User\" u ON t.\"userId\" = u.id
WHERE u.email = 'aaron@test.com';
"
```

**Verify:**

- ✅ Query execution time < 50ms
- ✅ Index usage on foreign keys
- ✅ No sequential scans on large tables

### Step 4.5: Connection Pool Testing

Test with concurrent requests:

**File**: `scripts/test-concurrency.ts`

```typescript
async function testConcurrency() {
  const API_URL = 'http://localhost:3001';
  const TOKEN = process.env.TEST_TOKEN;

  const requests = Array.from({ length: 50 }, (_, i) =>
    fetch(`${API_URL}/api/todos`, {
      headers: { Authorization: `Bearer ${TOKEN}` },
    })
  );

  console.time('50 concurrent requests');
  const responses = await Promise.all(requests);
  console.timeEnd('50 concurrent requests');

  const successCount = responses.filter((r) => r.ok).length;
  console.log(`✅ Success: ${successCount}/50`);
  console.log(`❌ Failed: ${50 - successCount}/50`);
}

testConcurrency();
```

```bash
# Run concurrency test
TEST_TOKEN="your-token" bun run scripts/test-concurrency.ts
```

**Expected**:

- ✅ All 50 requests succeed
- ✅ Total time < 2 seconds
- ✅ No connection pool exhaustion errors

### Step 4.6: Validation Checklist

**Data Integrity:**

- [ ] All users can log in with original passwords
- [ ] User-todo relationships preserved
- [ ] Category-todo relationships preserved
- [ ] Timestamps match original data
- [ ] IDs (CUIDs) preserved correctly

**Functionality:**

- [ ] User signup creates new users
- [ ] User login returns valid JWT
- [ ] Auth middleware validates tokens
- [ ] Todo CRUD operations work
- [ ] Ownership validation prevents cross-user access
- [ ] Category filtering works
- [ ] Date formatting correct

**Performance:**

- [ ] API response times < 100ms
- [ ] Query execution < 50ms
- [ ] Connection pooling handles concurrency
- [ ] No memory leaks after sustained use

**Documentation:**

- [ ] Swagger UI works (`/doc`)
- [ ] OpenAPI spec generates (`/doc/openapi.json`)
- [ ] All endpoints documented

---

## Phase 5: Production Cutover (30 minutes)

### Step 5.1: Final Data Sync (if needed)

If SQLite was still in use during testing:

```bash
# 1. Stop accepting writes to SQLite
# 2. Export latest SQLite data
bun run scripts/export-sqlite-data.ts

# 3. Clear PostgreSQL data
bunx prisma migrate reset --force

# 4. Re-import fresh data
bun run scripts/import-to-postgresql.ts

# 5. Verify counts match
```

### Step 5.2: Update Production Environment

```bash
# Production .env should have:
DATABASE_URL="postgresql://postgres.PROJECT:[PASSWORD]@aws-0-REGION.pooler.supabase.com:6543/postgres?pgbouncer=true"
DIRECT_URL="postgresql://postgres.PROJECT:[PASSWORD]@aws-0-REGION.pooler.supabase.com:5432/postgres"
JWT_SECRET="production-secret"
NODE_ENV="production"
```

### Step 5.3: Deploy Application

```bash
# Build for production
bun run build

# Start production server
bun run start:hono  # Or start for Elysia
```

### Step 5.4: Monitor Initial Traffic

**Key Metrics to Watch:**

- Response times
- Error rates
- Database connection pool usage
- Memory usage
- CPU usage

**Supabase Dashboard Monitoring:**

1. Go to Supabase project dashboard
2. Navigate to "Database" → "Connection pooling"
3. Monitor active connections
4. Check for connection pool exhaustion

### Step 5.5: Cleanup Old SQLite Files

**After confirming PostgreSQL is stable (recommended: 1 week):**

```bash
# Archive SQLite database
mv prisma/dev.db backups/dev.db.final.$(date +%Y%m%d)

# Keep SQLite backups for 30 days minimum
# Then delete if no issues:
# rm -rf backups/dev.db.*
```

**Success Criteria**:

- ✅ Application running on PostgreSQL
- ✅ No errors in production logs
- ✅ Response times acceptable
- ✅ Connection pool healthy
- ✅ SQLite backed up and archived

---

## Rollback Strategy

### Quick Rollback (< 5 minutes)

If critical issues discovered immediately:

```bash
# 1. Stop application
# (Ctrl+C or kill process)

# 2. Restore SQLite configuration
# Edit .env:
DATABASE_URL="file:./prisma/dev.db"
# (Remove or comment PostgreSQL URLs)

# 3. Restore Prisma schema
git checkout prisma/schema.prisma
# Or manually change provider back to "sqlite"

# 4. Regenerate Prisma Client
bunx prisma generate

# 5. Restart application
bun run dev
```

### Full Rollback with Data Restore (< 30 minutes)

If data corruption or major issues:

```bash
# 1. Restore SQLite database
cp backups/$(ls -t backups/ | head -1)/dev.db.backup prisma/dev.db

# 2. Restore migrations
rm -rf prisma/migrations
cp -r backups/$(ls -t backups/ | head -1)/migrations.backup prisma/migrations

# 3. Restore schema
git checkout prisma/schema.prisma

# 4. Update .env
DATABASE_URL="file:./prisma/dev.db"

# 5. Regenerate client
bunx prisma generate

# 6. Verify data
bunx prisma studio

# 7. Restart app
bun run dev
```

**Rollback Decision Criteria:**

Roll back if:

- ❌ Data corruption detected
- ❌ Critical functionality broken
- ❌ Performance degradation >2x
- ❌ Connection pool exhaustion
- ❌ Frequent database errors

Continue troubleshooting if:

- ⚠️ Minor performance issues
- ⚠️ Non-critical errors
- ⚠️ Configuration tweaks needed

---

## Common Issues & Solutions

### Issue 1: Connection Pool Exhausted

**Symptoms:**

```
Error: P1001: Can't reach database server at `aws-0-us-west-2.pooler.supabase.com:6543`
```

**Cause**: Too many connections, not releasing properly

**Solution:**

```typescript
// Ensure Prisma Client is singleton
// src/lib/index.ts
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma = globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;
```

### Issue 2: Migration Fails with "relation already exists"

**Cause**: Schema already exists from previous attempt

**Solution:**

```bash
# Reset database completely
bunx prisma migrate reset --force

# Re-run migration
bunx prisma migrate dev --name init_postgresql
```

### Issue 3: Slow Query Performance

**Cause**: Missing indexes on frequently queried columns

**Solution:**

```prisma
// Add indexes to schema.prisma
model Todo {
  // ... existing fields ...

  @@index([userId])
  @@index([categoryId])
  @@index([createdAt])
}
```

```bash
# Create migration for indexes
bunx prisma migrate dev --name add_performance_indexes
```

### Issue 4: "Password authentication failed"

**Cause**: Incorrect password in `.env`

**Solution:**

1. Go to Supabase Dashboard
2. Navigate to "Settings" → "Database"
3. Reset database password if needed
4. Update `.env` with correct password
5. Test connection:

```bash
bunx prisma db execute --stdin <<< "SELECT 1;"
```

### Issue 5: Data Import Fails with Foreign Key Violations

**Cause**: Importing in wrong order (child before parent)

**Solution:**
Import order is critical:

1. Users (no dependencies)
2. Categories (no dependencies)
3. Todos (depends on Users, Categories)
4. Posts (depends on Users)
5. Comments (depends on Posts, Users)

If still failing, temporarily disable constraints:

```typescript
// At start of transaction
await tx.$executeRaw`SET CONSTRAINTS ALL DEFERRED;`;

// ... import data ...

// Constraints re-enabled automatically at transaction end
```

### Issue 6: CUID Collision

**Symptoms:**

```
Unique constraint failed on the fields: (`id`)
```

**Cause**: Extremely rare, but CUIDs can collide

**Solution:**

```typescript
// Retry with new CUID
import { createId } from '@paralleldrive/cuid2';

// In import script
const newId = existingId; // Try original first
try {
  await tx.todo.create({ data: { id: newId, ... } });
} catch (error) {
  if (error.code === 'P2002') {
    // Collision - generate new ID
    const retryId = createId();
    await tx.todo.create({ data: { id: retryId, ... } });
  }
}
```

---

## PostgreSQL-Specific Optimizations (Optional)

### Add Full-Text Search

```prisma
model Todo {
  // ... existing fields ...

  @@index([title], type: Gin)  // PostgreSQL GIN index for full-text search
}
```

### Add Row-Level Security (RLS)

Enable via Supabase Dashboard:

1. Navigate to "Database" → "Policies"
2. Create policies for each table
3. Enable RLS on tables

Example policy:

```sql
-- Users can only see their own todos
CREATE POLICY "Users see own todos"
ON "Todo"
FOR SELECT
USING (auth.uid() = "userId");
```

### Enable Connection Pooling Optimization

**File**: `prisma/schema.prisma`

```prisma
datasource db {
  provider  = "postgresql"
  url       = env("DATABASE_URL")
  directUrl = env("DIRECT_URL")

  // Optional: Tune connection pool
  // pgbouncer = true  // Already in connection string
}
```

---

## Migration Completion Checklist

### Pre-Migration

- [ ] SQLite database backed up
- [ ] Migrations backed up
- [ ] Data exported to JSON
- [ ] Supabase project created
- [ ] Connection strings obtained

### Schema Migration

- [ ] Prisma schema updated to PostgreSQL
- [ ] `directUrl` added for migrations
- [ ] `onDelete: Cascade` added to relations
- [ ] Initial migration created
- [ ] All tables exist in PostgreSQL
- [ ] Foreign keys and indexes created

### Data Migration

- [ ] Import script created
- [ ] Data imported successfully
- [ ] Record counts verified
- [ ] Relationships tested
- [ ] No orphaned records

### Testing

- [ ] Prisma Client regenerated
- [ ] Application connects to PostgreSQL
- [ ] Authentication works
- [ ] CRUD operations work
- [ ] Ownership validation works
- [ ] API documentation works
- [ ] Performance acceptable
- [ ] Concurrent requests handled

### Production

- [ ] Production environment configured
- [ ] Application deployed
- [ ] Monitoring enabled
- [ ] Error rates normal
- [ ] Performance metrics acceptable
- [ ] Backup strategy in place

### Cleanup

- [ ] SQLite files archived
- [ ] Migration scripts saved
- [ ] Documentation updated
- [ ] Team notified

---

## Post-Migration Recommendations

### 1. Database Backups

Supabase provides automatic backups, but consider:

- Daily backups via `pg_dump`
- Point-in-time recovery (PITR) enabled
- Backup retention policy (30 days minimum)

### 2. Monitoring

Set up alerts for:

- Connection pool usage >80%
- Query execution time >500ms
- Error rate >1%
- Database CPU >70%

### 3. Performance Tuning

After 1 week of production traffic:

- Review slow query logs
- Add indexes where needed
- Optimize frequently-run queries
- Consider materialized views for reporting

### 4. Security Hardening

- Enable Row-Level Security (RLS)
- Set up database roles
- Implement IP whitelisting
- Enable SSL certificate verification
- Rotate database password quarterly

---

## Success Metrics

Migration is successful when:

1. ✅ **100% Data Integrity**: All records migrated correctly
2. ✅ **Zero Downtime**: Application remains available
3. ✅ **Performance Maintained**: Response times ≤ SQLite baseline
4. ✅ **No Regressions**: All features work identically
5. ✅ **Scalability Ready**: Connection pooling handles load
6. ✅ **Monitoring Active**: Metrics tracked and alerts configured
7. ✅ **Rollback Tested**: Can return to SQLite if needed

---

**Estimated Total Timeline**: 4-6 hours for complete migration

**Recommended Schedule**:

- **Day 1 (2 hours)**: Phase 1 - Environment setup and data export
- **Day 2 (2 hours)**: Phase 2 - Schema migration
- **Day 3 (1 hour)**: Phase 3 - Data import
- **Day 4 (1 hour)**: Phase 4 - Testing and validation
- **Day 5 (1 hour)**: Phase 5 - Production cutover (during low-traffic period)

---

**Migration workflow complete. Ready for execution.**
