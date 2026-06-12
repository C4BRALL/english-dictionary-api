export const CacheKeys = {
  words(search: string, page: number, limit: number): string {
    return `words:${search || '*'}:${page}:${limit}`;
  },

  definition(word: string): string {
    return `definition:${word}`;
  },
};
