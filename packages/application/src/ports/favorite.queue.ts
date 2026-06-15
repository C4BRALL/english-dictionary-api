import type { FavoriteJobs } from '@english-dictionary/contracts';

export type FavoriteCommandPayload = Omit<FavoriteJobs.Payload, 'transactionId'>;

export interface FavoriteQueue {
  dispatch(name: FavoriteJobs.Name, payload: FavoriteCommandPayload): Promise<void>;
}
