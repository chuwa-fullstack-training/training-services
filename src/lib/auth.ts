import { Elysia } from 'elysia';
import { jwt } from '@elysiajs/jwt';
import { cookie } from '@elysiajs/cookie';

/**
 * Authentication middleware for Elysia
 * Verifies JWT tokens and requires authentication
 */
export const authMiddleware = new Elysia({ name: 'auth' })
  .use(jwt({ name: 'jwt', secret: Bun.env.JWT_SECRET! }))
  .use(cookie())
  .resolve(async ({ jwt, cookie, headers, set }) => {
    const authHeader = headers['authorization'];
    let token: string | undefined;

    if (authHeader?.startsWith('Bearer ')) {
      token = authHeader.substring(7);
    } else {
      token = cookie.token?.value as string | undefined;
    }

    if (!token) {
      set.status = 401;
      throw new Error('Authentication required');
    }

    const payload = await jwt.verify(token);
    if (!payload || typeof payload.id !== 'string') {
      set.status = 401;
      throw new Error('Invalid or expired token');
    }

    return {
      userId: payload.id as string
    };
  });

/**
 * Optional authentication - provides userId if authenticated, but doesn't require it
 */
export const optionalAuth = new Elysia({ name: 'optional-auth' })
  .use(
    jwt({
      name: 'jwt',
      secret: Bun.env.JWT_SECRET!
    })
  )
  .use(cookie())
  .derive(async ({ jwt, cookie, headers }) => {
    const authHeader = headers['authorization'];
    let token: string | undefined;

    if (authHeader?.startsWith('Bearer ')) {
      token = authHeader.substring(7);
    } else {
      token = cookie.token?.value as string | undefined;
    }

    if (!token) {
      return { userId: undefined };
    }

    const payload = await jwt.verify(token);
    if (!payload || typeof payload.id !== 'string') {
      return { userId: undefined };
    }

    return {
      userId: payload.id as string
    };
  });
