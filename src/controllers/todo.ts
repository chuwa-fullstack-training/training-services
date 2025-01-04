// import { Todo } from '@prisma/client';
// import { prisma, formatDate } from '../libs';
// import { Context } from 'elysia';

// export const getTodos = async () => {
//   const todos = await prisma.todo.findMany();
//   return todos.map(todo => ({
//     ...todo,
//     userId: todo.userId ?? '',
//     createdAt: formatDate(todo.createdAt),
//     updatedAt: formatDate(todo.updatedAt)
//   }));
// };

// export const getTodo = async (id: string) => {
//   const todo = await prisma.todo.findUnique({ where: { id } });
//   return todo;
// };

// export const createTodo = async (context: Context) => {
//   const { body } = context;
//   const { categoryId } = body;
//       if (!categoryId) {
//         const category = await prisma.category.findFirst();
//         if (!category) throw new Error('No category');
//         body.categoryId = category.id;
//       }
//       return await prisma.todo.create({
//         data: {
//           title: body.title,
//           completed: body.completed,
//           categoryId: +body.categoryId!
//         }
//       });
// };

// export const updateTodo = async (id: string, todo: Todo) => {
//   const updatedTodo = await prisma.todo.update({ where: { id }, data: todo });
//   return updatedTodo;
// };

// export const deleteTodo = async (id: string) => {
//   const deletedTodo = await prisma.todo.delete({ where: { id } });
//   return deletedTodo;
// };
