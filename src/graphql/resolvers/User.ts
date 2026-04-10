import { prisma, formatDate } from '../../lib';
import { type GraphQLContext } from '../context';

export const User = {
  todos: async (parent: { id: string }) => {
    const todos = await prisma.todo.findMany({
      where: { userId: parent.id },
      orderBy: { createdAt: 'desc' },
    });

    return todos.map((todo) => ({
      ...todo,
      userId: todo.userId ?? '',
      createdAt: formatDate(todo.createdAt),
      updatedAt: formatDate(todo.updatedAt),
    }));
  },

  posts: async (
    parent: { id: string },
    args: { page?: number; limit?: number },
    ctx: GraphQLContext
  ) => {
    const page = args.page ?? 1;
    const limit = args.limit ?? 10;

    const isOwner = ctx.userId === parent.id;
    const isAdmin = ctx.role === 'ADMIN';
    const where = isOwner || isAdmin ? { authorId: parent.id } : { authorId: parent.id, published: true };

    const [posts, total] = await prisma.$transaction([
      prisma.post.findMany({ where, skip: (page - 1) * limit, take: limit, orderBy: { createdAt: 'desc' } }),
      prisma.post.count({ where }),
    ]);

    return {
      data: posts.map((p) => ({ ...p, createdAt: formatDate(p.createdAt), updatedAt: formatDate(p.updatedAt) })),
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  },
};
