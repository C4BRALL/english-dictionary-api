import { randomUUID } from 'node:crypto';

import { Injectable, type NestMiddleware } from '@nestjs/common';
import type { NextFunction, Response } from 'express';

import type { AuthenticatedRequest } from './request-context.js';

@Injectable()
export class CorrelationIdMiddleware implements NestMiddleware {
  use(request: AuthenticatedRequest, response: Response, next: NextFunction): void {
    const incoming = request.header('x-correlation-id');
    const correlationId = incoming && incoming.length <= 128 ? incoming : randomUUID();

    request.correlationId = correlationId;
    response.setHeader('x-correlation-id', correlationId);
    next();
  }
}
