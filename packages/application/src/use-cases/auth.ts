import { Email } from '@english-dictionary/domain';

import { ConflictError, InvalidCredentialsError } from '../errors/application.error.js';
import type { PasswordHasher, TokenIssuer } from '../ports/security.js';
import type { UserRepository } from '../ports/user.repository.js';
import { validateName, validatePassword } from '../services/validation.js';

export interface AuthenticationResult {
  id: string;
  name: string;
  token: string;
}

export interface SignUpCommand {
  name: string;
  email: string;
  password: string;
}

export class SignUp {
  constructor(
    private readonly users: UserRepository,
    private readonly passwordHasher: PasswordHasher,
    private readonly tokenIssuer: TokenIssuer,
  ) {}

  async execute(command: SignUpCommand): Promise<AuthenticationResult> {
    const name = validateName(command.name);
    const email = Email.create(command.email);
    validatePassword(command.password);

    if (await this.users.findByEmail(email)) {
      throw new ConflictError('Email is already registered');
    }

    const passwordHash = await this.passwordHasher.hash(command.password);
    const user = await this.users.create({ name, email, passwordHash });
    const token = await this.tokenIssuer.issue(user.id);

    return { id: user.id, name: user.name, token: `Bearer ${token}` };
  }
}

export interface SignInCommand {
  email: string;
  password: string;
}

export class SignIn {
  constructor(
    private readonly users: UserRepository,
    private readonly passwordHasher: PasswordHasher,
    private readonly tokenIssuer: TokenIssuer,
  ) {}

  async execute(command: SignInCommand): Promise<AuthenticationResult> {
    const email = Email.create(command.email);
    const user = await this.users.findByEmail(email);

    if (!user || !(await this.passwordHasher.verify(user.passwordHash, command.password))) {
      throw new InvalidCredentialsError();
    }

    const token = await this.tokenIssuer.issue(user.id);
    return { id: user.id, name: user.name, token: `Bearer ${token}` };
  }
}
