import { createMiddleware } from 'hono/factory';
import { sign, verify } from 'hono/jwt';
import { getCookie } from 'hono/cookie';

const JWT_SECRET = Bun.env.JWT_SECRET!;

// Type for authenticated context
type AuthVariables = {
  userId: string;
  role: string;
};

/**
 * Required authentication middleware
 * Injects userId into context or returns 401
 */
export const authMiddleware = createMiddleware<{ Variables: AuthVariables }>(async (c, next) => {
  // Try Authorization header first
  const authHeader = c.req.header('Authorization');
  let token: string | undefined;

  if (authHeader?.startsWith('Bearer ')) {
    token = authHeader.substring(7);
  } else {
    // Fall back to cookie
    token = getCookie(c, 'token');
  }

  if (!token) {
    return c.json({ message: 'Authentication required' }, 401);
  }

  try {
    const payload = await verify(token, JWT_SECRET, 'HS256');

    if (!payload || typeof payload.id !== 'string') {
      return c.json({ message: 'Invalid or expired token' }, 401);
    }

    // Set userId and role in context
    c.set('userId', payload.id as string);
    c.set('role', payload.role as string);
    await next();
  } catch (error) {
    return c.json({ message: 'Invalid or expired token' }, 401);
  }
});

/**
 * Optional authentication middleware
 * Sets userId if authenticated, but doesn't require it
 */
export const optionalAuth = createMiddleware<{ Variables: Partial<AuthVariables> }>(
  async (c, next) => {
    const authHeader = c.req.header('Authorization');
    let token: string | undefined;

    if (authHeader?.startsWith('Bearer ')) {
      token = authHeader.substring(7);
    } else {
      token = getCookie(c, 'token');
    }

    if (token) {
      try {
        const payload = await verify(token, JWT_SECRET, 'HS256');
        if (payload && typeof payload.id === 'string') {
          c.set('userId', payload.id as string);
          c.set('role', payload.role as string);
        }
      } catch {
        // Silently ignore invalid tokens for optional auth
      }
    }

    await next();
  }
);

/**
 * Helper to sign JWT tokens
 */
export const signToken = async (userId: string, role: string): Promise<string> => {
  return await sign({ id: userId, role }, JWT_SECRET, 'HS256');
};
