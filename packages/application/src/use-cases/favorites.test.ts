import type { FavoriteJobs } from '@english-dictionary/contracts';
import { describe, expect, it, vi } from 'vitest';

import { ResourceNotFoundError } from '../errors/application.error.js';
import type { FavoriteRepository } from '../ports/activity.repositories.js';
import type { FavoriteQueue } from '../ports/favorite.queue.js';
import type { WordRepository } from '../ports/word.repository.js';
import { AddFavorite, PersistFavorite, PersistUnfavorite, RemoveFavorite } from './favorites.js';

function createWords(exists: boolean): WordRepository {
  return {
    list: vi.fn(() => Promise.resolve({ words: [], total: 0 })),
    exists: vi.fn(() => Promise.resolve(exists)),
    insertMany: vi.fn(() => Promise.resolve({ inserted: 0, restored: 0 })),
  };
}

class QueueSpy implements FavoriteQueue {
  readonly jobs: Array<{ name: FavoriteJobs.Name; payload: FavoriteJobs.Payload }> = [];

  dispatch(name: FavoriteJobs.Name, payload: FavoriteJobs.Payload): Promise<void> {
    this.jobs.push({ name, payload });
    return Promise.resolve();
  }
}

class FavoriteRepositorySpy implements FavoriteRepository {
  readonly added: string[] = [];
  readonly removed: string[] = [];

  add(userId: string, word: string): Promise<void> {
    void userId;
    this.added.push(word);
    return Promise.resolve();
  }

  remove(userId: string, word: string): Promise<void> {
    void userId;
    this.removed.push(word);
    return Promise.resolve();
  }

  list(): Promise<never> {
    throw new Error('Not used in this test');
  }
}

describe('favorite use cases', () => {
  it('dispatches idempotent add and remove commands', async () => {
    const queue = new QueueSpy();
    const words = createWords(true);

    await new AddFavorite(words, queue).execute('user-1', 'Fire');
    await new RemoveFavorite(words, queue).execute('user-1', 'Fire');

    expect(queue.jobs).toEqual([
      { name: 'favorite.add', payload: { userId: 'user-1', word: 'fire' } },
      { name: 'favorite.remove', payload: { userId: 'user-1', word: 'fire' } },
    ]);
  });

  it('does not enqueue an unknown word', async () => {
    const queue = new QueueSpy();

    await expect(
      new AddFavorite(createWords(false), queue).execute('user-1', 'missing'),
    ).rejects.toBeInstanceOf(ResourceNotFoundError);
    expect(queue.jobs).toHaveLength(0);
  });

  it('persists worker commands through the repository port', async () => {
    const favorites = new FavoriteRepositorySpy();

    await new PersistFavorite(favorites).execute('user-1', 'Fire');
    await new PersistUnfavorite(favorites).execute('user-1', 'Fire');

    expect(favorites.added).toEqual(['fire']);
    expect(favorites.removed).toEqual(['fire']);
  });
});
