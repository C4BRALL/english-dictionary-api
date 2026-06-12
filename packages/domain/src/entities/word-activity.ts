import type { UserId } from './user.js';

export interface WordActivity {
  userId: UserId;
  word: string;
  added: Date;
}

export type HistoryEntry = WordActivity;
export type FavoriteEntry = WordActivity;
