import 'reflect-metadata';

import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import type { StructuredLogger } from '@english-dictionary/infrastructure';
import helmet from 'helmet';
import { WINSTON_MODULE_NEST_PROVIDER } from 'nest-winston';

import { AppModule } from './app.module.js';
import { parseEnvironment } from './common/config/environment.js';
import { TOKENS } from './common/di/tokens.js';

async function bootstrap(): Promise<void> {
  const environment = parseEnvironment(process.env);
  const app = await NestFactory.create(AppModule, {
    bufferLogs: true,
  });
  app.useLogger(app.get(WINSTON_MODULE_NEST_PROVIDER));

  app.use(helmet());
  app.enableCors({
    origin: environment.corsOrigins,
    credentials: false,
  });
  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: true,
    }),
  );
  app.enableShutdownHooks();

  const openApiConfig = new DocumentBuilder()
    .setTitle('English Dictionary API')
    .setDescription('Flora Energia backend technical challenge')
    .setVersion('1.0.0')
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, openApiConfig);
  SwaggerModule.setup('docs', app, document, {
    jsonDocumentUrl: 'docs-json',
  });

  await app.listen(environment.port, '0.0.0.0');
  app.get<StructuredLogger>(TOKENS.logger).info('application_started', {
    payload: { port: environment.port },
    response: { status: 'ready' },
  });
}

void bootstrap();
