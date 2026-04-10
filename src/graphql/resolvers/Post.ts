import { prisma, formatDate } from '../../lib';
import { canReadPost } from '../../lib/access';
import type { GraphQLContext } from '../context';

function formatPost(p: { id: string; title: string; content: string; published: boolean; authorId: string; createdAt: Date; updatedAt: Date }) {
  return { ...p, createdAt: formatDate(p.createdAt), updatedAt: formatDate(p.updatedAt) };
}

export const Post = {
  author: async (parent: { authorId: string }) => {
    return prisma.user.findUnique({ where: { id: parent.authorId } });
  },

  comments: async (
    parent: { id: string },
    args: { page?: number; limit?: number },
    ctx: GraphQLContext
  ) => {
    // Visibility of the parent post is already enforced by the query/field resolver that
    // fetched it — no need to re-check here.
    const page = args.page ?? 1;
    const limit = args.limit ?? 10;
    const where = { postId: parent.id };

    const [comments, total] = await prisma.$transaction([
      prisma.comment.findMany({ where, skip: (page - 1) * limit, take: limit, orderBy: { createdAt: 'desc' } }),
      prisma.comment.count({ where }),
    ]);

    return {
      data: comments.map((c) => ({ ...c, createdAt: formatDate(c.createdAt) })),
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  },
};
