import { ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import RedisMock from 'ioredis-mock';

import { RedisService } from '@common/redis/redis.service';

// Use ioredis-mock to mock ioredis
jest.mock('ioredis', () => RedisMock);

describe('RedisService', () => {
  let service: RedisService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RedisService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string) => {
              if (key === 'REDIS_HOST') return 'localhost';
              if (key === 'REDIS_PORT') return 6379;
              return null;
            }),
          },
        },
      ],
    }).compile();

    service = module.get<RedisService>(RedisService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('onModuleDestroy', () => {
    it('should quit Redis client on module destroy', async () => {
      const quitSpy = jest.spyOn(service['client'], 'quit').mockResolvedValue('OK');

      await service.onModuleDestroy();

      expect(quitSpy).toHaveBeenCalled();
    });
  });

  describe('setChild', () => {
    it('should set a value in Redis hash', async () => {
      const parentKey = 'parent';
      const childKey = 'child';
      const value = { test: 'value' };

      const hsetSpy = jest.spyOn(service['client'], 'hset').mockResolvedValue(1);

      await service.setChild(parentKey, childKey, value);

      expect(hsetSpy).toHaveBeenCalledWith(parentKey, childKey, JSON.stringify(value));
    });
  });

  describe('getChild', () => {
    it('should return parsed object when value exists', async () => {
      const parentKey = 'parent';
      const childKey = 'child';
      const mockValue = JSON.stringify({ test: 'value' });

      const hgetSpy = jest.spyOn(service['client'], 'hget').mockResolvedValue(mockValue);

      const result = await service.getChild(parentKey, childKey);

      expect(hgetSpy).toHaveBeenCalledWith(parentKey, childKey);
      expect(result).toEqual({ test: 'value' });
    });

    it('should return null when value does not exist', async () => {
      const parentKey = 'parent';
      const childKey = 'child';

      const hgetSpy = jest.spyOn(service['client'], 'hget').mockResolvedValue(null);

      const result = await service.getChild(parentKey, childKey);

      expect(hgetSpy).toHaveBeenCalledWith(parentKey, childKey);
      expect(result).toBeNull();
    });

    it('should return raw string when value is not JSON parsable', async () => {
      const parentKey = 'parent';
      const childKey = 'child';
      const mockValue = 'not-json';

      const hgetSpy = jest.spyOn(service['client'], 'hget').mockResolvedValue(mockValue);

      const result = await service.getChild(parentKey, childKey);

      expect(hgetSpy).toHaveBeenCalledWith(parentKey, childKey);
      expect(result).toBe('not-json');
    });
  });

  describe('getAllChildren', () => {
    it('should return all children as parsed objects', async () => {
      const parentKey = 'parent';
      const mockData = {
        child1: JSON.stringify({ id: 1 }),
        child2: JSON.stringify({ id: 2 }),
      };

      const hgetallSpy = jest.spyOn(service['client'], 'hgetall').mockResolvedValue(mockData);

      const result = await service.getAllChildren(parentKey);

      expect(hgetallSpy).toHaveBeenCalledWith(parentKey);
      expect(result).toEqual({
        child1: { id: 1 },
        child2: { id: 2 },
      });
    });
  });

  describe('deleteChild', () => {
    it('should delete a child from Redis hash', async () => {
      const parentKey = 'parent';
      const childKey = 'child';

      const hdelSpy = jest.spyOn(service['client'], 'hdel').mockResolvedValue(1);

      await service.deleteChild(parentKey, childKey);

      expect(hdelSpy).toHaveBeenCalledWith(parentKey, childKey);
    });
  });

  describe('deleteParent', () => {
    it('should delete the entire parent key', async () => {
      const parentKey = 'parent';

      const delSpy = jest.spyOn(service['client'], 'del').mockResolvedValue(1);

      await service.deleteParent(parentKey);

      expect(delSpy).toHaveBeenCalledWith(parentKey);
    });
  });
});
