import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

/**
 * Service for interacting with Redis
 *
 * Provides a simplified interface for storing and retrieving structured data in Redis,
 * with hierarchical storage using Redis hash maps.
 */
@Injectable()
export class RedisService {
  private readonly logger = new Logger(RedisService.name);
  /** Redis client instance */
  private client: Redis;

  /**
   * Creates a new RedisService instance
   *
   * @param configService - Service to access application configuration
   */
  constructor(private readonly configService: ConfigService) {
    this.client = new Redis({
      host: this.configService.get<string>('REDIS_HOST'),
      port: this.configService.get<number>('REDIS_PORT'),
    });
  }

  /**
   * Lifecycle hook called when the module is being destroyed
   *
   * Gracefully closes the Redis connection
   */
  async onModuleDestroy() {
    await this.client.quit();
  }

  /**
   * Sets a value in a Redis hash map
   *
   * @param parentKey - The hash map key
   * @param childKey - The field within the hash map
   * @param value - The value to store (will be JSON stringified if it's an object)
   */
  async setChild(parentKey: string, childKey: string, value: any) {
    try {
      // if object
      value = JSON.stringify(value);
    } finally {
      await this.client.hset(parentKey, childKey, value as string);
    }
  }

  /**
   * Gets a value from a Redis hash map
   *
   * @param parentKey - The hash map key
   * @param childKey - The field within the hash map
   * @returns The value (parsed from JSON if possible) or null if not found
   */
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

  /**
   * Gets all values from a Redis hash map
   *
   * @param parentKey - The hash map key
   * @returns Object containing all fields and their values (parsed from JSON)
   */
  async getAllChildren<T>(parentKey: string): Promise<Record<string, T>> {
    const children = await this.client.hgetall(parentKey);
    const formattedObj: Record<string, T> = {};

    for (const [key, value] of Object.entries(children)) {
      formattedObj[key] = JSON.parse(value) as T;
    }

    return formattedObj;
  }

  /**
   * Deletes a field from a Redis hash map
   *
   * @param parentKey - The hash map key
   * @param childKey - The field to delete
   * @returns Number of fields removed (0 or 1)
   */
  async deleteChild(parentKey: string, childKey: string) {
    return await this.client.hdel(parentKey, childKey);
  }

  /**
   * Deletes an entire Redis hash map
   *
   * @param parentKey - The hash map key to delete
   * @returns Number of keys removed (0 or 1)
   */
  async deleteParent(parentKey: string) {
    return await this.client.del(parentKey);
  }
}
