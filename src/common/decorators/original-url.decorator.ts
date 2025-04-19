import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { Request } from 'express';

/**
 * Parameter decorator that extracts the origin URL from the incoming request
 *
 * @param data - Unused parameter required by NestJS decorator interface
 * @param ctx - The execution context containing the request information
 * @returns A string containing the protocol and host of the request (e.g., 'http://example.com')
 *
 * @example
 * ```typescript
 * @Get()
 * findAll(@OriginUrl() originUrl: string) {
 *   // Use originUrl here
 * }
 * ```
 */
export const OriginUrl = createParamDecorator((data: unknown, ctx: ExecutionContext) => {
  const request = ctx.switchToHttp().getRequest<Request>();
  return `${request.protocol}://${request.get('Host')}`;
});
