import { t } from 'elysia';
import { MessageResponse } from '../types';

export const messageSchema = t.Object({
  message: t.String(),
  status: t.Union([
    t.Literal('success'),
    t.Literal('info'),
    t.Literal('warning'),
  ]),
  data: t.Optional(t.Any())
});

export const errorSchema = t.Object({
  message: t.String(),
  data: t.Optional(t.Any())
});

export const message = (
  message: string,
  options?: { status?: MessageResponse['status']; data?: unknown }
): MessageResponse => {
  return {
    message,
    status: options?.status ?? 'success',
    ...((options?.data && { data: options.data }) || {})
  };
};
