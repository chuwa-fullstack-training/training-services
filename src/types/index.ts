export type MessageResponse = {
  message: string;
  status: 'success' | 'info' | 'warning' | 'error';
  data?: unknown;
  code?: number;
};
