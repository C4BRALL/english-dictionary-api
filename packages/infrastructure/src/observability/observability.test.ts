import { describe, expect, it, vi } from 'vitest';

import { sanitizeLogError, sanitizeLogValue } from './log-sanitizer.js';
import { createStructuredLogger } from './structured-logger.js';
import {
  getTransactionContext,
  runWithTransaction,
  setTransactionUserId,
} from './transaction-context.js';

describe('transaction context', () => {
  it('isolates concurrent transactions and enriches them with user ids', async () => {
    const first = runWithTransaction(
      { transactionId: '11111111-1111-4111-8111-111111111111' },
      async () => {
        await new Promise((resolve) => setTimeout(resolve, 5));
        setTransactionUserId('user-1');
        return getTransactionContext();
      },
    );
    const second = runWithTransaction(
      { transactionId: '22222222-2222-4222-8222-222222222222' },
      async () => {
        await Promise.resolve();
        setTransactionUserId('user-2');
        return getTransactionContext();
      },
    );

    await expect(Promise.all([first, second])).resolves.toEqual([
      {
        transactionId: '11111111-1111-4111-8111-111111111111',
        userId: 'user-1',
      },
      {
        transactionId: '22222222-2222-4222-8222-222222222222',
        userId: 'user-2',
      },
    ]);
  });
});

describe('log sanitizer', () => {
  it('redacts secrets, sanitizes credential URLs, truncates and preserves input', () => {
    const input = {
      password: 'plain-text',
      authorization: 'Bearer header.payload.signature',
      nested: {
        databaseUrl: 'postgresql://user:password@example.test/database',
        long: 'x'.repeat(2_100),
      },
      values: Array.from({ length: 25 }, (_, index) => index),
    };
    const original = structuredClone(input);
    const sanitized = sanitizeLogValue(input);

    expect(sanitized).toMatchObject({
      password: '[REDACTED]',
      authorization: '[REDACTED]',
      nested: {
        databaseUrl: 'postgresql://example.test/database',
      },
    });
    expect(JSON.stringify(sanitized)).toContain('[TRUNCATED]');
    expect(input).toEqual(original);
  });

  it('normalizes errors with code, cause and stack', () => {
    const cause = new Error('connection token=secret');
    const error = Object.assign(new Error('database unavailable'), {
      code: 'ECONNREFUSED',
      cause,
    });

    expect(sanitizeLogError(error)).toMatchObject({
      name: 'Error',
      message: 'database unavailable',
      code: 'ECONNREFUSED',
      cause: {
        name: 'Error',
      },
    });
  });

  it('handles circular, scalar and oversized values', () => {
    const circular: Record<string, unknown> = {
      bigint: 10n,
      date: new Date('2026-06-15T00:00:00.000Z'),
      symbol: Symbol('value'),
      callback: () => undefined,
    };
    circular.self = circular;
    const oversized = Object.fromEntries(
      Array.from({ length: 20 }, (_, index) => [`field${index}`, 'x'.repeat(2_000)]),
    );

    expect(sanitizeLogValue(circular)).toMatchObject({
      bigint: '10',
      date: '2026-06-15T00:00:00.000Z',
      symbol: 'value',
      callback: '[function]',
      self: '[CIRCULAR]',
    });
    const oversizedResult = sanitizeLogValue(oversized) as {
      originalSizeBytes?: unknown;
    };
    expect(typeof oversizedResult.originalSizeBytes).toBe('number');
    expect(sanitizeLogError('failure')).toEqual({ message: 'failure' });
  });
});

describe('structured logger', () => {
  it('adds transaction context and sanitizes payloads before writing', () => {
    const logger = createStructuredLogger({
      service: 'api',
      environment: 'test',
      level: 'debug',
    });
    const log = vi.spyOn(logger.instance, 'log').mockReturnValue(logger.instance);

    runWithTransaction(
      {
        transactionId: '11111111-1111-4111-8111-111111111111',
        userId: 'user-1',
      },
      () => {
        logger.info('test_event', {
          payload: { password: 'secret', value: 'visible' },
          response: { status: 'ok' },
        });
      },
    );

    expect(log).toHaveBeenCalledWith(
      'info',
      'test_event',
      expect.objectContaining({
        event: 'test_event',
        transactionId: '11111111-1111-4111-8111-111111111111',
        userId: 'user-1',
        payload: { password: '[REDACTED]', value: 'visible' },
        response: { status: 'ok' },
      }),
    );
  });
});
