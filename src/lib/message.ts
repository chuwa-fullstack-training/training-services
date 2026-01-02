import { z } from 'zod';
import type { MessageResponse } from '../types';

// Zod schemas (replace TypeBox)
export const messageSchema = z.object({
  message: z.string(),
  status: z.enum(['success', 'info', 'warning', 'error']),
  data: z.any().optional(),
});

export const errorSchema = z.object({
  message: z.string(),
  data: z.any().optional(),
});

// Helper function (unchanged logic)
export const message = (
  message: string,
  options?: { status?: MessageResponse['status']; data?: unknown }
): MessageResponse => {
  return {
    message,
    status: options?.status ?? 'success',
    ...((options?.data && { data: options.data }) || {}),
  };
};
