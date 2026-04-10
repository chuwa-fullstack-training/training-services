import { prisma } from '../../lib';

export const Comment = {
  author: async (parent: { authorId: string }) => {
    return prisma.user.findUnique({ where: { id: parent.authorId } });
  },
};
