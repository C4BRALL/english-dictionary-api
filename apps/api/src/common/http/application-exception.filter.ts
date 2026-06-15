import {
  ArgumentsHost,
  Catch,
  HttpException,
  HttpStatus,
  Inject,
  type ExceptionFilter,
} from '@nestjs/common';
import { ApplicationError } from '@english-dictionary/application';
import { DomainValidationError } from '@english-dictionary/domain';
import type { StructuredLogger } from '@english-dictionary/infrastructure';
import type { Response } from 'express';

import { TOKENS } from '../di/tokens.js';
import { requestPath, summarizeRequest } from './http-log-policy.js';
import type { AuthenticatedRequest } from './request-context.js';

@Catch()
export class ApplicationExceptionFilter implements ExceptionFilter {
  constructor(@Inject(TOKENS.logger) private readonly logger: StructuredLogger) {}

  catch(exception: unknown, host: ArgumentsHost): void {
    const http = host.switchToHttp();
    const response = http.getResponse<Response>();
    const request = http.getRequest<AuthenticatedRequest>();
    const { status, message } = toHttpError(exception);

    if (!request.loggingCompleted) {
      const details = {
        method: request.method,
        path: requestPath(request),
        status,
        payload: summarizeRequest(request),
        response: { status, message },
        error:
          status >= 500 || !(exception instanceof Error)
            ? exception
            : {
                name: exception.name,
                message: exception.message,
                code: (exception as Error & { code?: unknown }).code,
              },
      };
      if (status >= 500) {
        this.logger.error('request_failed', details);
      } else {
        this.logger.warn('request_failed', details);
      }
    }

    response.status(status).json({ message });
  }
}

export function toHttpError(exception: unknown): { status: number; message: string } {
  if (exception instanceof ApplicationError) {
    const statuses: Record<ApplicationError['code'], number> = {
      CONFLICT: HttpStatus.CONFLICT,
      INVALID_CREDENTIALS: HttpStatus.UNAUTHORIZED,
      NOT_FOUND: HttpStatus.NOT_FOUND,
      VALIDATION: HttpStatus.BAD_REQUEST,
    };
    return { status: statuses[exception.code], message: exception.message };
  }

  if (exception instanceof DomainValidationError) {
    return { status: HttpStatus.BAD_REQUEST, message: exception.message };
  }

  if (exception instanceof HttpException) {
    const response = exception.getResponse();
    const rawMessage =
      typeof response === 'object' && response !== null && 'message' in response
        ? (response as { message: unknown }).message
        : exception.message;
    const message = Array.isArray(rawMessage)
      ? rawMessage.map(String).join('; ')
      : String(rawMessage);

    return { status: exception.getStatus(), message };
  }

  return {
    status: HttpStatus.INTERNAL_SERVER_ERROR,
    message: 'Internal server error',
  };
}
