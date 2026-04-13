import { describe, it, expect, beforeEach, afterAll } from 'bun:test';
import { app } from '../helpers/app';
import { truncateAndSeed, prisma } from '../helpers/db';
import { createUser, authHeader } from '../helpers/auth';
import { createTodo } from '../helpers/factories';

beforeEach(async () => {
  await truncateAndSeed();
});

afterAll(async () => {
  await prisma.$disconnect();
});

// ── GET /api/todos ────────────────────────────────────────────────────────────

describe('GET /api/todos', () => {
  it('returns 401 without a token', async () => {
    const res = await app.request('/api/todos');
    expect(res.status).toBe(401);
  });

  it('returns an empty list for a new user', async () => {
    const { token } = await createUser('user@test.com');
    const res = await app.request('/api/todos', { headers: authHeader(token) });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data).toEqual([]);
    expect(body.pagination.total).toBe(0);
  });

  it("returns only the authenticated user's todos", async () => {
    const { id: userId, token } = await createUser('user@test.com');
    const { id: otherId } = await createUser('other@test.com');
    await createTodo(userId);
    await createTodo(otherId);
    const res = await app.request('/api/todos', { headers: authHeader(token) });
    const body = await res.json();
    expect(body.data.length).toBe(1);
    expect(body.pagination.total).toBe(1);
  });

  it('paginates results with page and limit query params', async () => {
    const { id: userId, token } = await createUser('user@test.com');
    await createTodo(userId, 1, { title: 'Todo 1' });
    await createTodo(userId, 1, { title: 'Todo 2' });
    await createTodo(userId, 1, { title: 'Todo 3' });
    const res = await app.request('/api/todos?page=1&limit=2', {
      headers: authHeader(token),
    });
    const body = await res.json();
    expect(body.data.length).toBe(2);
    expect(body.pagination.total).toBe(3);
    expect(body.pagination.totalPages).toBe(2);
  });
});

// ── POST /api/todos ───────────────────────────────────────────────────────────

describe('POST /api/todos', () => {
  it('creates a todo for the authenticated user', async () => {
    const { token } = await createUser('user@test.com');
    const res = await app.request('/api/todos', {
      method: 'POST',
      headers: { ...authHeader(token), 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: 'My new todo' }),
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.title).toBe('My new todo');
    expect(body.completed).toBe(false);
  });

  it('assigns the first available category when none is specified', async () => {
    const { token } = await createUser('user@test.com');
    const res = await app.request('/api/todos', {
      method: 'POST',
      headers: { ...authHeader(token), 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: 'Auto category' }),
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.categoryId).toBe(1);
  });

  it('returns 401 without a token', async () => {
    const res = await app.request('/api/todos', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: 'Unauthenticated' }),
    });
    expect(res.status).toBe(401);
  });
});

// ── GET /api/todos/:id ────────────────────────────────────────────────────────

describe('GET /api/todos/:id', () => {
  it('returns 404 for a non-existent todo', async () => {
    const { token } = await createUser('user@test.com');
    const res = await app.request('/api/todos/nonexistent-id', {
      headers: authHeader(token),
    });
    expect(res.status).toBe(404);
  });

  it("returns 403 when accessing another user's todo", async () => {
    const { id: userId } = await createUser('owner@test.com');
    const { token: otherToken } = await createUser('thief@test.com');
    const todo = await createTodo(userId);
    const res = await app.request(`/api/todos/${todo.id}`, {
      headers: authHeader(otherToken),
    });
    expect(res.status).toBe(403);
  });

  it('returns the todo for its owner', async () => {
    const { id: userId, token } = await createUser('owner@test.com');
    const todo = await createTodo(userId, 1, { title: 'My specific todo' });
    const res = await app.request(`/api/todos/${todo.id}`, {
      headers: authHeader(token),
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.id).toBe(todo.id);
    expect(body.title).toBe('My specific todo');
  });
});

// ── PUT /api/todos/:id ────────────────────────────────────────────────────────

describe('PUT /api/todos/:id', () => {
  it('updates the todo for its owner', async () => {
    const { id: userId, token } = await createUser('owner@test.com');
    const todo = await createTodo(userId);
    const res = await app.request(`/api/todos/${todo.id}`, {
      method: 'PUT',
      headers: { ...authHeader(token), 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: 'Updated title', completed: true }),
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.title).toBe('Updated title');
    expect(body.completed).toBe(true);
  });

  it("returns 403 when updating another user's todo", async () => {
    const { id: userId } = await createUser('owner@test.com');
    const { token: otherToken } = await createUser('thief@test.com');
    const todo = await createTodo(userId);
    const res = await app.request(`/api/todos/${todo.id}`, {
      method: 'PUT',
      headers: { ...authHeader(otherToken), 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: 'Hijacked' }),
    });
    expect(res.status).toBe(403);
  });

  it('returns 404 for a non-existent todo', async () => {
    const { token } = await createUser('user@test.com');
    const res = await app.request('/api/todos/does-not-exist', {
      method: 'PUT',
      headers: { ...authHeader(token), 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: 'Ghost update' }),
    });
    expect(res.status).toBe(404);
  });
});

// ── DELETE /api/todos/:id ─────────────────────────────────────────────────────

describe('DELETE /api/todos/:id', () => {
  it('deletes the todo for its owner', async () => {
    const { id: userId, token } = await createUser('owner@test.com');
    const todo = await createTodo(userId);
    const res = await app.request(`/api/todos/${todo.id}`, {
      method: 'DELETE',
      headers: authHeader(token),
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.id).toBe(todo.id);
  });

  it("returns 403 when deleting another user's todo", async () => {
    const { id: userId } = await createUser('owner@test.com');
    const { token: otherToken } = await createUser('thief@test.com');
    const todo = await createTodo(userId);
    const res = await app.request(`/api/todos/${todo.id}`, {
      method: 'DELETE',
      headers: authHeader(otherToken),
    });
    expect(res.status).toBe(403);
  });
});
