import { randomUUID } from 'node:crypto';

import { Injectable, type NestMiddleware } from '@nestjs/common';
import { runWithTransaction } from '@english-dictionary/infrastructure';
import type { NextFunction, Response } from 'express';

import type { AuthenticatedRequest } from './request-context.js';

@Injectable()
export class CorrelationIdMiddleware implements NestMiddleware {
  use(request: AuthenticatedRequest, response: Response, next: NextFunction): void {
    const incoming = request.header('x-transaction-id') ?? request.header('x-correlation-id');
    const transactionId = incoming && isUuid(incoming) ? incoming : randomUUID();

    request.transactionId = transactionId;
    request.correlationId = transactionId;
    response.setHeader('x-transaction-id', transactionId);
    response.setHeader('x-correlation-id', transactionId);
    runWithTransaction({ transactionId }, next);
  }
}

function isUuid(value: string): boolean {
  return (
    value.length <= 128 &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
  );
}
