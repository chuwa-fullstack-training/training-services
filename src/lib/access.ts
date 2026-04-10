/**
 * Shared post visibility check used by both REST routers and GraphQL resolvers.
 *
 * Rules:
 *   - Admin: sees everything
 *   - Owner: sees own posts regardless of published state
 *   - Everyone else: sees published posts only
 */
export function canReadPost(
  post: { published: boolean; authorId: string },
  userId: string | null | undefined,
  role: string | null | undefined
): boolean {
  if (role === 'ADMIN') return true;
  if (post.published) return true;
  if (userId && post.authorId === userId) return true;
  return false;
}
