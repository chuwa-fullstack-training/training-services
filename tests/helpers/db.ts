import { prisma } from '../../src/lib';

export { prisma };

/**
 * Truncates all tables in FK-safe order and re-seeds the required default
 * category (id = 1). The RESTART IDENTITY ensures the autoincrement sequence
 * for Category resets so the first insert gets id = 1.
 */
export async function truncateAndSeed(): Promise<void> {
  await prisma.$executeRawUnsafe(
    'TRUNCATE TABLE "Comment", "Todo", "Post", "User", "Category" RESTART IDENTITY CASCADE'
  );
  // Re-create the default category that business logic depends on (id = 1)
  await prisma.category.create({ data: { name: 'General' } });
}
