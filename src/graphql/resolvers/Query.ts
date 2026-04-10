import { GraphQLError } from 'graphql';
import { prisma, formatDate } from '../../lib';
import { requireAuth, type GraphQLContext } from '../context';

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
};
