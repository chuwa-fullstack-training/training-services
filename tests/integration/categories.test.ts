import { describe, it, expect, beforeEach, afterAll } from 'bun:test';
import { app } from '../helpers/app';
import { truncateAndSeed, prisma } from '../helpers/db';
import { createUser, createAdmin, authHeader } from '../helpers/auth';
import { createTodo } from '../helpers/factories';

beforeEach(async () => {
  await truncateAndSeed();
});

afterAll(async () => {
  await prisma.$disconnect();
});

// ── GET /api/categories ───────────────────────────────────────────────────────

describe('GET /api/categories', () => {
  it('lists all categories publicly without auth', async () => {
    await prisma.category.create({ data: { name: 'Work' } });
    const res = await app.request('/api/categories');
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body)).toBe(true);
    expect(body.length).toBe(2); // 'General' (seeded) + 'Work'
  });

  it('returns 403 for includeTodos=true without admin role', async () => {
    const { token } = await createUser('user@test.com');
    const res = await app.request('/api/categories?includeTodos=true', {
      headers: authHeader(token),
    });
    expect(res.status).toBe(403);
  });

  it('admin can list categories with todos included', async () => {
    const admin = await createAdmin();
    const res = await app.request('/api/categories?includeTodos=true', {
      headers: authHeader(admin.token),
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body[0]).toHaveProperty('todos');
  });
});

// ── GET /api/categories/:id ───────────────────────────────────────────────────

describe('GET /api/categories/:id', () => {
  it('returns the category by id', async () => {
    const res = await app.request('/api/categories/1');
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.id).toBe(1);
    expect(body.name).toBe('General');
  });

  it('returns null for a non-existent category', async () => {
    const res = await app.request('/api/categories/9999');
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toBeNull();
  });
});

// ── POST /api/categories ──────────────────────────────────────────────────────

describe('POST /api/categories', () => {
  it('admin can create a category', async () => {
    const admin = await createAdmin();
    const res = await app.request('/api/categories', {
      method: 'POST',
      headers: { ...authHeader(admin.token), 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'New Category' }),
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.name).toBe('New Category');
    expect(typeof body.id).toBe('number');
  });

  it('returns 403 for a regular user', async () => {
    const { token } = await createUser('user@test.com');
    const res = await app.request('/api/categories', {
      method: 'POST',
      headers: { ...authHeader(token), 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Unauthorized' }),
    });
    expect(res.status).toBe(403);
  });

  it('returns 401 without a token', async () => {
    const res = await app.request('/api/categories', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'No auth' }),
    });
    expect(res.status).toBe(401);
  });
});

// ── PUT /api/categories/:id ───────────────────────────────────────────────────

describe('PUT /api/categories/:id', () => {
  it('admin can update a category name', async () => {
    const admin = await createAdmin();
    const cat = await prisma.category.create({ data: { name: 'Old Name' } });
    const res = await app.request(`/api/categories/${cat.id}`, {
      method: 'PUT',
      headers: { ...authHeader(admin.token), 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'New Name' }),
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.name).toBe('New Name');
  });

  it('returns 404 for a non-existent category', async () => {
    const admin = await createAdmin();
    const res = await app.request('/api/categories/9999', {
      method: 'PUT',
      headers: { ...authHeader(admin.token), 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Ghost' }),
    });
    expect(res.status).toBe(404);
  });

  it('returns 403 for a non-admin user', async () => {
    const { token } = await createUser('user@test.com');
    const res = await app.request('/api/categories/1', {
      method: 'PUT',
      headers: { ...authHeader(token), 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Hijacked' }),
    });
    expect(res.status).toBe(403);
  });
});

// ── DELETE /api/categories/:id ────────────────────────────────────────────────

describe('DELETE /api/categories/:id', () => {
  it('returns 400 when attempting to delete the default category (id = 1)', async () => {
    const admin = await createAdmin();
    const res = await app.request('/api/categories/1', {
      method: 'DELETE',
      headers: authHeader(admin.token),
    });
    expect(res.status).toBe(400);
  });

  it('admin can delete a non-default category', async () => {
    const admin = await createAdmin();
    const cat = await prisma.category.create({ data: { name: 'Deletable' } });
    const res = await app.request(`/api/categories/${cat.id}`, {
      method: 'DELETE',
      headers: authHeader(admin.token),
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.id).toBe(cat.id);
  });

  it('reassigns todos to the default category on deletion', async () => {
    const admin = await createAdmin();
    const { id: userId } = await createUser('user@test.com');
    const cat = await prisma.category.create({ data: { name: 'To Delete' } });
    const todo = await createTodo(userId, cat.id);

    await app.request(`/api/categories/${cat.id}`, {
      method: 'DELETE',
      headers: authHeader(admin.token),
    });

    const reassigned = await prisma.todo.findUnique({ where: { id: todo.id } });
    expect(reassigned?.categoryId).toBe(1);
  });

  it('returns 403 for a regular user', async () => {
    const { token } = await createUser('user@test.com');
    const cat = await prisma.category.create({ data: { name: 'Protected' } });
    const res = await app.request(`/api/categories/${cat.id}`, {
      method: 'DELETE',
      headers: authHeader(token),
    });
    expect(res.status).toBe(403);
  });
});
