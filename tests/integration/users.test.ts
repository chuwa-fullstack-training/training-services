import { describe, it, expect, beforeEach, afterAll } from 'bun:test';
import { app } from '../helpers/app';
import { truncateAndSeed, prisma } from '../helpers/db';
import { createUser, createAdmin, authHeader } from '../helpers/auth';

beforeEach(async () => {
  await truncateAndSeed();
});

afterAll(async () => {
  await prisma.$disconnect();
});

// ── POST /api/auth/signup ─────────────────────────────────────────────────────

describe('POST /api/auth/signup', () => {
  it('creates a new user and returns success message', async () => {
    const res = await app.request('/api/auth/signup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'new@test.com', password: 'password123' }),
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.message).toBe('User created successfully');
  });

  it('returns 400 for a duplicate email', async () => {
    await createUser('dup@test.com');
    const res = await app.request('/api/auth/signup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'dup@test.com', password: 'password123' }),
    });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.message).toMatch(/already exists/i);
  });

  it('returns 400 for an invalid email format', async () => {
    const res = await app.request('/api/auth/signup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'notanemail', password: 'password123' }),
    });
    expect(res.status).toBe(400);
  });

  it('returns 400 for a password shorter than 8 characters', async () => {
    const res = await app.request('/api/auth/signup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'test@test.com', password: 'short' }),
    });
    expect(res.status).toBe(400);
  });
});

// ── POST /api/auth/login ──────────────────────────────────────────────────────

describe('POST /api/auth/login', () => {
  it('returns a JWT token on valid credentials', async () => {
    await createUser('login@test.com', 'password123');
    const res = await app.request('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'login@test.com', password: 'password123' }),
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.token).toBeTruthy();
    expect(body.data.email).toBe('login@test.com');
  });

  it('returns 400 for a wrong password', async () => {
    await createUser('user@test.com', 'correctpass1');
    const res = await app.request('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'user@test.com', password: 'wrongpass1' }),
    });
    expect(res.status).toBe(400);
  });

  it('returns 400 for a non-existent user', async () => {
    const res = await app.request('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'ghost@test.com', password: 'password123' }),
    });
    expect(res.status).toBe(400);
  });
});

// ── GET /api/users/me ─────────────────────────────────────────────────────────

describe('GET /api/users/me', () => {
  it('returns 401 without a token', async () => {
    const res = await app.request('/api/users/me');
    expect(res.status).toBe(401);
  });

  it('returns the authenticated user profile', async () => {
    const { token, email } = await createUser('me@test.com');
    const res = await app.request('/api/users/me', {
      headers: authHeader(token),
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.email).toBe(email);
    expect(Array.isArray(body.todos)).toBe(true);
    expect(Array.isArray(body.posts)).toBe(true);
  });
});

// ── GET /api/users ────────────────────────────────────────────────────────────

describe('GET /api/users', () => {
  it('returns 403 for a regular user', async () => {
    const { token } = await createUser('user@test.com');
    const res = await app.request('/api/users', {
      headers: authHeader(token),
    });
    expect(res.status).toBe(403);
  });

  it('returns the user list for an admin', async () => {
    const admin = await createAdmin();
    await createUser('regular@test.com');
    const res = await app.request('/api/users', {
      headers: authHeader(admin.token),
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body)).toBe(true);
    expect(body.length).toBeGreaterThanOrEqual(2); // admin + regular user
  });
});
