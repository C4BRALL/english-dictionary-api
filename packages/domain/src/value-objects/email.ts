import { DomainValidationError } from '../errors/domain-validation.error.js';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export class Email {
  readonly value: string;

  private constructor(value: string) {
    this.value = value;
  }

  static create(value: string): Email {
    const normalized = value.trim().toLowerCase();

    if (!EMAIL_PATTERN.test(normalized) || normalized.length > 254) {
      throw new DomainValidationError('A valid email address is required');
    }

    return new Email(normalized);
  }

  equals(other: Email): boolean {
    return this.value === other.value;
  }

  toString(): string {
    return this.value;
  }
}
