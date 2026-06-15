import type { Request } from 'express';

export interface AuthenticatedRequest extends Request {
  correlationId: string;
  transactionId: string;
  userId?: string;
  loggingCompleted?: boolean;
}
