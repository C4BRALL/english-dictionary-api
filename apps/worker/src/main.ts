import 'reflect-metadata';

import { NestFactory } from '@nestjs/core';
import { Module } from '@nestjs/common';

@Module({})
class WorkerModule {}

async function bootstrap(): Promise<void> {
  await NestFactory.createApplicationContext(WorkerModule);
}

void bootstrap();
