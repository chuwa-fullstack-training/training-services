import { describe, it, expect, beforeEach, afterAll } from 'bun:test';
import { app } from '../helpers/app';
import { truncateAndSeed, prisma } from '../helpers/db';
import { createUser, createAdmin, authHeader } from '../helpers/auth';
import { createPost } from '../helpers/factories';

beforeEach(async () => {
  await truncateAndSeed();
});

afterAll(async () => {
  await prisma.$disconnect();
});

// ── POST /api/posts ───────────────────────────────────────────────────────────

describe('POST /api/posts', () => {
  it('creates a draft post for the authenticated user', async () => {
    const { token } = await createUser('author@test.com');
    const res = await app.request('/api/posts', {
      method: 'POST',
      headers: { ...authHeader(token), 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: 'New Post', content: 'Some content here' }),
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.title).toBe('New Post');
    expect(body.published).toBe(false);
  });

  it('returns 401 without a token', async () => {
    const res = await app.request('/api/posts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: 'Anon post', content: 'content' }),
    });
    expect(res.status).toBe(401);
  });
});

// ── GET /api/posts ────────────────────────────────────────────────────────────

describe('GET /api/posts', () => {
  it('unauthenticated requests see only published posts', async () => {
    const { id: authorId } = await createUser('author@test.com');
    await createPost(authorId, { published: true, title: 'Public Post' });
    await createPost(authorId, { published: false, title: 'Draft Post' });

    const res = await app.request('/api/posts');
    const body = await res.json();
    expect(body.data.length).toBe(1);
    expect(body.data[0].title).toBe('Public Post');
  });

  it("an authenticated owner sees their drafts alongside all published posts", async () => {
    const { id: authorId, token } = await createUser('author@test.com');
    const { id: otherId } = await createUser('other@test.com');
    await createPost(authorId, { published: false, title: 'My Draft' });
    await createPost(otherId, { published: true, title: "Other's Published" });

    const res = await app.request('/api/posts', { headers: authHeader(token) });
    const body = await res.json();
    expect(body.data.length).toBe(2);
  });

  it('admin sees all posts', async () => {
    const { id: userId } = await createUser('user@test.com');
    const admin = await createAdmin();
    await createPost(userId, { published: false });
    await createPost(userId, { published: true });

    const res = await app.request('/api/posts', { headers: authHeader(admin.token) });
    const body = await res.json();
    expect(body.data.length).toBe(2);
  });
});

// ── GET /api/posts/:id ────────────────────────────────────────────────────────

describe('GET /api/posts/:id', () => {
  it('returns 404 for a non-existent post', async () => {
    const res = await app.request('/api/posts/nonexistent');
    expect(res.status).toBe(404);
  });

  it('returns 403 for a draft when requested by a non-owner', async () => {
    const { id: authorId } = await createUser('author@test.com');
    const { token: otherToken } = await createUser('other@test.com');
    const post = await createPost(authorId, { published: false });

    const res = await app.request(`/api/posts/${post.id}`, {
      headers: authHeader(otherToken),
    });
    expect(res.status).toBe(403);
  });

  it('the owner can view their own draft', async () => {
    const { id: authorId, token } = await createUser('author@test.com');
    const post = await createPost(authorId, { published: false });

    const res = await app.request(`/api/posts/${post.id}`, {
      headers: authHeader(token),
    });
    expect(res.status).toBe(200);
  });

  it('anyone can view a published post', async () => {
    const { id: authorId } = await createUser('author@test.com');
    const post = await createPost(authorId, { published: true });

    const res = await app.request(`/api/posts/${post.id}`);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.id).toBe(post.id);
  });
});

// ── PUT /api/posts/:id ────────────────────────────────────────────────────────

describe('PUT /api/posts/:id', () => {
  it('the owner can update their own post', async () => {
    const { id: authorId, token } = await createUser('author@test.com');
    const post = await createPost(authorId);
    const res = await app.request(`/api/posts/${post.id}`, {
      method: 'PUT',
      headers: { ...authHeader(token), 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: 'Updated title' }),
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.title).toBe('Updated title');
  });

  it('a non-owner receives 403', async () => {
    const { id: authorId } = await createUser('author@test.com');
    const { token: otherToken } = await createUser('other@test.com');
    const post = await createPost(authorId);
    const res = await app.request(`/api/posts/${post.id}`, {
      method: 'PUT',
      headers: { ...authHeader(otherToken), 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: 'Hijacked' }),
    });
    expect(res.status).toBe(403);
  });

  it('admin can update any post', async () => {
    const { id: userId } = await createUser('user@test.com');
    const admin = await createAdmin();
    const post = await createPost(userId);
    const res = await app.request(`/api/posts/${post.id}`, {
      method: 'PUT',
      headers: { ...authHeader(admin.token), 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: 'Admin override' }),
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.title).toBe('Admin override');
  });
});

// ── DELETE /api/posts/:id ─────────────────────────────────────────────────────

describe('DELETE /api/posts/:id', () => {
  it('the owner can delete their own post', async () => {
    const { id: authorId, token } = await createUser('author@test.com');
    const post = await createPost(authorId);
    const res = await app.request(`/api/posts/${post.id}`, {
      method: 'DELETE',
      headers: authHeader(token),
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.id).toBe(post.id);
  });

  it('a non-owner receives 403', async () => {
    const { id: authorId } = await createUser('author@test.com');
    const { token: otherToken } = await createUser('other@test.com');
    const post = await createPost(authorId);
    const res = await app.request(`/api/posts/${post.id}`, {
      method: 'DELETE',
      headers: authHeader(otherToken),
    });
    expect(res.status).toBe(403);
  });

  it('admin can delete any post', async () => {
    const { id: userId } = await createUser('user@test.com');
    const admin = await createAdmin();
    const post = await createPost(userId);
    const res = await app.request(`/api/posts/${post.id}`, {
      method: 'DELETE',
      headers: authHeader(admin.token),
    });
    expect(res.status).toBe(200);
  });
});
