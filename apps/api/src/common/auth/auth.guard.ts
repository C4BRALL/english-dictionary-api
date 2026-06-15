import {
  CanActivate,
  ExecutionContext,
  Inject,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import type { TokenVerifier } from '@english-dictionary/application';
import { setTransactionUserId } from '@english-dictionary/infrastructure';

import { TOKENS } from '../di/tokens.js';
import type { AuthenticatedRequest } from '../http/request-context.js';

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(@Inject(TOKENS.tokens) private readonly tokens: TokenVerifier) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const authorization = request.header('authorization');
    const [scheme, token] = authorization?.split(' ') ?? [];

    if (scheme?.toLowerCase() !== 'bearer' || !token) {
      throw new UnauthorizedException('A valid bearer token is required');
    }

    try {
      request.userId = await this.tokens.verify(token);
      setTransactionUserId(request.userId);
      return true;
    } catch {
      throw new UnauthorizedException('A valid bearer token is required');
    }
  }
}
