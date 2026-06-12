import { FavoriteJobs } from '@english-dictionary/contracts';
import { DictionaryWord, type UserId } from '@english-dictionary/domain';

import { ResourceNotFoundError } from '../errors/application.error.js';
import type { FavoriteRepository } from '../ports/activity.repositories.js';
import type { FavoriteQueue } from '../ports/favorite.queue.js';
import type { WordRepository } from '../ports/word.repository.js';

abstract class DispatchFavoriteCommand {
  protected constructor(
    private readonly words: WordRepository,
    private readonly queue: FavoriteQueue,
    private readonly jobName: FavoriteJobs.Name,
  ) {}

  async execute(userId: UserId, value: string): Promise<void> {
    const word = DictionaryWord.create(value).value;

    if (!(await this.words.exists(word))) {
      throw new ResourceNotFoundError(`Word "${word}" was not found`);
    }

    await this.queue.dispatch(this.jobName, { userId, word });
  }
}

export class AddFavorite extends DispatchFavoriteCommand {
  constructor(words: WordRepository, queue: FavoriteQueue) {
    super(words, queue, FavoriteJobs.names.add);
  }
}

export class RemoveFavorite extends DispatchFavoriteCommand {
  constructor(words: WordRepository, queue: FavoriteQueue) {
    super(words, queue, FavoriteJobs.names.remove);
  }
}

export class PersistFavorite {
  constructor(private readonly favorites: FavoriteRepository) {}

  execute(userId: UserId, word: string): Promise<void> {
    return this.favorites.add(userId, DictionaryWord.create(word).value);
  }
}

export class PersistUnfavorite {
  constructor(private readonly favorites: FavoriteRepository) {}

  execute(userId: UserId, word: string): Promise<void> {
    return this.favorites.remove(userId, DictionaryWord.create(word).value);
  }
}
