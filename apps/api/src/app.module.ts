import { MiddlewareConsumer, Module, type NestModule } from '@nestjs/common';
import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';

import { AuthController } from './auth/auth.controller.js';
import { AuthGuard } from './common/auth/auth.guard.js';
import { CorrelationIdMiddleware } from './common/http/correlation-id.middleware.js';
import { ResponseTimeInterceptor } from './common/http/response-time.interceptor.js';
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
    AuthGuard,
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: ResponseTimeInterceptor,
    },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(CorrelationIdMiddleware).forRoutes('*');
  }
}
