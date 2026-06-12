import {
  BadRequestException,
  ConsoleLogger,
  type ArgumentsHost,
  HttpException,
} from '@nestjs/common';
import { ConflictError } from '@english-dictionary/application';
import { DomainValidationError } from '@english-dictionary/domain';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ApplicationExceptionFilter } from './application-exception.filter.js';

describe('ApplicationExceptionFilter', () => {
  const status = vi.fn();
  const json = vi.fn();
  const response = { status, json };
  const request = {
    correlationId: 'request-123',
    method: 'GET',
    originalUrl: '/entries/en/fire',
  };
  const host = {
    switchToHttp: () => ({
      getResponse: () => response,
      getRequest: () => request,
    }),
  } as unknown as ArgumentsHost;
  const filter = new ApplicationExceptionFilter();

  beforeEach(() => {
    vi.clearAllMocks();
    status.mockReturnValue(response);
    vi.spyOn(ConsoleLogger.prototype, 'error').mockImplementation(() => undefined);
  });

  it.each([
    [new ConflictError('Email is already registered'), 409, 'Email is already registered'],
    [new DomainValidationError('Invalid word'), 400, 'Invalid word'],
    [new BadRequestException(['first error', 'second error']), 400, 'first error; second error'],
    [new HttpException('Teapot', 418), 418, 'Teapot'],
  ])('maps known exceptions', (exception, expectedStatus, expectedMessage) => {
    filter.catch(exception, host);

    expect(status).toHaveBeenCalledWith(expectedStatus);
    expect(json).toHaveBeenCalledWith({ message: expectedMessage });
  });

  it('hides unexpected error details and logs correlation data', () => {
    filter.catch(new Error('database password leaked'), host);

    expect(status).toHaveBeenCalledWith(500);
    expect(json).toHaveBeenCalledWith({ message: 'Internal server error' });
    expect(ConsoleLogger.prototype.error).toHaveBeenCalledWith(
      expect.objectContaining({
        event: 'request_failed',
        correlationId: 'request-123',
        error: 'database password leaked',
      }),
    );
  });
});
