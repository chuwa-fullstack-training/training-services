import { t } from 'elysia';
import { MessageResponse } from '../types';

export const messageSchema = t.Object({
  message: t.String(),
  status: t.Union([
    t.Literal('success'),
    t.Literal('info'),
    t.Literal('warning'),
    t.Literal('error')
  ]),
  data: t.Optional(t.Any()),
  code: t.Optional(t.Number())
});

export const message = (
  message: string,
  options?: { status?: MessageResponse['status']; data?: unknown; code?: number }
): MessageResponse => {
  return {
    message,
    status: options?.status ?? 'success',
    ...(options?.data && { data: options.data } || {}),
    ...(options?.code && { code: options.code } || {})
  };
};
