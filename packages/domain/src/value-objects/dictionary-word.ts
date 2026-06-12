import { DomainValidationError } from '../errors/domain-validation.error.js';

const WORD_PATTERN = /^[a-z]+(?:['-][a-z]+)*$/;

export class DictionaryWord {
  readonly value: string;

  private constructor(value: string) {
    this.value = value;
  }

  static create(value: string): DictionaryWord {
    const normalized = value.trim().toLowerCase();

    if (!WORD_PATTERN.test(normalized) || normalized.length > 128) {
      throw new DomainValidationError('A valid English word is required');
    }

    return new DictionaryWord(normalized);
  }

  equals(other: DictionaryWord): boolean {
    return this.value === other.value;
  }

  toString(): string {
    return this.value;
  }
}
