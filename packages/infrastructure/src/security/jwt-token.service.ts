import type { TokenIssuer, TokenVerifier } from '@english-dictionary/application';
import { jwtVerify, SignJWT } from 'jose';

export interface JwtSettings {
  secret: string;
  issuer: string;
  audience: string;
  expiresIn: string;
}

export class JwtTokenService implements TokenIssuer, TokenVerifier {
  private readonly key: Uint8Array;

  constructor(private readonly settings: JwtSettings) {
    this.key = new TextEncoder().encode(settings.secret);
  }

  issue(subject: string): Promise<string> {
    return new SignJWT()
      .setProtectedHeader({ alg: 'HS256' })
      .setSubject(subject)
      .setIssuedAt()
      .setIssuer(this.settings.issuer)
      .setAudience(this.settings.audience)
      .setExpirationTime(this.settings.expiresIn)
      .sign(this.key);
  }

  async verify(token: string): Promise<string> {
    const { payload } = await jwtVerify(token, this.key, {
      issuer: this.settings.issuer,
      audience: this.settings.audience,
    });

    if (!payload.sub) {
      throw new Error('Token subject is missing');
    }

    return payload.sub;
  }
}
