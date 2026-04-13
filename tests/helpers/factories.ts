import { prisma } from '../../src/lib';

export async function createTodo(
  userId: string,
  categoryId = 1,
  overrides: { title?: string; completed?: boolean } = {}
) {
  return prisma.todo.create({
    data: {
      title: overrides.title ?? 'Test Todo',
      completed: overrides.completed ?? false,
      categoryId,
      userId,
    },
  });
}

export async function createPost(
  authorId: string,
  overrides: { title?: string; content?: string; published?: boolean } = {}
) {
  return prisma.post.create({
    data: {
      title: overrides.title ?? 'Test Post',
      content: overrides.content ?? 'Test content',
      published: overrides.published ?? false,
      authorId,
    },
  });
}

export async function createComment(
  postId: string,
  authorId: string,
  content = 'Test comment'
) {
  return prisma.comment.create({
    data: { content, postId, authorId },
  });
}
