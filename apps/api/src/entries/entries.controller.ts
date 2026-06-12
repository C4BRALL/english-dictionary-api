import {
  Controller,
  Delete,
  Get,
  HttpCode,
  Inject,
  Param,
  Post,
  Query,
  Res,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import {
  AddFavorite,
  GetWordDetails,
  ListWords,
  RemoveFavorite,
  type DictionaryEntry,
  type PageResult,
} from '@english-dictionary/application';
import type { Response } from 'express';

import { AuthGuard } from '../common/auth/auth.guard.js';
import { CurrentUser } from '../common/auth/current-user.decorator.js';
import { DictionaryQueryDto } from './entries.dto.js';

@ApiTags('Dictionary')
@ApiBearerAuth()
@UseGuards(AuthGuard)
@Controller('entries/en')
export class EntriesController {
  constructor(
    @Inject(ListWords) private readonly listWords: ListWords,
    @Inject(GetWordDetails) private readonly getWordDetails: GetWordDetails,
    @Inject(AddFavorite) private readonly addFavorite: AddFavorite,
    @Inject(RemoveFavorite) private readonly removeFavorite: RemoveFavorite,
  ) {}

  @Get()
  @ApiOkResponse({ description: 'Paginated English words' })
  async list(
    @Query() query: DictionaryQueryDto,
    @Res({ passthrough: true }) response: Response,
  ): Promise<PageResult<string>> {
    const result = await this.listWords.execute(query.search, query);
    response.setHeader('x-cache', result.cacheStatus);
    return result.data;
  }

  @Get(':word')
  @ApiParam({ name: 'word', example: 'fire' })
  @ApiOkResponse({ description: 'Dictionary API word details' })
  async details(
    @CurrentUser() userId: string,
    @Param('word') word: string,
    @Res({ passthrough: true }) response: Response,
  ): Promise<DictionaryEntry[]> {
    const result = await this.getWordDetails.execute(userId, word);
    response.setHeader('x-cache', result.cacheStatus);
    return result.data;
  }

  @Post(':word/favorite')
  @HttpCode(204)
  @ApiNoContentResponse({ description: 'Word added to favorites' })
  async favorite(@CurrentUser() userId: string, @Param('word') word: string): Promise<void> {
    await this.addFavorite.execute(userId, word);
  }

  @Delete(':word/unfavorite')
  @HttpCode(204)
  @ApiNoContentResponse({ description: 'Word removed from favorites' })
  async unfavorite(@CurrentUser() userId: string, @Param('word') word: string): Promise<void> {
    await this.removeFavorite.execute(userId, word);
  }
}
