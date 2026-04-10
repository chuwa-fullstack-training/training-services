import { OpenAPIHono, createRoute, z } from '@hono/zod-openapi';
import { prisma, formatDate } from '../lib';
import { authMiddleware, optionalAuth } from '../lib/auth';
import { canReadPost } from '../lib/access';

export const commentRouter = new OpenAPIHono();

// ── Schemas ──────────────────────────────────────────────────────────────────

const CommentSchema = z.object({
  id: z.string(),
  content: z.string(),
  postId: z.string(),
  authorId: z.string(),
  createdAt: z.string(),
});

const CommentPageSchema = z.object({
  data: z.array(CommentSchema),
  pagination: z.object({
    page: z.number(),
    limit: z.number(),
    total: z.number(),
    totalPages: z.number(),
  }),
});

const CreateCommentSchema = z.object({
  content: z.string().min(1).max(2000),
});

const notFound = z.object({ message: z.string() });
const forbidden = z.object({ message: z.string() });

// ── GET /:postId/comments ─────────────────────────────────────────────────────

const listCommentsRoute = createRoute({
  method: 'get',
  path: '/{postId}/comments',
  tags: ['Comment'],
  summary: 'List comments on a post (post must be readable by requester)',
  middleware: optionalAuth,
  request: {
    params: z.object({ postId: z.string() }),
    query: z.object({
      page: z.string().transform(Number).pipe(z.number().int().min(1)).optional(),
      limit: z.string().transform(Number).pipe(z.number().int().min(1).max(100)).optional(),
    }),
  },
  responses: {
    200: { description: 'Paginated comment list', content: { 'application/json': { schema: CommentPageSchema } } },
    403: { description: 'Access denied', content: { 'application/json': { schema: forbidden } } },
    404: { description: 'Post not found', content: { 'application/json': { schema: notFound } } },
  },
});

commentRouter.openapi(listCommentsRoute, async (c) => {
  const { postId } = c.req.valid('param');
  const userId = c.get('userId');
  const role = c.get('role');
  const { page: rawPage, limit: rawLimit } = c.req.valid('query');
  const page = rawPage ?? 1;
  const limit = rawLimit ?? 10;

  const post = await prisma.post.findUnique({ where: { id: postId } });
  if (!post) return c.json({ message: 'Post not found' }, 404);
  if (!canReadPost(post, userId, role)) return c.json({ message: 'Access denied' }, 403);

  const where = { postId };
  const [comments, total] = await prisma.$transaction([
    prisma.comment.findMany({ where, skip: (page - 1) * limit, take: limit, orderBy: { createdAt: 'desc' } }),
    prisma.comment.count({ where }),
  ]);

  return c.json(
    {
      data: comments.map((c) => ({ ...c, createdAt: formatDate(c.createdAt) })),
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    },
    200
  );
});

// ── POST /:postId/comments ────────────────────────────────────────────────────

const createCommentRoute = createRoute({
  method: 'post',
  path: '/{postId}/comments',
  tags: ['Comment'],
  summary: 'Add a comment to a published post (authenticated)',
  security: [{ Bearer: [] }],
  middleware: authMiddleware,
  request: {
    params: z.object({ postId: z.string() }),
    body: { content: { 'application/json': { schema: CreateCommentSchema } } },
  },
  responses: {
    200: { description: 'Comment created', content: { 'application/json': { schema: CommentSchema } } },
    403: { description: 'Post not published', content: { 'application/json': { schema: forbidden } } },
    404: { description: 'Post not found', content: { 'application/json': { schema: notFound } } },
  },
});

commentRouter.openapi(createCommentRoute, async (c) => {
  const { postId } = c.req.valid('param');
  const userId = c.get('userId');
  const body = c.req.valid('json');

  const post = await prisma.post.findUnique({ where: { id: postId } });
  if (!post) return c.json({ message: 'Post not found' }, 404);
  if (!post.published) return c.json({ message: 'Cannot comment on an unpublished post' }, 403);

  const comment = await prisma.comment.create({
    data: { content: body.content, postId, authorId: userId },
  });

  return c.json({ ...comment, createdAt: formatDate(comment.createdAt) }, 200);
});

// ── DELETE /:postId/comments/:id ──────────────────────────────────────────────

const deleteCommentRoute = createRoute({
  method: 'delete',
  path: '/{postId}/comments/{id}',
  tags: ['Comment'],
  summary: 'Delete a comment (admin only)',
  security: [{ Bearer: [] }],
  middleware: authMiddleware,
  request: { params: z.object({ postId: z.string(), id: z.string() }) },
  responses: {
    200: {
      description: 'Comment deleted',
      content: { 'application/json': { schema: z.object({ message: z.string(), id: z.string() }) } },
    },
    403: { description: 'Admin only', content: { 'application/json': { schema: forbidden } } },
    404: { description: 'Not found', content: { 'application/json': { schema: notFound } } },
  },
});

commentRouter.openapi(deleteCommentRoute, async (c) => {
  const { postId, id } = c.req.valid('param');
  const role = c.get('role');

  if (role !== 'ADMIN') return c.json({ message: 'Admin access required' }, 403);

  const comment = await prisma.comment.findUnique({ where: { id } });
  if (!comment) return c.json({ message: 'Comment not found' }, 404);
  if (comment.postId !== postId) return c.json({ message: 'Comment not found' }, 404);

  await prisma.comment.delete({ where: { id } });
  return c.json({ message: 'Comment deleted successfully', id }, 200);
});
