import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { Request } from 'express';

export const OriginUrl = createParamDecorator((data: unknown, ctx: ExecutionContext) => {
  const request = ctx.switchToHttp().getRequest<Request>();
  return `${request.protocol}://${request.get('Host')}`;
});
