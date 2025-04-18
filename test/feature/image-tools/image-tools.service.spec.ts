import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';

import { WorkerPool } from '@common/jobs/worker-pool';
import { RedisService } from '@common/redis/redis.service';
import { UploadDirEnum } from '@common/storage/constants/storage.constants';
import { StorageService } from '@common/storage/storage.service';

import { ThumbnailCollectionKey } from '@feature/image-tools/constants/image-tools.constants';
import { ImageToolsService } from '@feature/image-tools/image-tools.service';
import { ThumbnailWorkerEvent } from '@feature/image-tools/workers/thumbnail-worker.event';

describe('ImageToolsService', () => {
  let service: ImageToolsService;
  let storageService: jest.Mocked<StorageService>;
  let workerPool: jest.Mocked<WorkerPool>;
  let redisService: jest.Mocked<RedisService>;

  beforeEach(async () => {
    const mockStorageService = {
      saveFileToDir: jest.fn(),
      createFilePath: jest.fn(),
      deleteFile: jest.fn(),
    };

    const mockWorkerPool = {
      postEvent: jest.fn(),
    };

    const mockRedisService = {
      setChild: jest.fn(),
      getChild: jest.fn(),
      getAllChildren: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ImageToolsService,
        { provide: StorageService, useValue: mockStorageService },
        { provide: WorkerPool, useValue: mockWorkerPool },
        { provide: RedisService, useValue: mockRedisService },
      ],
    }).compile();

    service = module.get<ImageToolsService>(ImageToolsService);
    storageService = module.get(StorageService);
    workerPool = module.get(WorkerPool);
    redisService = module.get(RedisService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('generateThumbnail', () => {
    it('should save file and post worker event', async () => {
      const mockFile = {
        originalname: 'test.jpg',
        buffer: Buffer.from('test'),
      } as Express.Multer.File;

      const mockInputFilePath = '/path/to/input/test.jpg';
      const mockOutputFilePath = '/path/to/output/test.jpg';
      const mockFileName = 'test-123456';
      const mockExt = '.jpg';

      storageService.saveFileToDir.mockResolvedValue([mockInputFilePath, mockFileName, mockExt]);
      storageService.createFilePath.mockReturnValue(mockOutputFilePath);
      workerPool.postEvent.mockResolvedValue();

      const result = await service.generateThumbnail(mockFile, 200, 200);

      // Check that file was saved to temp directory
      expect(storageService.saveFileToDir).toHaveBeenCalledWith(mockFile, UploadDirEnum.TEMP);

      // Check that output path was created
      expect(storageService.createFilePath).toHaveBeenCalledWith(UploadDirEnum.OUT, mockExt, mockFileName);

      // Check that worker event was created with correct params
      expect(workerPool.postEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          inputFilePath: mockInputFilePath,
          outputFilePath: mockOutputFilePath,
          sizeX: 200,
          sizeY: 200,
        }),
      );

      // Result should be the worker event ID
      expect(result).toBeDefined();
    });

    it('should throw BadRequestException if worker pool throws', async () => {
      const mockFile = {
        originalname: 'test.jpg',
        buffer: Buffer.from('test'),
      } as Express.Multer.File;

      storageService.saveFileToDir.mockResolvedValue(['/path/to/file', 'filename', '.jpg']);
      workerPool.postEvent.mockRejectedValue(new Error('Worker error'));

      await expect(service.generateThumbnail(mockFile)).rejects.toThrow(BadRequestException);
      expect(workerPool.postEvent).toHaveBeenCalled();
    });
  });

  describe('handleThumbnailSuccess', () => {
    it('should delete input file and save thumbnail data to Redis', async () => {
      const mockEvent = {
        id: 'event-id',
        inputFilePath: '/path/to/input.jpg',
        outputFilePath: '/path/to/output.jpg',
        url: '/out/thumbnail.jpg',
      } as ThumbnailWorkerEvent;

      storageService.deleteFile(mockEvent.outputFilePath);
      redisService.setChild.mockResolvedValue();

      await service.handleThumbnailSuccess(mockEvent);

      // Check that input file was deleted
      expect(storageService.deleteFile).toHaveBeenCalledWith(mockEvent.inputFilePath);

      // Check that thumbnail data was saved to Redis
      expect(redisService.setChild).toHaveBeenCalledWith(
        ThumbnailCollectionKey,
        expect.stringContaining(mockEvent.id),
        {
          outputFilePath: mockEvent.outputFilePath,
          url: mockEvent.url,
        },
      );
    });
  });

  describe('handleThumbnailError', () => {
    it('should delete input file on error', () => {
      const mockError = new Error('Processing error');
      const mockEvent = {
        id: 'event-id',
        inputFilePath: '/path/to/input.jpg',
      } as ThumbnailWorkerEvent;

      void service.handleThumbnailError(mockError, mockEvent);

      expect(storageService.deleteFile).toHaveBeenCalledWith(mockEvent.inputFilePath);
    });
  });

  describe('getAllThumbnails', () => {
    it('should return all thumbnails with transformed URLs', async () => {
      const mockThumbnails = {
        thumb1: { url: '/out/thumb1.jpg', outputFilePath: '/path/to/thumb1.jpg' },
        thumb2: { url: '/out/thumb2.jpg', outputFilePath: '/path/to/thumb2.jpg' },
      };

      redisService.getAllChildren.mockResolvedValue(mockThumbnails);

      const origin = 'http://localhost:3000';
      const result = await service.getAllThumbnails(origin);

      expect(redisService.getAllChildren).toHaveBeenCalledWith(ThumbnailCollectionKey);
      expect(result).toHaveLength(2);
      expect(result[0].url).toBe('http://localhost:3000/out/thumb1.jpg');
      expect(result[1].url).toBe('http://localhost:3000/out/thumb2.jpg');
    });

    it('should return empty array when no thumbnails exist', async () => {
      redisService.getAllChildren.mockResolvedValue({});

      const result = await service.getAllThumbnails('http://localhost:3000');

      expect(result).toEqual([]);
    });
  });

  describe('getThumbnailById', () => {
    it('should return a thumbnail with transformed URL', async () => {
      const mockThumbnail = {
        url: '/out/thumb1.jpg',
        outputFilePath: '/path/to/thumb1.jpg',
      };

      redisService.getChild.mockResolvedValue(mockThumbnail);

      const origin = 'http://localhost:3000';
      const result = await service.getThumbnailById('thumb-id', origin);

      expect(redisService.getChild).toHaveBeenCalledWith(ThumbnailCollectionKey, expect.stringContaining('thumb-id'));
      expect(result.url).toBe('http://localhost:3000/out/thumb1.jpg');
      expect(result.outputFilePath).toBe('/path/to/thumb1.jpg');
    });

    it('should return throw error if thumbnail does not exist', async () => {
      redisService.getChild.mockResolvedValue(null);

      const origin = 'http://localhost:3000';
      await expect(service.getThumbnailById('thumb-id', origin)).rejects.toThrow(NotFoundException);

      expect(redisService.getChild).toHaveBeenCalledWith(ThumbnailCollectionKey, expect.stringContaining('thumb-id'));
    });
  });
});
