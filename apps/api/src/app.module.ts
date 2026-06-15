import { MiddlewareConsumer, Module, type NestModule } from '@nestjs/common';
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import type { StructuredLogger } from '@english-dictionary/infrastructure';
import { WINSTON_MODULE_NEST_PROVIDER, WINSTON_MODULE_PROVIDER, WinstonLogger } from 'nest-winston';

import { AuthController } from './auth/auth.controller.js';
import { AuthGuard } from './common/auth/auth.guard.js';
import { TOKENS } from './common/di/tokens.js';
import { ApplicationExceptionFilter } from './common/http/application-exception.filter.js';
import { CorrelationIdMiddleware } from './common/http/correlation-id.middleware.js';
import { RequestLoggingInterceptor } from './common/http/request-logging.interceptor.js';
import { CompositionModule } from './composition/composition.module.js';
import { EntriesController } from './entries/entries.controller.js';
import { RootController } from './root.controller.js';
import { UsersController } from './users/users.controller.js';

@Module({
  imports: [
    CompositionModule,
    ThrottlerModule.forRoot([
      {
        ttl: 60_000,
        limit: 100,
      },
    ]),
  ],
  controllers: [RootController, AuthController, EntriesController, UsersController],
  providers: [
    {
      provide: WINSTON_MODULE_PROVIDER,
      inject: [TOKENS.logger],
      useFactory: (logger: StructuredLogger) => logger.instance,
    },
    {
      provide: WINSTON_MODULE_NEST_PROVIDER,
      inject: [TOKENS.logger],
      useFactory: (logger: StructuredLogger) => new WinstonLogger(logger.instance),
    },
    AuthGuard,
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: RequestLoggingInterceptor,
    },
    {
      provide: APP_FILTER,
      useClass: ApplicationExceptionFilter,
    },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(CorrelationIdMiddleware).forRoutes('*');
  }
}
