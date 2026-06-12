import { describe, expect, it, vi } from 'vitest';

import { FavoriteJobRouter } from './favorite-job.worker.js';

describe('FavoriteJobRouter', () => {
  const persistFavorite = { execute: vi.fn() };
  const persistUnfavorite = { execute: vi.fn() };
  const router = new FavoriteJobRouter(persistFavorite, persistUnfavorite);

  it('routes favorite additions', async () => {
    await router.process('favorite.add', { userId: 'user-1', word: 'fire' });

    expect(persistFavorite.execute).toHaveBeenCalledWith('user-1', 'fire');
  });

  it('routes favorite removals', async () => {
    await router.process('favorite.remove', { userId: 'user-1', word: 'fire' });

    expect(persistUnfavorite.execute).toHaveBeenCalledWith('user-1', 'fire');
  });

  it('rejects unknown jobs', async () => {
    await expect(
      router.process('favorite.unknown', { userId: 'user-1', word: 'fire' }),
    ).rejects.toThrow('Unsupported favorite job');
  });
});
