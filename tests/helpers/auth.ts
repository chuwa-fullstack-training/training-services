import { prisma } from '../../src/lib';
import { signToken } from '../../src/lib/auth';

type UserHandle = {
  id: string;
  email: string;
  token: string;
};

export async function createUser(
  email: string,
  password = 'testpass123'
): Promise<UserHandle> {
  const user = await prisma.user.signUp(email, password);
  const token = await signToken(user.id, user.role);
  return { id: user.id, email: user.email, token };
}

export async function createAdmin(
  email = 'admin@test.com',
  password = 'adminpass123'
): Promise<UserHandle> {
  const hashed = await Bun.password.hash(password, { algorithm: 'bcrypt', cost: 10 });
  const user = await prisma.user.create({
    data: { email, password: hashed, role: 'ADMIN' },
  });
  const token = await signToken(user.id, 'ADMIN');
  return { id: user.id, email: user.email, token };
}

export function authHeader(token: string): Record<string, string> {
  return { Authorization: `Bearer ${token}` };
}
