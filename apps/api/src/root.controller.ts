import { Controller, Get } from '@nestjs/common';
import { ApiOkResponse, ApiTags } from '@nestjs/swagger';

@ApiTags('Service')
@Controller()
export class RootController {
  @Get()
  @ApiOkResponse({ schema: { example: { message: 'English Dictionary' } } })
  getRoot(): { message: string } {
    return { message: 'English Dictionary' };
  }
}
