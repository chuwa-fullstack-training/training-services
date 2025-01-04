import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function createUser() {
  await prisma.user.createMany({
    data: [
      {
        email: "test1@test.com",
        password: "password",
      },
      {
        email: "test2@test.com",
        password: "password",
      },
    ],
  });
}

async function createCategory() {
  await prisma.category.create({ data: { name: "Default" } });
  await prisma.category.create({ data: { name: "Study" } });
}

async function createTodo() {
  await prisma.todo.createMany({
    data: [
      { title: "Learn Elysia", categoryId: 3 },
      { title: "Learn Prisma", categoryId: 3 },
      { title: "Learn Bun", categoryId: 3 },
      { title: "Finish Project", categoryId: 4 },
    ],
  });
}

async function updateTodoUser() {
  await prisma.$transaction(async (tx) => {
    const user = await tx.user.findUnique({
      where: { email: "test1@test.com" },
    });
    const todos = await tx.todo.findMany();
    for (const todo of todos) {
      await tx.todo.update({
        where: { id: todo.id },
        data: { userId: user?.id },
      });
    }
  });
}

async function seed() {
  // await createUser();
  await createCategory();
  // await createTodo();
  // await updateTodoUser();
}

await seed();
