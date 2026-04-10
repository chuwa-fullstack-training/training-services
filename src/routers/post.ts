import { OpenAPIHono, createRoute, z } from '@hono/zod-openapi';
import { prisma, formatDate } from '../lib';
import { authMiddleware, optionalAuth } from '../lib/auth';
import { canReadPost } from '../lib/access';

export const postRouter = new OpenAPIHono();

// ── Schemas ──────────────────────────────────────────────────────────────────

const PostSchema = z.object({
  id: z.string(),
  title: z.string(),
  content: z.string(),
  published: z.boolean(),
  authorId: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

const PostPageSchema = z.object({
  data: z.array(PostSchema),
  pagination: z.object({
    page: z.number(),
    limit: z.number(),
    total: z.number(),
    totalPages: z.number(),
  }),
});

const CreatePostSchema = z.object({
  title: z.string().min(1).max(200),
  content: z.string().min(1),
  published: z.boolean().optional(),
});

const UpdatePostSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  content: z.string().min(1).optional(),
  published: z.boolean().optional(),
});

const notFound = z.object({ message: z.string() });
const forbidden = z.object({ message: z.string() });

// ── GET / ─────────────────────────────────────────────────────────────────────

const listPostsRoute = createRoute({
  method: 'get',
  path: '/',
  tags: ['Post'],
  summary: 'List posts with visibility rules (public: published only; owner/admin: all own posts)',
  middleware: optionalAuth,
  request: {
    query: z.object({
      page: z.string().transform(Number).pipe(z.number().int().min(1)).optional(),
      limit: z.string().transform(Number).pipe(z.number().int().min(1).max(100)).optional(),
    }),
  },
  responses: {
    200: { description: 'Paginated post list', content: { 'application/json': { schema: PostPageSchema } } },
  },
});

postRouter.openapi(listPostsRoute, async (c) => {
  const userId = c.get('userId');
  const role = c.get('role');
  const { page: rawPage, limit: rawLimit } = c.req.valid('query');
  const page = rawPage ?? 1;
  const limit = rawLimit ?? 10;

  const where =
    role === 'ADMIN'
      ? {}
      : userId
        ? { OR: [{ published: true }, { authorId: userId }] }
        : { published: true };

  const [posts, total] = await prisma.$transaction([
    prisma.post.findMany({ where, skip: (page - 1) * limit, take: limit, orderBy: { createdAt: 'desc' } }),
    prisma.post.count({ where }),
  ]);

  return c.json(
    {
      data: posts.map((p) => ({ ...p, createdAt: formatDate(p.createdAt), updatedAt: formatDate(p.updatedAt) })),
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    },
    200
  );
});

// ── GET /:id ──────────────────────────────────────────────────────────────────

const getPostRoute = createRoute({
  method: 'get',
  path: '/{id}',
  tags: ['Post'],
  summary: 'Get post by ID',
  middleware: optionalAuth,
  request: { params: z.object({ id: z.string() }) },
  responses: {
    200: { description: 'Post', content: { 'application/json': { schema: PostSchema } } },
    403: { description: 'Access denied', content: { 'application/json': { schema: forbidden } } },
    404: { description: 'Not found', content: { 'application/json': { schema: notFound } } },
  },
});

postRouter.openapi(getPostRoute, async (c) => {
  const { id } = c.req.valid('param');
  const userId = c.get('userId');
  const role = c.get('role');

  const post = await prisma.post.findUnique({ where: { id } });
  if (!post) return c.json({ message: 'Post not found' }, 404);
  if (!canReadPost(post, userId, role)) return c.json({ message: 'Access denied' }, 403);

  return c.json({ ...post, createdAt: formatDate(post.createdAt), updatedAt: formatDate(post.updatedAt) }, 200);
});

// ── POST / ────────────────────────────────────────────────────────────────────

const createPostRoute = createRoute({
  method: 'post',
  path: '/',
  tags: ['Post'],
  summary: 'Create a new post',
  security: [{ Bearer: [] }],
  middleware: authMiddleware,
  request: { body: { content: { 'application/json': { schema: CreatePostSchema } } } },
  responses: {
    200: { description: 'Post created', content: { 'application/json': { schema: PostSchema } } },
  },
});

postRouter.openapi(createPostRoute, async (c) => {
  const userId = c.get('userId');
  const body = c.req.valid('json');

  const post = await prisma.post.create({
    data: { title: body.title, content: body.content, published: body.published ?? false, authorId: userId },
  });

  return c.json({ ...post, createdAt: formatDate(post.createdAt), updatedAt: formatDate(post.updatedAt) }, 200);
});

// ── PUT /:id ──────────────────────────────────────────────────────────────────

const updatePostRoute = createRoute({
  method: 'put',
  path: '/{id}',
  tags: ['Post'],
  summary: 'Update post (owner or admin)',
  security: [{ Bearer: [] }],
  middleware: authMiddleware,
  request: {
    params: z.object({ id: z.string() }),
    body: { content: { 'application/json': { schema: UpdatePostSchema } } },
  },
  responses: {
    200: { description: 'Post updated', content: { 'application/json': { schema: PostSchema } } },
    403: { description: 'Access denied', content: { 'application/json': { schema: forbidden } } },
    404: { description: 'Not found', content: { 'application/json': { schema: notFound } } },
  },
});

postRouter.openapi(updatePostRoute, async (c) => {
  const { id } = c.req.valid('param');
  const userId = c.get('userId');
  const role = c.get('role');
  const body = c.req.valid('json');

  const existing = await prisma.post.findUnique({ where: { id } });
  if (!existing) return c.json({ message: 'Post not found' }, 404);
  if (existing.authorId !== userId && role !== 'ADMIN') return c.json({ message: 'Access denied' }, 403);

  const post = await prisma.post.update({ where: { id }, data: body });
  return c.json({ ...post, createdAt: formatDate(post.createdAt), updatedAt: formatDate(post.updatedAt) }, 200);
});

// ── DELETE /:id ───────────────────────────────────────────────────────────────

const deletePostRoute = createRoute({
  method: 'delete',
  path: '/{id}',
  tags: ['Post'],
  summary: 'Delete post (owner or admin)',
  security: [{ Bearer: [] }],
  middleware: authMiddleware,
  request: { params: z.object({ id: z.string() }) },
  responses: {
    200: {
      description: 'Post deleted',
      content: { 'application/json': { schema: z.object({ message: z.string(), id: z.string() }) } },
    },
    403: { description: 'Access denied', content: { 'application/json': { schema: forbidden } } },
    404: { description: 'Not found', content: { 'application/json': { schema: notFound } } },
  },
});

postRouter.openapi(deletePostRoute, async (c) => {
  const { id } = c.req.valid('param');
  const userId = c.get('userId');
  const role = c.get('role');

  const existing = await prisma.post.findUnique({ where: { id } });
  if (!existing) return c.json({ message: 'Post not found' }, 404);
  if (existing.authorId !== userId && role !== 'ADMIN') return c.json({ message: 'Access denied' }, 403);

  await prisma.post.delete({ where: { id } });
  return c.json({ message: 'Post deleted successfully', id }, 200);
});
