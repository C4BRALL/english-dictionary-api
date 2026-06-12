import 'reflect-metadata';

import { ConsoleLogger, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';

import { AppModule } from './app.module.js';
import { parseEnvironment } from './common/config/environment.js';
import { ApplicationExceptionFilter } from './common/http/application-exception.filter.js';

async function bootstrap(): Promise<void> {
  const environment = parseEnvironment(process.env);
  const app = await NestFactory.create(AppModule, {
    logger: new ConsoleLogger({ json: environment.nodeEnv !== 'development' }),
  });

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
  app.useGlobalFilters(new ApplicationExceptionFilter());
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
}

void bootstrap();
