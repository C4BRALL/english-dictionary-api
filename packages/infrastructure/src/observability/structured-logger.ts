import { Logtail } from '@logtail/node';
import { LogtailTransport } from '@logtail/winston';
import { createLogger, format, transports, type Logger } from 'winston';

import { sanitizeLogError, sanitizeLogValue } from './log-sanitizer.js';
import { getTransactionContext } from './transaction-context.js';

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';
export type ServiceName = 'api' | 'worker' | 'importer';

export interface LoggingSettings {
  service: ServiceName;
  environment: string;
  level: LogLevel;
  betterStack?: {
    sourceToken: string;
    ingestingUrl: string;
  };
}

export interface LogDetails {
  payload?: unknown;
  response?: unknown;
  error?: unknown;
  durationMs?: number;
  userId?: string;
  [key: string]: unknown;
}

export interface StructuredLogger {
  readonly instance: Logger;
  debug(event: string, details?: LogDetails): void;
  info(event: string, details?: LogDetails): void;
  warn(event: string, details?: LogDetails): void;
  error(event: string, details?: LogDetails): void;
  flush(): Promise<void>;
}

function sanitizeDetails(details: LogDetails): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(details).map(([key, value]) => [
      key,
      key === 'error' ? sanitizeLogError(value) : sanitizeLogValue(value),
    ]),
  );
}

export function createStructuredLogger(settings: LoggingSettings): StructuredLogger {
  const logtail = settings.betterStack
    ? new Logtail(settings.betterStack.sourceToken, {
        endpoint: settings.betterStack.ingestingUrl,
      })
    : undefined;
  const configuredTransports = [
    new transports.Console({
      format: format.json(),
    }),
    ...(logtail ? [new LogtailTransport(logtail)] : []),
  ];
  const instance = createLogger({
    level: settings.level,
    defaultMeta: {
      service: settings.service,
      environment: settings.environment,
    },
    format: format.combine(
      format.timestamp(),
      format.errors({ stack: true }),
      format((info) => {
        info.event ??= 'framework_log';
        return info;
      })(),
      format.json(),
    ),
    transports: configuredTransports,
  });

  const write = (level: LogLevel, event: string, details: LogDetails = {}): void => {
    const context = getTransactionContext();
    instance.log(level, event, {
      event,
      transactionId: context?.transactionId,
      userId: details.userId ?? context?.userId,
      ...sanitizeDetails(details),
    });
  };

  return {
    instance,
    debug: (event, details) => write('debug', event, details),
    info: (event, details) => write('info', event, details),
    warn: (event, details) => write('warn', event, details),
    error: (event, details) => write('error', event, details),
    flush: async () => {
      if (logtail) {
        try {
          await logtail.flush();
        } catch (error) {
          instance.warn('better_stack_flush_failed', {
            event: 'better_stack_flush_failed',
            error: sanitizeLogError(error),
          });
        }
      }
    },
  };
}
