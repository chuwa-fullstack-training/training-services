import { verify } from 'hono/jwt';
import { GraphQLError } from 'graphql';

const JWT_SECRET = Bun.env.JWT_SECRET!;

export interface GraphQLContext {
  userId: string | null;
}

export async function buildContext({ request }: { request: Request }): Promise<GraphQLContext> {
  const authHeader = request.headers.get('Authorization');

  if (!authHeader?.startsWith('Bearer ')) {
    return { userId: null };
  }

  const token = authHeader.substring(7);

  try {
    const payload = await verify(token, JWT_SECRET, 'HS256');
    if (payload && typeof payload.id === 'string') {
      return { userId: payload.id };
    }
    return { userId: null };
  } catch {
    return { userId: null };
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
