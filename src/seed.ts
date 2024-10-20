import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function seed() {
  await prisma.todo.create({ data: { title: 'Learn Elysia' } });
  await prisma.todo.create({ data: { title: 'Learn Prisma' } });
  await prisma.todo.create({ data: { title: 'Learn Bun' } });
}

await seed();
