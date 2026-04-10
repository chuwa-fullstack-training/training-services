import { verify } from 'hono/jwt';
import { GraphQLError } from 'graphql';

const JWT_SECRET = Bun.env.JWT_SECRET!;

export interface GraphQLContext {
  userId: string | null;
  role: string | null;
}

export async function buildContext({ request }: { request: Request }): Promise<GraphQLContext> {
  const authHeader = request.headers.get('Authorization');

  if (!authHeader?.startsWith('Bearer ')) {
    return { userId: null, role: null };
  }

  const token = authHeader.substring(7);

  try {
    const payload = await verify(token, JWT_SECRET, 'HS256');
    if (payload && typeof payload.id === 'string') {
      return {
        userId: payload.id,
        role: typeof payload.role === 'string' ? payload.role : null,
      };
    }
    return { userId: null, role: null };
  } catch {
    return { userId: null, role: null };
  }
}

export function requireAuth(ctx: GraphQLContext): string {
  if (!ctx.userId) {
    throw new GraphQLError('Authentication required', {
      extensions: { code: 'UNAUTHENTICATED' },
    });
  }
  return ctx.userId;
}

export function requireAdmin(ctx: GraphQLContext): void {
  requireAuth(ctx);
  if (ctx.role !== 'ADMIN') {
    throw new GraphQLError('Admin access required', {
      extensions: { code: 'FORBIDDEN' },
    });
  }
}
