import {
  ArgumentsHost,
  Catch,
  ConsoleLogger,
  HttpException,
  HttpStatus,
  type ExceptionFilter,
} from '@nestjs/common';
import { ApplicationError } from '@english-dictionary/application';
import { DomainValidationError } from '@english-dictionary/domain';
import type { Response } from 'express';

import type { AuthenticatedRequest } from './request-context.js';

@Catch()
export class ApplicationExceptionFilter implements ExceptionFilter {
  private readonly logger = new ConsoleLogger(ApplicationExceptionFilter.name, {
    json: true,
  });

  catch(exception: unknown, host: ArgumentsHost): void {
    const http = host.switchToHttp();
    const response = http.getResponse<Response>();
    const request = http.getRequest<AuthenticatedRequest>();
    const { status, message } = this.toHttpError(exception);

    if (status >= 500) {
      this.logger.error({
        event: 'request_failed',
        correlationId: request.correlationId,
        method: request.method,
        path: request.originalUrl,
        error: exception instanceof Error ? exception.message : 'Unknown error',
        stack: exception instanceof Error ? exception.stack : undefined,
      });
    }

    response.status(status).json({ message });
  }

  private toHttpError(exception: unknown): { status: number; message: string } {
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
}
