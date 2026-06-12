import { Body, Controller, HttpCode, Inject, Post } from '@nestjs/common';
import {
  ApiConflictResponse,
  ApiOkResponse,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { SignIn, SignUp, type AuthenticationResult } from '@english-dictionary/application';

import { SignInDto, SignUpDto } from './auth.dto.js';

@ApiTags('Authentication')
@Controller('auth')
export class AuthController {
  constructor(
    @Inject(SignUp) private readonly signUp: SignUp,
    @Inject(SignIn) private readonly signIn: SignIn,
  ) {}

  @Post('signup')
  @HttpCode(200)
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @ApiOkResponse({
    schema: {
      example: {
        id: 'f3a106sa65dv53ab2c1380acef',
        name: 'User 1',
        token: 'Bearer JWT.Token',
      },
    },
  })
  @ApiConflictResponse({ description: 'Email is already registered' })
  signup(@Body() body: SignUpDto): Promise<AuthenticationResult> {
    return this.signUp.execute(body);
  }

  @Post('signin')
  @HttpCode(200)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @ApiOkResponse({
    schema: {
      example: {
        id: 'f3a106sa65dv53ab2c1380acef',
        name: 'User 1',
        token: 'Bearer JWT.Token',
      },
    },
  })
  @ApiUnauthorizedResponse({ description: 'Invalid email or password' })
  signin(@Body() body: SignInDto): Promise<AuthenticationResult> {
    return this.signIn.execute(body);
  }
}
