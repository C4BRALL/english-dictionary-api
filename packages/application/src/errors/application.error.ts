export class ApplicationError extends Error {
  constructor(
    message: string,
    readonly code: 'CONFLICT' | 'INVALID_CREDENTIALS' | 'NOT_FOUND' | 'VALIDATION',
  ) {
    super(message);
    this.name = 'ApplicationError';
  }
}

export class ConflictError extends ApplicationError {
  constructor(message: string) {
    super(message, 'CONFLICT');
  }
}

export class InvalidCredentialsError extends ApplicationError {
  constructor() {
    super('Invalid email or password', 'INVALID_CREDENTIALS');
  }
}

export class ResourceNotFoundError extends ApplicationError {
  constructor(message: string) {
    super(message, 'NOT_FOUND');
  }
}

export class ValidationError extends ApplicationError {
  constructor(message: string) {
    super(message, 'VALIDATION');
  }
}
