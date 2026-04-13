import { describe, it, expect, beforeEach, afterAll } from 'bun:test';
import { app } from '../helpers/app';
import { truncateAndSeed, prisma } from '../helpers/db';
import { createUser, createAdmin, authHeader } from '../helpers/auth';
import { createPost, createComment } from '../helpers/factories';

beforeEach(async () => {
  await truncateAndSeed();
});

afterAll(async () => {
  await prisma.$disconnect();
});

// ── GET /api/posts/:postId/comments ───────────────────────────────────────────

describe('GET /api/posts/:postId/comments', () => {
  it('returns 404 for a non-existent post', async () => {
    const res = await app.request('/api/posts/nonexistent/comments');
    expect(res.status).toBe(404);
  });

  it('returns 403 when reading comments on a draft the requester cannot see', async () => {
    const { id: authorId } = await createUser('author@test.com');
    const { token: otherToken } = await createUser('other@test.com');
    const post = await createPost(authorId, { published: false });

    const res = await app.request(`/api/posts/${post.id}/comments`, {
      headers: authHeader(otherToken),
    });
    expect(res.status).toBe(403);
  });

  it('returns paginated comments for a published post', async () => {
    const { id: authorId } = await createUser('author@test.com');
    const post = await createPost(authorId, { published: true });
    await createComment(post.id, authorId, 'First comment');
    await createComment(post.id, authorId, 'Second comment');

    const res = await app.request(`/api/posts/${post.id}/comments`);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.length).toBe(2);
    expect(body.pagination.total).toBe(2);
  });
});

// ── POST /api/posts/:postId/comments ─────────────────────────────────────────

describe('POST /api/posts/:postId/comments', () => {
  it('creates a comment on a published post', async () => {
    const { id: authorId } = await createUser('author@test.com');
    const { token: commenterToken } = await createUser('commenter@test.com');
    const post = await createPost(authorId, { published: true });

    const res = await app.request(`/api/posts/${post.id}/comments`, {
      method: 'POST',
      headers: { ...authHeader(commenterToken), 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: 'Great post!' }),
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.content).toBe('Great post!');
    expect(body.postId).toBe(post.id);
  });

  it('returns 403 when commenting on an unpublished post', async () => {
    const { id: authorId } = await createUser('author@test.com');
    const { token: commenterToken } = await createUser('commenter@test.com');
    const post = await createPost(authorId, { published: false });

    const res = await app.request(`/api/posts/${post.id}/comments`, {
      method: 'POST',
      headers: { ...authHeader(commenterToken), 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: 'Can I even comment?' }),
    });
    expect(res.status).toBe(403);
  });

  it('returns 401 without a token', async () => {
    const { id: authorId } = await createUser('author@test.com');
    const post = await createPost(authorId, { published: true });

    const res = await app.request(`/api/posts/${post.id}/comments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: 'Anonymous?' }),
    });
    expect(res.status).toBe(401);
  });

  it('returns 404 for a non-existent post', async () => {
    const { token } = await createUser('user@test.com');
    const res = await app.request('/api/posts/nonexistent/comments', {
      method: 'POST',
      headers: { ...authHeader(token), 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: 'Ghost comment' }),
    });
    expect(res.status).toBe(404);
  });
});

// ── DELETE /api/posts/:postId/comments/:id ────────────────────────────────────

describe('DELETE /api/posts/:postId/comments/:id', () => {
  it('returns 403 for a non-admin user', async () => {
    const { id: authorId } = await createUser('author@test.com');
    const { token: userToken } = await createUser('user@test.com');
    const post = await createPost(authorId, { published: true });
    const comment = await createComment(post.id, authorId);

    const res = await app.request(`/api/posts/${post.id}/comments/${comment.id}`, {
      method: 'DELETE',
      headers: authHeader(userToken),
    });
    expect(res.status).toBe(403);
  });

  it('admin can delete any comment', async () => {
    const { id: authorId } = await createUser('author@test.com');
    const admin = await createAdmin();
    const post = await createPost(authorId, { published: true });
    const comment = await createComment(post.id, authorId);

    const res = await app.request(`/api/posts/${post.id}/comments/${comment.id}`, {
      method: 'DELETE',
      headers: authHeader(admin.token),
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.id).toBe(comment.id);
  });

  it('returns 404 for a non-existent comment', async () => {
    const { id: authorId } = await createUser('author@test.com');
    const admin = await createAdmin();
    const post = await createPost(authorId, { published: true });

    const res = await app.request(`/api/posts/${post.id}/comments/nonexistent`, {
      method: 'DELETE',
      headers: authHeader(admin.token),
    });
    expect(res.status).toBe(404);
  });
});
