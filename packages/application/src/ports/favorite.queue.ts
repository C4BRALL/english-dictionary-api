import type { FavoriteJobs } from '@english-dictionary/contracts';

export interface FavoriteQueue {
  dispatch(name: FavoriteJobs.Name, payload: FavoriteJobs.Payload): Promise<void>;
}
