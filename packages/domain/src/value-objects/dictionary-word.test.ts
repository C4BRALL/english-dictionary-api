import { describe, expect, it } from 'vitest';

import { DomainValidationError } from '../errors/domain-validation.error.js';
import { DictionaryWord } from './dictionary-word.js';

describe('DictionaryWord', () => {
  it.each([
    [' Fire ', 'fire'],
    ['Mother-in-law', 'mother-in-law'],
    ["Don't", "don't"],
  ])('normalizes %s', (input, expected) => {
    expect(DictionaryWord.create(input).value).toBe(expected);
  });

  it.each(['', 'two words', 'word2', '-word', 'word_'])('rejects invalid word %s', (value) => {
    expect(() => DictionaryWord.create(value)).toThrow(DomainValidationError);
  });

  it('compares and renders normalized words', () => {
    const word = DictionaryWord.create('Fire');

    expect(word.equals(DictionaryWord.create('fire'))).toBe(true);
    expect(word.toString()).toBe('fire');
  });
});
