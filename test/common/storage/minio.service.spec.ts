/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-return */
import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import * as Minio from 'minio';

import { MinioService } from '@common/storage/minio.service';

// Mock Minio client
jest.mock('minio', () => {
  return {
    Client: jest.fn().mockImplementation(() => ({
      bucketExists: jest.fn(),
      makeBucket: jest.fn(),
      fPutObject: jest.fn(),
    })),
  };
});

describe('MinioService', () => {
  let service: MinioService;
  let configService: jest.Mocked<ConfigService>;
  let minioClient: any;

  const mockConfig = {
    MINIO_ENDPOINT: 'test-endpoint',
    MINIO_PORT: 9000,
    MINIO_USE_SSL: 'false',
    MINIO_ACCESS_KEY: 'test-access-key',
    MINIO_SECRET_KEY: 'test-secret-key',
    MINIO_BUCKET_NAME: 'test-bucket',
    MINIO_PUBLIC_URL: 'http://test-endpoint:9000',
    MINIO_REGION: 'test-region',
  };

  beforeEach(async () => {
    // First clear any previous mock calls
    jest.clearAllMocks();

    // Create mock for ConfigService
    configService = {
      get: jest.fn((key) => mockConfig[key]),
    } as unknown as jest.Mocked<ConfigService>;

    const module: TestingModule = await Test.createTestingModule({
      providers: [MinioService, { provide: ConfigService, useValue: configService }],
    }).compile();

    service = module.get<MinioService>(MinioService);

    // Get the mocked Minio client
    minioClient = (Minio.Client as jest.Mock).mock.results[0].value;
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('constructor', () => {
    it('should initialize Minio client with correct config', () => {
      expect(Minio.Client).toHaveBeenCalledWith({
        endPoint: mockConfig.MINIO_ENDPOINT,
        port: mockConfig.MINIO_PORT,
        useSSL: false,
        accessKey: mockConfig.MINIO_ACCESS_KEY,
        secretKey: mockConfig.MINIO_SECRET_KEY,
      });
    });

    it('should set correct service properties', () => {
      expect(service['bucketName']).toBe(mockConfig.MINIO_BUCKET_NAME);
      expect(service['publicUrl']).toBe(mockConfig.MINIO_PUBLIC_URL);
      expect(service['region']).toBe(mockConfig.MINIO_REGION);
    });
  });

  describe('onModuleInit', () => {
    it('should log message if bucket exists', async () => {
      const logSpy = jest.spyOn(Logger.prototype, 'log');

      minioClient.bucketExists.mockResolvedValue(true);

      await service.onModuleInit();

      expect(minioClient.bucketExists).toHaveBeenCalledWith(mockConfig.MINIO_BUCKET_NAME);
      expect(minioClient.makeBucket).not.toHaveBeenCalled();
      expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('Bucket %s exists'), mockConfig.MINIO_BUCKET_NAME);
    });

    it('should create bucket if it does not exist', async () => {
      const logSpy = jest.spyOn(Logger.prototype, 'log');

      minioClient.bucketExists.mockResolvedValue(false);

      await service.onModuleInit();

      expect(minioClient.bucketExists).toHaveBeenCalledWith(mockConfig.MINIO_BUCKET_NAME);
      expect(minioClient.makeBucket).toHaveBeenCalledWith(mockConfig.MINIO_BUCKET_NAME, mockConfig.MINIO_REGION);
      expect(logSpy).toHaveBeenCalledWith(
        expect.stringContaining('Bucket %s created'),
        mockConfig.MINIO_BUCKET_NAME,
        mockConfig.MINIO_REGION,
      );
    });
  });

  describe('uploadFileFromPath', () => {
    it('should upload file and return URL', async () => {
      const filePath = '/path/to/testfile.jpg';
      const fileName = 'testfile.jpg';
      const expectedUrl = `${mockConfig.MINIO_PUBLIC_URL}/${mockConfig.MINIO_BUCKET_NAME}/${fileName}`;

      // Mock successful upload
      minioClient.fPutObject.mockResolvedValue({});

      const result = await service.uploadFileFromPath(filePath, fileName);

      expect(minioClient.fPutObject).toHaveBeenCalledWith(mockConfig.MINIO_BUCKET_NAME, fileName, filePath);
      expect(result).toBe(expectedUrl);
    });

    it('should throw error if upload fails', async () => {
      const filePath = '/path/to/testfile.jpg';
      const fileName = 'testfile.jpg';
      const error = new Error('Upload failed');

      // Mock failed upload
      minioClient.fPutObject.mockRejectedValue(error);

      await expect(service.uploadFileFromPath(filePath, fileName)).rejects.toThrow(error);

      expect(minioClient.fPutObject).toHaveBeenCalledWith(mockConfig.MINIO_BUCKET_NAME, fileName, filePath);
    });
  });

  describe('getFileUrl', () => {
    it('should return correct URL', () => {
      const fileName = 'testfile.jpg';
      const expectedUrl = `${mockConfig.MINIO_PUBLIC_URL}/${mockConfig.MINIO_BUCKET_NAME}/${fileName}`;

      const result = service.getFileUrl(fileName);

      expect(result).toBe(expectedUrl);
    });
  });
});
