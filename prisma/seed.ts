import { prisma } from '../src/lib';

async function createUser() {
  await prisma.user.signUp('test1@test.com', 'password');
  await prisma.user.signUp('test2@test.com', 'password');
  await prisma.user.signUp('aaron@test.com', 'password');
  await prisma.user.signUp('alex@test.com', 'password');
  await prisma.user.signUp('jason@test.com', 'password');
}

async function createCategory() {
  await prisma.category.create({ data: { name: 'Default' } });
  await prisma.category.create({ data: { name: 'Study' } });
  await prisma.category.create({ data: { name: 'Work' } });
  await prisma.category.create({ data: { name: 'Personal' } });
  await prisma.category.create({ data: { name: 'Other' } });
}

async function createTodo() {
  await prisma.todo.createMany({
    data: [
      { title: 'Learn Elysia', categoryId: 2 },
      { title: 'Learn Prisma', categoryId: 2 },
      { title: 'Learn Bun', categoryId: 2 },
      { title: 'Finish Project', categoryId: 3 },
      { title: 'Buy Groceries', categoryId: 4 },
      {
        title: 'Lorem dolor esse exercitation enim',
        categoryId: 5
      },
      {
        title:
          'Lorem ipsum dolor sit amet consectetur adipisicing elit. Quisquam, quos.',
        categoryId: 5
      },
      {
        title:
          'Culpa nulla deserunt ex nisi exercitation elit ad sint do aliquip in non.',
        categoryId: 5
      }
    ]
  });
}

async function updateTodoUser() {
  await prisma.$transaction(async tx => {
    const user1 = await tx.user.findUnique({
      where: { email: 'aaron@test.com' }
    });
    const user2 = await tx.user.findUnique({
      where: { email: 'alex@test.com' }
    });
    const todos = await tx.todo.findMany();
    for (const todo of todos.slice(0, todos.length / 2)) {
      await tx.todo.update({
        where: { id: todo.id },
        data: { userId: user1?.id }
      });
    }
    for (const todo of todos.slice(todos.length / 2)) {
      await tx.todo.update({
        where: { id: todo.id },
        data: { userId: user2?.id }
      });
    }
  });
}

async function seed() {
  await createUser();
  await createCategory();
  await createTodo();
  await updateTodoUser();
}

seed()
  .then(() => console.log('Seed complete'))
  .catch(error => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
