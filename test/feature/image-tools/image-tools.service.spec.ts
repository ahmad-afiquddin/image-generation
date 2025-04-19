import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';

import { WorkerPool } from '@common/jobs/worker-pool';
import { RedisService } from '@common/redis/redis.service';
import { UploadDirEnum } from '@common/storage/constants/storage.constants';
import { MinioService } from '@common/storage/minio.service';
import { StorageService } from '@common/storage/storage.service';

import { ThumbnailCollectionKey } from '@feature/image-tools/constants/image-tools.constants';
import { ImageToolsService } from '@feature/image-tools/image-tools.service';
import { ThumbnailWorkerEvent } from '@feature/image-tools/workers/thumbnail-worker.event';

describe('ImageToolsService', () => {
  let service: ImageToolsService;
  let storageService: jest.Mocked<StorageService>;
  let workerPool: jest.Mocked<WorkerPool>;
  let redisService: jest.Mocked<RedisService>;
  let minioService: jest.Mocked<MinioService>;

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

    const mockMinioService = {
      uploadFileFromPath: jest.fn(),
      getFileUrl: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ImageToolsService,
        { provide: StorageService, useValue: mockStorageService },
        { provide: WorkerPool, useValue: mockWorkerPool },
        { provide: RedisService, useValue: mockRedisService },
        { provide: MinioService, useValue: mockMinioService },
      ],
    }).compile();

    service = module.get<ImageToolsService>(ImageToolsService);
    storageService = module.get(StorageService);
    workerPool = module.get(WorkerPool);
    redisService = module.get(RedisService);
    minioService = module.get(MinioService);
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
      const mockUrl = 'http://localhost:9000/thumbnails/test-123456.jpg';

      storageService.saveFileToDir.mockResolvedValue([mockInputFilePath, mockFileName, mockExt]);
      storageService.createFilePath.mockReturnValue(mockOutputFilePath);
      minioService.getFileUrl.mockReturnValue(mockUrl);
      workerPool.postEvent.mockResolvedValue();

      const result = await service.generateThumbnail(mockFile, 200, 200);

      // Check that file was saved to temp directory
      expect(storageService.saveFileToDir).toHaveBeenCalledWith(mockFile, UploadDirEnum.TEMP);

      // Check that output path was created
      expect(storageService.createFilePath).toHaveBeenCalledWith(UploadDirEnum.OUT, mockExt, mockFileName);

      // Check that MinIO URL was generated
      expect(minioService.getFileUrl).toHaveBeenCalledWith(`${mockFileName}${mockExt}`);

      // Check that worker event was created with correct params
      expect(workerPool.postEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          inputFilePath: mockInputFilePath,
          outputFilePath: mockOutputFilePath,
          fileName: `${mockFileName}${mockExt}`,
          url: mockUrl,
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
      minioService.getFileUrl.mockReturnValue('http://localhost:9000/thumbnails/filename.jpg');
      workerPool.postEvent.mockRejectedValue(new Error('Worker error'));

      await expect(service.generateThumbnail(mockFile)).rejects.toThrow(BadRequestException);
      expect(workerPool.postEvent).toHaveBeenCalled();
    });
  });

  describe('handleThumbnailSuccess', () => {
    it('should delete input file, upload to MinIO and save thumbnail data to Redis', async () => {
      const mockEvent = {
        id: 'event-id',
        inputFilePath: '/path/to/input.jpg',
        outputFilePath: '/path/to/output.jpg',
        fileName: 'thumbnail.jpg',
        url: 'http://localhost:9000/thumbnails/thumbnail.jpg',
      } as ThumbnailWorkerEvent;

      minioService.uploadFileFromPath.mockResolvedValue(mockEvent.url);
      redisService.setChild.mockResolvedValue();

      await service.handleThumbnailSuccess(mockEvent);

      // Check that input file was deleted
      expect(storageService.deleteFile).toHaveBeenCalledWith(mockEvent.inputFilePath);

      // Check that file was uploaded to MinIO
      expect(minioService.uploadFileFromPath).toHaveBeenCalledWith(mockEvent.outputFilePath, mockEvent.fileName);

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
        thumb1: { url: 'http://localhost:9000/thumbnails/thumb1.jpg', outputFilePath: '/path/to/thumb1.jpg' },
        thumb2: { url: 'http://localhost:9000/thumbnails/thumb2.jpg', outputFilePath: '/path/to/thumb2.jpg' },
      };

      redisService.getAllChildren.mockResolvedValue(mockThumbnails);

      const result = await service.getAllThumbnails();

      expect(redisService.getAllChildren).toHaveBeenCalledWith(ThumbnailCollectionKey);
      expect(result).toHaveLength(2);
      expect(result[0].url).toBe('http://localhost:9000/thumbnails/thumb1.jpg');
      expect(result[1].url).toBe('http://localhost:9000/thumbnails/thumb2.jpg');
    });

    it('should return empty array when no thumbnails exist', async () => {
      redisService.getAllChildren.mockResolvedValue({});

      const result = await service.getAllThumbnails();

      expect(result).toEqual([]);
    });
  });

  describe('getThumbnailById', () => {
    it('should return a thumbnail with transformed URL', async () => {
      const mockThumbnail = {
        url: 'http://localhost:9000/thumbnails/thumb1.jpg',
        outputFilePath: '/path/to/thumb1.jpg',
      };

      redisService.getChild.mockResolvedValue(mockThumbnail);

      const result = await service.getThumbnailById('thumb-id');

      expect(redisService.getChild).toHaveBeenCalledWith(ThumbnailCollectionKey, expect.stringContaining('thumb-id'));
      expect(result.url).toBe('http://localhost:9000/thumbnails/thumb1.jpg');
      expect(result.outputFilePath).toBe('/path/to/thumb1.jpg');
    });

    it('should return throw error if thumbnail does not exist', async () => {
      redisService.getChild.mockResolvedValue(null);

      await expect(service.getThumbnailById('thumb-id')).rejects.toThrow(NotFoundException);

      expect(redisService.getChild).toHaveBeenCalledWith(ThumbnailCollectionKey, expect.stringContaining('thumb-id'));
    });
  });
});
