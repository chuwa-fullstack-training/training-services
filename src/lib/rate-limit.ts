import { rateLimiter } from 'hono-rate-limiter';
import type { Context } from 'hono';

/**
 * Rate Limiting Configuration
 *
 * Three-tier approach:
 * 1. Auth endpoints: 100 req/15min (brute force protection)
 * 2. Authenticated API: 1000 req/15min (per user)
 * 3. Public endpoints: 500 req/15min (per IP)
 */

// Auth endpoints rate limiter (stricter - protect against brute force)
export const authRateLimiter = rateLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutes
  limit: 100, // 100 requests per window
  standardHeaders: 'draft-6', // Set RateLimit headers
  keyGenerator: (c: Context) => {
    // Use IP address for rate limiting
    return c.req.header('x-forwarded-for') || c.req.header('x-real-ip') || 'unknown';
  },
  handler: (c: Context) => {
    return c.json(
      {
        message: 'Too many authentication attempts. Please try again later.',
        retryAfter: Math.ceil((c.get('ratelimit-reset') - Date.now()) / 1000),
      },
      429
    );
  },
});

// Authenticated API rate limiter (user-based)
export const apiRateLimiter = rateLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutes
  limit: 1000, // 1000 requests per window per user
  standardHeaders: 'draft-6',
  keyGenerator: (c: Context) => {
    // Use userId if authenticated, otherwise fall back to IP
    const userId = c.get('userId');
    if (userId) {
      return `user:${userId}`;
    }
    return c.req.header('x-forwarded-for') || c.req.header('x-real-ip') || 'unknown';
  },
  handler: (c: Context) => {
    return c.json(
      {
        message: 'Too many requests. Please slow down.',
        retryAfter: Math.ceil((c.get('ratelimit-reset') - Date.now()) / 1000),
      },
      429
    );
  },
});

// Public endpoints rate limiter (moderate)
export const publicRateLimiter = rateLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutes
  limit: 500, // 500 requests per window per IP
  standardHeaders: 'draft-6',
  keyGenerator: (c: Context) => {
    return c.req.header('x-forwarded-for') || c.req.header('x-real-ip') || 'unknown';
  },
  handler: (c: Context) => {
    return c.json(
      {
        message: 'Too many requests. Please try again later.',
        retryAfter: Math.ceil((c.get('ratelimit-reset') - Date.now()) / 1000),
      },
      429
    );
  },
});

/**
 * Production Note:
 *
 * For distributed systems (multiple servers), replace the in-memory store
 * with Redis using hono-rate-limiter's Redis store:
 *
 * import { RedisStore } from 'hono-rate-limiter/store/redis';
 * import Redis from 'ioredis';
 *
 * const redis = new Redis(process.env.REDIS_URL);
 *
 * export const authRateLimiter = rateLimiter({
 *   windowMs: 15 * 60 * 1000,
 *   limit: 100,
 *   store: new RedisStore({ client: redis }),
 *   // ... rest of config
 * });
 */
