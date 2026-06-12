export namespace FavoriteJobs {
  export const queueName = 'favorites';

  export const names = {
    add: 'favorite.add',
    remove: 'favorite.remove',
  } as const;

  export interface Payload {
    userId: string;
    word: string;
  }

  export type Name = (typeof names)[keyof typeof names];
}
