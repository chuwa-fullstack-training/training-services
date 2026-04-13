import { describe, it, expect, afterAll } from 'bun:test';
import { signToken } from '../../src/lib/auth';
import { app } from '../helpers/app';
import { prisma } from '../helpers/db';

afterAll(async () => {
  await prisma.$disconnect();
});

describe('signToken', () => {
  it('returns a three-part JWT string', async () => {
    const token = await signToken('some-user-id', 'USER');
    expect(typeof token).toBe('string');
    expect(token.split('.').length).toBe(3);
  });

  it('produces different tokens for different payloads', async () => {
    const t1 = await signToken('id-1', 'USER');
    const t2 = await signToken('id-2', 'ADMIN');
    expect(t1).not.toBe(t2);
  });
});

describe('authMiddleware (via /api/users/me)', () => {
  it('returns 401 when no Authorization header is provided', async () => {
    const res = await app.request('/api/users/me');
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.message).toMatch(/authentication required/i);
  });

  it('returns 401 for a malformed token', async () => {
    const res = await app.request('/api/users/me', {
      headers: { Authorization: 'Bearer not.a.valid.token' },
    });
    expect(res.status).toBe(401);
  });

  it('returns 401 for a token signed with the wrong secret', async () => {
    // Manually craft a JWT with an incorrect signature
    const badToken = 'eyJhbGciOiJIUzI1NiJ9.eyJpZCI6ImZha2UifQ.invalidsignature';
    const res = await app.request('/api/users/me', {
      headers: { Authorization: `Bearer ${badToken}` },
    });
    expect(res.status).toBe(401);
  });
});

describe('optionalAuth (via GET /api/posts)', () => {
  it('succeeds without a token (public access)', async () => {
    const res = await app.request('/api/posts');
    expect(res.status).toBe(200);
  });

  it('succeeds with a valid token and applies auth context', async () => {
    // A valid token for a non-existent user still passes middleware
    const token = await signToken('phantom-user-id', 'USER');
    const res = await app.request('/api/posts', {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(res.status).toBe(200);
  });
});
