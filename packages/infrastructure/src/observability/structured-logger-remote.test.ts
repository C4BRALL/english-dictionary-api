import { beforeEach, describe, expect, it, vi } from 'vitest';

const logtailState = vi.hoisted(() => ({
  flush: vi.fn<() => Promise<void>>(),
  log: vi.fn(() => Promise.resolve({})),
}));

vi.mock('@logtail/node', () => ({
  Logtail: class {
    flush = logtailState.flush;
    log = logtailState.log;
  },
}));

import { createStructuredLogger } from './structured-logger.js';

describe('structured logger Better Stack transport', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    logtailState.flush.mockResolvedValue(undefined);
  });

  it('creates the remote transport, writes all levels and flushes', async () => {
    const logger = createStructuredLogger({
      service: 'worker',
      environment: 'test',
      level: 'debug',
      betterStack: {
        sourceToken: 'source-token',
        ingestingUrl: 'https://example.test',
      },
    });
    const log = vi.spyOn(logger.instance, 'log').mockReturnValue(logger.instance);

    logger.debug('debug_event');
    logger.info('info_event');
    logger.warn('warn_event');
    logger.error('error_event');
    await logger.flush();

    expect(log).toHaveBeenCalledTimes(4);
    expect(logtailState.flush).toHaveBeenCalledOnce();
  });

  it('does not throw when the remote flush fails', async () => {
    const logger = createStructuredLogger({
      service: 'importer',
      environment: 'test',
      level: 'info',
      betterStack: {
        sourceToken: 'source-token',
        ingestingUrl: 'https://example.test',
      },
    });
    const warn = vi.spyOn(logger.instance, 'warn').mockReturnValue(logger.instance);
    logtailState.flush.mockRejectedValueOnce(new Error('network unavailable'));

    await expect(logger.flush()).resolves.toBeUndefined();
    expect(warn).toHaveBeenCalledWith(
      'better_stack_flush_failed',
      expect.objectContaining({ event: 'better_stack_flush_failed' }),
    );
  });
});
