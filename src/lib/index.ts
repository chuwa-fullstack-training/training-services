import dayjs from 'dayjs';
import { PrismaClient, Prisma } from '@prisma/client';
import {
  AppError,
  InvalidUserDataError,
  UserAlreadyExistsError
} from './errors';

export const formatDate = (
  date: Date | string = new Date(),
  format = 'MM/DD/YYYY HH:mm:ss'
) => dayjs(date).format(format);

export const prisma = new PrismaClient().$extends({
  model: {
    user: {
      async signUp(email: string, password: string) {
        try {
          if (!email || !password) {
            throw new InvalidUserDataError({
              email: !email ? 'Email is required' : undefined,
              password: !password ? 'Password is required' : undefined
            });
          }
          if (!email.includes('@')) {
            throw new InvalidUserDataError({
              email: 'Invalid email'
            });
          }
          return await prisma.user.create({
            data: {
              email,
              password: await Bun.password.hash(password, {
                algorithm: 'bcrypt',
                cost: 10
              })
            }
          });
        } catch (error) {
          if (error instanceof Prisma.PrismaClientKnownRequestError) {
            switch (error.code) {
              case 'P2002':
                throw new UserAlreadyExistsError(email);
              default:
                throw new AppError(
                  'Database operation failed',
                  'DATABASE_ERROR',
                  500,
                  { originalError: error.message }
                );
            }
          }
          if (error instanceof AppError) {
            throw error;
          }
          throw new AppError(
            'An unexpected error occurred',
            'UNKNOWN_ERROR',
            500,
            {
              originalError:
                error instanceof Error ? error.message : String(error)
            }
          );
        }
      }
    }
  }
});
