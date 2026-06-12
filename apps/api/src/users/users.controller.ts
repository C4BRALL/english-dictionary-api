import { Controller, Get, Inject, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import {
  GetUserProfile,
  ListFavorites,
  ListHistory,
  type PageResult,
} from '@english-dictionary/application';
import type { HistoryEntry, UserProfile } from '@english-dictionary/domain';

import { AuthGuard } from '../common/auth/auth.guard.js';
import { CurrentUser } from '../common/auth/current-user.decorator.js';
import { ActivityQueryDto } from './users.dto.js';

type PublicActivity = Omit<HistoryEntry, 'userId'>;

@ApiTags('User')
@ApiBearerAuth()
@UseGuards(AuthGuard)
@Controller('user/me')
export class UsersController {
  constructor(
    @Inject(GetUserProfile) private readonly getUserProfile: GetUserProfile,
    @Inject(ListHistory) private readonly listHistory: ListHistory,
    @Inject(ListFavorites) private readonly listFavorites: ListFavorites,
  ) {}

  @Get()
  @ApiOkResponse({ description: 'Authenticated user profile' })
  profile(@CurrentUser() userId: string): Promise<UserProfile> {
    return this.getUserProfile.execute(userId);
  }

  @Get('history')
  @ApiOkResponse({ description: 'Paginated visited words' })
  async history(
    @CurrentUser() userId: string,
    @Query() query: ActivityQueryDto,
  ): Promise<PageResult<PublicActivity>> {
    return this.toPublicPage(await this.listHistory.execute(userId, query));
  }

  @Get('favorites')
  @ApiOkResponse({ description: 'Paginated favorite words' })
  async favorites(
    @CurrentUser() userId: string,
    @Query() query: ActivityQueryDto,
  ): Promise<PageResult<PublicActivity>> {
    return this.toPublicPage(await this.listFavorites.execute(userId, query));
  }

  private toPublicPage(page: PageResult<HistoryEntry>): PageResult<PublicActivity> {
    return {
      ...page,
      results: page.results.map(({ word, added }) => ({ word, added })),
    };
  }
}
