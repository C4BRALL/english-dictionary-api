import type { FavoriteEntry, HistoryEntry, UserId, UserProfile } from '@english-dictionary/domain';

import { ResourceNotFoundError } from '../errors/application.error.js';
import type { PageRequest, PageResult } from '../models/pagination.js';
import type { FavoriteRepository, HistoryRepository } from '../ports/activity.repositories.js';
import type { UserRepository } from '../ports/user.repository.js';
import { validatePage } from '../services/validation.js';

export class GetUserProfile {
  constructor(private readonly users: UserRepository) {}

  async execute(userId: UserId): Promise<UserProfile> {
    const user = await this.users.findById(userId);

    if (!user) {
      throw new ResourceNotFoundError('User not found');
    }

    return user.toProfile();
  }
}

export class ListHistory {
  constructor(private readonly history: HistoryRepository) {}

  async execute(userId: UserId, page: PageRequest): Promise<PageResult<HistoryEntry>> {
    return await this.history.list(userId, validatePage(page));
  }
}

export class ListFavorites {
  constructor(private readonly favorites: FavoriteRepository) {}

  async execute(userId: UserId, page: PageRequest): Promise<PageResult<FavoriteEntry>> {
    return await this.favorites.list(userId, validatePage(page));
  }
}
