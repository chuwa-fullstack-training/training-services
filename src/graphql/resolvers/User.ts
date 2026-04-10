import { prisma, formatDate } from '../../lib';

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
};
