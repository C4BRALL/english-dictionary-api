export interface DictionaryLicense {
  name: string;
  url: string;
}

export interface DictionaryPhonetic {
  text?: string;
  audio?: string;
  sourceUrl?: string;
  license?: DictionaryLicense;
}

export interface DictionaryDefinition {
  definition: string;
  example?: string;
  synonyms: string[];
  antonyms: string[];
}

export interface DictionaryMeaning {
  partOfSpeech: string;
  definitions: DictionaryDefinition[];
  synonyms: string[];
  antonyms: string[];
}

export interface DictionaryEntry {
  word: string;
  phonetic?: string;
  phonetics: DictionaryPhonetic[];
  meanings: DictionaryMeaning[];
  license?: DictionaryLicense;
  sourceUrls: string[];
}

export type CacheStatus = 'HIT' | 'MISS';

export interface CachedResult<T> {
  data: T;
  cacheStatus: CacheStatus;
}
