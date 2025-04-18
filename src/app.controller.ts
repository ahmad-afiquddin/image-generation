import { Controller, Get } from '@nestjs/common';

@Controller()
export class AppController {
  constructor() {}

  @Get('/status')
  getStatus(): string {
    return 'ok';
  }
}
