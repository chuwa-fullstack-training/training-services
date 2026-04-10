import { GraphQLError } from 'graphql';
import { prisma, formatDate } from '../../lib';
import { requireAuth, type GraphQLContext } from '../context';
import { canReadPost } from '../../lib/access';

function formatPost(p: { id: string; title: string; content: string; published: boolean; authorId: string; createdAt: Date; updatedAt: Date }) {
  return { ...p, createdAt: formatDate(p.createdAt), updatedAt: formatDate(p.updatedAt) };
}

export const Query = {
  me: async (_: unknown, __: unknown, ctx: GraphQLContext) => {
    const userId = requireAuth(ctx);
    return prisma.user.findUnique({ where: { id: userId } });
  },

  todos: async (
    _: unknown,
    args: { categoryId?: number; page?: number; limit?: number },
    ctx: GraphQLContext
  ) => {
    const userId = requireAuth(ctx);
    const page = args.page ?? 1;
    const limit = args.limit ?? 10;
    const where = { userId, categoryId: args.categoryId || undefined };

    const [todos, total] = await prisma.$transaction([
      prisma.todo.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.todo.count({ where }),
    ]);

    return {
      data: todos.map((todo) => ({
        ...todo,
        userId: todo.userId ?? '',
        createdAt: formatDate(todo.createdAt),
        updatedAt: formatDate(todo.updatedAt),
      })),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  },

  todo: async (_: unknown, args: { id: string }, ctx: GraphQLContext) => {
    const userId = requireAuth(ctx);
    const todo = await prisma.todo.findUnique({ where: { id: args.id } });

    if (!todo) {
      throw new GraphQLError('Todo not found', { extensions: { code: 'NOT_FOUND' } });
    }
    if (todo.userId !== userId) {
      throw new GraphQLError('Access denied', { extensions: { code: 'FORBIDDEN' } });
    }

    return {
      ...todo,
      userId: todo.userId ?? '',
      createdAt: formatDate(todo.createdAt),
      updatedAt: formatDate(todo.updatedAt),
    };
  },

  posts: async (_: unknown, args: { page?: number; limit?: number }, ctx: GraphQLContext) => {
    const page = args.page ?? 1;
    const limit = args.limit ?? 10;

    const where =
      ctx.role === 'ADMIN'
        ? {}
        : ctx.userId
          ? { OR: [{ published: true }, { authorId: ctx.userId }] }
          : { published: true };

    const [posts, total] = await prisma.$transaction([
      prisma.post.findMany({ where, skip: (page - 1) * limit, take: limit, orderBy: { createdAt: 'desc' } }),
      prisma.post.count({ where }),
    ]);

    return {
      data: posts.map(formatPost),
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  },

  post: async (_: unknown, args: { id: string }, ctx: GraphQLContext) => {
    const post = await prisma.post.findUnique({ where: { id: args.id } });
    if (!post) throw new GraphQLError('Post not found', { extensions: { code: 'NOT_FOUND' } });
    if (!canReadPost(post, ctx.userId, ctx.role)) {
      throw new GraphQLError('Access denied', { extensions: { code: 'FORBIDDEN' } });
    }
    return formatPost(post);
  },
};
