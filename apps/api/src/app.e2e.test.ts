import type { Server } from 'node:http';

import { ValidationPipe } from '@nestjs/common';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import {
  AddFavorite,
  GetUserProfile,
  GetWordDetails,
  ListFavorites,
  ListHistory,
  ListWords,
  RemoveFavorite,
  SignIn,
  SignUp,
  type TokenVerifier,
} from '@english-dictionary/application';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import type { NextFunction, Request, Response } from 'express';
import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { AuthController } from './auth/auth.controller.js';
import { SignUpDto } from './auth/auth.dto.js';
import { AuthGuard } from './common/auth/auth.guard.js';
import { TOKENS } from './common/di/tokens.js';
import { ApplicationExceptionFilter } from './common/http/application-exception.filter.js';
import { CorrelationIdMiddleware } from './common/http/correlation-id.middleware.js';
import type { AuthenticatedRequest } from './common/http/request-context.js';
import { ResponseTimeInterceptor } from './common/http/response-time.interceptor.js';
import { EntriesController } from './entries/entries.controller.js';
import { RootController } from './root.controller.js';
import { UsersController } from './users/users.controller.js';

describe('HTTP API', () => {
  let app: INestApplication;

  const signUp = { execute: vi.fn() };
  const signIn = { execute: vi.fn() };
  const listWords = { execute: vi.fn() };
  const getWordDetails = { execute: vi.fn() };
  const addFavorite = { execute: vi.fn() };
  const removeFavorite = { execute: vi.fn() };
  const getUserProfile = { execute: vi.fn() };
  const listHistory = { execute: vi.fn() };
  const listFavorites = { execute: vi.fn() };
  const tokens: TokenVerifier = { verify: vi.fn() };

  beforeEach(async () => {
    vi.clearAllMocks();
    const module = await Test.createTestingModule({
      controllers: [RootController, AuthController, EntriesController, UsersController],
      providers: [
        AuthGuard,
        { provide: TOKENS.tokens, useValue: tokens },
        { provide: SignUp, useValue: signUp },
        { provide: SignIn, useValue: signIn },
        { provide: ListWords, useValue: listWords },
        { provide: GetWordDetails, useValue: getWordDetails },
        { provide: AddFavorite, useValue: addFavorite },
        { provide: RemoveFavorite, useValue: removeFavorite },
        { provide: GetUserProfile, useValue: getUserProfile },
        { provide: ListHistory, useValue: listHistory },
        { provide: ListFavorites, useValue: listFavorites },
      ],
    }).compile();

    app = module.createNestApplication();
    const correlationId = new CorrelationIdMiddleware();
    app.use((incoming: Request, response: Response, next: NextFunction) => {
      correlationId.use(incoming as AuthenticatedRequest, response, next);
    });
    app.useGlobalPipes(
      new ValidationPipe({
        transform: true,
        whitelist: true,
        forbidNonWhitelisted: true,
      }),
    );
    app.useGlobalFilters(new ApplicationExceptionFilter());
    app.useGlobalInterceptors(new ResponseTimeInterceptor());
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  it('exposes the challenge root contract and observability headers', async () => {
    const response = await request(app.getHttpServer() as Server)
      .get('/')
      .expect(200);

    expect(response.body).toEqual({ message: 'English Dictionary' });
    expect(response.headers['x-correlation-id']).toEqual(expect.any(String));
    expect(response.headers['x-response-time']).toMatch(/^\d+\.\d{2}ms$/);
  });

  it('validates signup input before calling the use case', async () => {
    const input = plainToInstance(SignUpDto, {
      name: 'A',
      email: 'invalid',
      password: 'short',
      unexpected: true,
    });
    const errors = await validate(input, {
      whitelist: true,
      forbidNonWhitelisted: true,
    });

    expect(errors.map(({ property }) => property)).toEqual(
      expect.arrayContaining(['name', 'email', 'password', 'unexpected']),
    );
    expect(signUp.execute).not.toHaveBeenCalled();
  });

  it('returns the authentication result without exposing a password', async () => {
    signUp.execute.mockResolvedValue({
      id: 'user-1',
      name: 'User 1',
      token: 'Bearer signed-token',
    });

    const response = await request(app.getHttpServer() as Server)
      .post('/auth/signup')
      .send({ name: 'User 1', email: 'user@example.com', password: 'password123' })
      .expect(200);

    expect(response.body).toEqual({
      id: 'user-1',
      name: 'User 1',
      token: 'Bearer signed-token',
    });
    expect(response.body).not.toHaveProperty('password');
  });

  it('protects dictionary routes with a bearer token', async () => {
    await request(app.getHttpServer() as Server)
      .get('/entries/en?search=fi')
      .expect(401);

    expect(listWords.execute).not.toHaveBeenCalled();
  });

  it('forwards the authenticated user and cache metadata', async () => {
    vi.mocked(tokens.verify).mockResolvedValue('user-1');
    getWordDetails.execute.mockResolvedValue({
      cacheStatus: 'HIT',
      data: [{ word: 'fire', phonetics: [], meanings: [] }],
    });

    const response = await request(app.getHttpServer() as Server)
      .get('/entries/en/fire')
      .set('authorization', 'Bearer signed-token')
      .expect(200);

    expect(tokens.verify).toHaveBeenCalledWith('signed-token');
    expect(getWordDetails.execute).toHaveBeenCalledWith('user-1', 'fire');
    expect(response.headers['x-cache']).toBe('HIT');
  });
});
