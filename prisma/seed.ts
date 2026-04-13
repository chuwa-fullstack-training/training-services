import { prisma } from '../src/lib';
import { UserAlreadyExistsError } from '../src/lib/errors';

async function createUser() {
  const users = [
    'test1@test.com',
    'test2@test.com',
    'aaron@test.com',
    'alex@test.com',
    'jason@test.com',
  ];
  for (const email of users) {
    try {
      await prisma.user.signUp(email, 'password');
    } catch (e) {
      if (!(e instanceof UserAlreadyExistsError)) throw e;
    }
  }
}

async function createCategory() {
  const count = await prisma.category.count();
  if (count > 0) return;
  await prisma.category.create({ data: { name: 'Default' } });
  await prisma.category.create({ data: { name: 'Study' } });
  await prisma.category.create({ data: { name: 'Work' } });
  await prisma.category.create({ data: { name: 'Personal' } });
  await prisma.category.create({ data: { name: 'Other' } });
}

async function createTodo() {
  const count = await prisma.todo.count();
  if (count > 0) return;
  await prisma.todo.createMany({
    data: [
      { title: 'Learn Hono', categoryId: 2 },
      { title: 'Learn Prisma', categoryId: 2 },
      { title: 'Learn Bun', categoryId: 2 },
      { title: 'Finish Project', categoryId: 3 },
      { title: 'Buy Groceries', categoryId: 4 },
      {
        title: 'Lorem dolor esse exercitation enim',
        categoryId: 5,
      },
      {
        title: 'Lorem ipsum dolor sit amet consectetur adipisicing elit. Quisquam, quos.',
        categoryId: 5,
      },
      {
        title: 'Culpa nulla deserunt ex nisi exercitation elit ad sint do aliquip in non.',
        categoryId: 5,
      },
    ],
  });
}

async function updateTodoUser() {
  await prisma.$transaction(async (tx) => {
    const user1 = await tx.user.findUnique({
      where: { email: 'aaron@test.com' },
    });
    const user2 = await tx.user.findUnique({
      where: { email: 'alex@test.com' },
    });
    const todos = await tx.todo.findMany();
    for (const todo of todos.slice(0, todos.length / 2)) {
      await tx.todo.update({
        where: { id: todo.id },
        data: { userId: user1?.id },
      });
    }
    for (const todo of todos.slice(todos.length / 2)) {
      await tx.todo.update({
        where: { id: todo.id },
        data: { userId: user2?.id },
      });
    }
  });
}

async function createPostsAndComments() {
  const count = await prisma.post.count();
  if (count > 0) return;
  await prisma.$transaction(async (tx) => {
    const aaron = await tx.user.findUnique({ where: { email: 'aaron@test.com' } });
    const alex = await tx.user.findUnique({ where: { email: 'alex@test.com' } });
    const jason = await tx.user.findUnique({ where: { email: 'jason@test.com' } });

    const posts = await Promise.all([
      tx.post.create({
        data: {
          title: 'Getting Started with Hono',
          content:
            'Hono is a lightweight web framework built for the edge. It runs on Cloudflare Workers, Deno, Bun, and more. Its API is similar to Express but designed for speed and modern runtimes.',
          published: true,
          authorId: aaron!.id,
        },
      }),
      tx.post.create({
        data: {
          title: 'Why Bun is Fast',
          content:
            'Bun is a JavaScript runtime written in Zig. It uses JavaScriptCore instead of V8, ships with a built-in bundler, test runner, and package manager. Startup times are dramatically lower than Node.js.',
          published: true,
          authorId: aaron!.id,
        },
      }),
      tx.post.create({
        data: {
          title: 'Prisma ORM Deep Dive',
          content:
            'Prisma provides a type-safe query builder generated from your schema. With the pg adapter you can use a connection pool directly, bypassing the query engine binary entirely in certain runtimes.',
          published: true,
          authorId: alex!.id,
        },
      }),
      tx.post.create({
        data: {
          title: 'JWT Authentication Patterns',
          content:
            'Stateless authentication with JWTs allows horizontal scaling without shared session storage. Common patterns include short-lived access tokens paired with longer-lived refresh tokens stored in HttpOnly cookies.',
          published: true,
          authorId: alex!.id,
        },
      }),
      tx.post.create({
        data: {
          title: 'Draft: GraphQL vs REST Tradeoffs',
          content:
            'GraphQL solves over-fetching and under-fetching but introduces complexity around caching, error handling, and tooling. REST is simpler to cache and monitor. The right choice depends on your client diversity.',
          published: false,
          authorId: jason!.id,
        },
      }),
    ]);

    // Comments on published posts
    await tx.comment.createMany({
      data: [
        { content: 'Great intro! The edge deployment story is really compelling.', postId: posts[0].id, authorId: alex!.id },
        { content: 'Does this work with Deno Deploy as well?', postId: posts[0].id, authorId: jason!.id },
        { content: 'Yes, Hono has first-class Deno support.', postId: posts[0].id, authorId: aaron!.id },

        { content: 'The startup time improvement is massive. Switched our CLI tools to Bun.', postId: posts[1].id, authorId: jason!.id },
        { content: 'JavaScriptCore compatibility has been surprisingly solid in my experience.', postId: posts[1].id, authorId: alex!.id },

        { content: 'The generated types make refactoring so much safer.', postId: posts[2].id, authorId: aaron!.id },
        { content: 'Have you tried the pg adapter with pgBouncer in transaction mode?', postId: posts[2].id, authorId: jason!.id },

        { content: 'Solid overview. One tip: set the access token TTL to 15 minutes max.', postId: posts[3].id, authorId: jason!.id },
        { content: 'What do you recommend for token rotation on refresh?', postId: posts[3].id, authorId: aaron!.id },
      ],
    });
  });
}

async function seed() {
  await createUser();
  await createCategory();
  await createTodo();
  await updateTodoUser();
  await createPostsAndComments();
}

seed()
  .then(() => console.log('Seed complete'))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
