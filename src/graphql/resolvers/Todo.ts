import { prisma } from '../../lib';

export const Todo = {
  category: async (parent: { categoryId: number }) => {
    return prisma.category.findUnique({ where: { id: parent.categoryId } });
  },
};
