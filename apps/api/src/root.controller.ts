import { Controller, Get } from '@nestjs/common';

@Controller()
export class RootController {
  @Get()
  getRoot(): { message: string } {
    return { message: 'English Dictionary' };
  }
}
