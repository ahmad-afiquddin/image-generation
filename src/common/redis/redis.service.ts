import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

@Injectable()
export class RedisService {
  private readonly logger = new Logger(RedisService.name);
  private client: Redis;

  constructor(private readonly configService: ConfigService) {
    this.client = new Redis({
      host: this.configService.get<string>('REDIS_HOST'),
      port: this.configService.get<number>('REDIS_PORT'),
    });
  }

  async onModuleDestroy() {
    await this.client.quit();
  }

  async setChild(parentKey: string, childKey: string, value: any) {
    try {
      // if object
      value = JSON.stringify(value);
    } finally {
      await this.client.hset(parentKey, childKey, value as string);
    }
  }

  async getChild<T>(parentKey: string, childKey: string): Promise<T | string | null> {
    const value = await this.client.hget(parentKey, childKey);
    if (!value) {
      return null;
    }
    try {
      return JSON.parse(value) as T;
    } catch {
      return value;
    }
  }

  async getAllChildren<T>(parentKey: string): Promise<Record<string, T>> {
    const children = await this.client.hgetall(parentKey);
    const formattedObj: Record<string, T> = {};

    for (const [key, value] of Object.entries(children)) {
      formattedObj[key] = JSON.parse(value) as T;
    }

    return formattedObj;
  }

  async deleteChild(parentKey: string, childKey: string) {
    return await this.client.hdel(parentKey, childKey);
  }

  async deleteParent(parentKey: string) {
    return await this.client.del(parentKey);
  }
}
