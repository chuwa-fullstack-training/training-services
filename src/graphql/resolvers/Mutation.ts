import { GraphQLError } from 'graphql';
import { prisma, formatDate } from '../../lib';
import { signToken } from '../../lib/auth';
import { UserAlreadyExistsError } from '../../lib/errors';
import { requireAuth, type GraphQLContext } from '../context';

export const Mutation = {
  login: async (_: unknown, args: { email: string; password: string }) => {
    const user = await prisma.user.findUnique({ where: { email: args.email } });
    if (!user) {
      throw new GraphQLError('User not found', { extensions: { code: 'BAD_USER_INPUT' } });
    }

    const isValid = await Bun.password.verify(args.password, user.password);
    if (!isValid) {
      throw new GraphQLError('Invalid password', { extensions: { code: 'BAD_USER_INPUT' } });
    }

    const token = await signToken(user.id, user.role);
    return { token, userId: user.id, email: user.email };
  },

  signup: async (_: unknown, args: { email: string; password: string }) => {
    try {
      const user = await prisma.user.signUp(args.email, args.password);
      const token = await signToken(user.id, user.role);
      return { token, userId: user.id, email: user.email };
    } catch (e) {
      if (e instanceof UserAlreadyExistsError) {
        throw new GraphQLError(e.message, { extensions: { code: 'BAD_USER_INPUT' } });
      }
      throw new GraphQLError('Signup failed', {
        extensions: { code: 'INTERNAL_SERVER_ERROR' },
      });
    }
  },
  createTodo: async (
    _: unknown,
    args: { title: string; completed?: boolean; categoryId?: number },
    ctx: GraphQLContext
  ) => {
    const userId = requireAuth(ctx);
    let categoryId = args.categoryId;

    if (!categoryId) {
      const category = await prisma.category.findFirst();
      if (!category) {
        throw new GraphQLError('No categories available. Please create a category first.', {
          extensions: { code: 'BAD_REQUEST' },
        });
      }
      categoryId = category.id;
    }

    const todo = await prisma.todo.create({
      data: {
        title: args.title,
        completed: args.completed ?? false,
        categoryId,
        userId,
      },
    });

    return {
      ...todo,
      userId: todo.userId ?? '',
      createdAt: formatDate(todo.createdAt),
      updatedAt: formatDate(todo.updatedAt),
    };
  },

  updateTodo: async (
    _: unknown,
    args: { id: string; title?: string; completed?: boolean; categoryId?: number },
    ctx: GraphQLContext
  ) => {
    const userId = requireAuth(ctx);
    const existing = await prisma.todo.findUnique({ where: { id: args.id } });

    if (!existing) {
      throw new GraphQLError('Todo not found', { extensions: { code: 'NOT_FOUND' } });
    }
    if (existing.userId !== userId) {
      throw new GraphQLError('Access denied', { extensions: { code: 'FORBIDDEN' } });
    }

    const { id, ...data } = args;
    const todo = await prisma.todo.update({ where: { id }, data });

    return {
      ...todo,
      userId: todo.userId ?? '',
      createdAt: formatDate(todo.createdAt),
      updatedAt: formatDate(todo.updatedAt),
    };
  },

  deleteTodo: async (_: unknown, args: { id: string }, ctx: GraphQLContext) => {
    const userId = requireAuth(ctx);
    const existing = await prisma.todo.findUnique({ where: { id: args.id } });

    if (!existing) {
      throw new GraphQLError('Todo not found', { extensions: { code: 'NOT_FOUND' } });
    }
    if (existing.userId !== userId) {
      throw new GraphQLError('Access denied', { extensions: { code: 'FORBIDDEN' } });
    }

    await prisma.todo.delete({ where: { id: args.id } });

    return { message: 'Todo deleted successfully', id: args.id };
  },
};
