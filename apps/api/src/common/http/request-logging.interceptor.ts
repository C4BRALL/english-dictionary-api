import {
  type CallHandler,
  type ExecutionContext,
  Inject,
  Injectable,
  type NestInterceptor,
} from '@nestjs/common';
import type { StructuredLogger } from '@english-dictionary/infrastructure';
import type { Response } from 'express';
import type { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';

import { TOKENS } from '../di/tokens.js';
import { toHttpError } from './application-exception.filter.js';
import { requestPath, summarizeRequest, summarizeResponse } from './http-log-policy.js';
import type { AuthenticatedRequest } from './request-context.js';

@Injectable()
export class RequestLoggingInterceptor implements NestInterceptor {
  constructor(@Inject(TOKENS.logger) private readonly logger: StructuredLogger) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const startedAt = performance.now();
    const http = context.switchToHttp();
    const request = http.getRequest<AuthenticatedRequest>();
    const response = http.getResponse<Response>();
    const payload = summarizeRequest(request);

    this.logger.info('request_started', {
      payload,
      method: request.method,
      path: requestPath(request),
    });

    return next.handle().pipe(
      tap({
        next: (body) => {
          const durationMs = performance.now() - startedAt;
          response.setHeader('x-response-time', `${durationMs.toFixed(2)}ms`);
          request.loggingCompleted = true;
          this.logger.info('request_completed', {
            durationMs,
            method: request.method,
            path: requestPath(request),
            status: response.statusCode,
            cacheStatus: response.getHeader('x-cache'),
            userId: responseUserId(body),
            payload,
            response: summarizeResponse(request, body),
          });
        },
        error: (error: unknown) => {
          const durationMs = performance.now() - startedAt;
          const httpError = toHttpError(error);
          response.setHeader('x-response-time', `${durationMs.toFixed(2)}ms`);
          request.loggingCompleted = true;
          const details = {
            durationMs,
            method: request.method,
            path: requestPath(request),
            status: httpError.status,
            payload,
            response: httpError,
            error: errorForLog(error, httpError.status),
          };
          if (httpError.status >= 500) {
            this.logger.error('request_failed', details);
          } else {
            this.logger.warn('request_failed', details);
          }
        },
      }),
    );
  }
}

function responseUserId(body: unknown): string | undefined {
  if (
    typeof body === 'object' &&
    body !== null &&
    'id' in body &&
    typeof (body as { id: unknown }).id === 'string'
  ) {
    return (body as { id: string }).id;
  }

  return undefined;
}

function errorForLog(error: unknown, status: number): unknown {
  if (status >= 500 || !(error instanceof Error)) {
    return error;
  }

  const applicationError = error as Error & { code?: unknown };
  return {
    name: error.name,
    message: error.message,
    code: applicationError.code,
  };
}
