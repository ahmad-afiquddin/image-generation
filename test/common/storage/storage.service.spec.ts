/* eslint-disable @typescript-eslint/no-unsafe-return */
import * as fs from 'fs';

import { Test, TestingModule } from '@nestjs/testing';
import { ulid } from 'ulid';

import { UploadDirEnum } from '@common/storage/constants/storage.constants';
import { StorageService } from '@common/storage/storage.service';

// Properly mock the fs module
jest.mock('fs', () => ({
  existsSync: jest.fn(),
  mkdirSync: jest.fn(),
  unlink: jest.fn(),
  promises: {
    writeFile: jest.fn().mockResolvedValue(undefined),
  },
}));

// Properly mock path.join
jest.mock('path', () => ({
  ...jest.requireActual('path'),
  join: jest.fn().mockImplementation((...args) => args.join('/')),
}));

// Mock ulid
jest.mock('ulid', () => ({
  ulid: jest.fn().mockReturnValue('mock-ulid'),
}));

describe('StorageService', () => {
  let service: StorageService;
  const mockFs = fs as jest.Mocked<typeof fs>;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [StorageService],
    }).compile();

    service = module.get<StorageService>(StorageService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('onModuleInit', () => {
    it('should create directories if they do not exist', () => {
      mockFs.existsSync.mockReturnValue(false);

      service.onModuleInit();

      // Check if directories were created
      expect(mockFs.existsSync).toHaveBeenCalledTimes(2);
      expect(mockFs.mkdirSync).toHaveBeenCalledTimes(2);
      expect(mockFs.mkdirSync).toHaveBeenCalledWith(expect.stringContaining('public/out'));
      expect(mockFs.mkdirSync).toHaveBeenCalledWith(expect.stringContaining('public/temp'));
    });

    it('should not create directories if they already exist', () => {
      mockFs.existsSync.mockReturnValue(true);

      service.onModuleInit();

      expect(mockFs.existsSync).toHaveBeenCalledTimes(2);
      expect(mockFs.mkdirSync).not.toHaveBeenCalled();
    });
  });

  describe('saveFileToDir', () => {
    it('should save file with generated filename if none provided', async () => {
      const mockFile = {
        originalname: 'test.jpg',
        buffer: Buffer.from('test'),
      } as Express.Multer.File;

      const result = await service.saveFileToDir(mockFile);

      expect(mockFs.promises.writeFile).toHaveBeenCalledWith(expect.stringContaining('test-'), mockFile.buffer);
      expect(result).toHaveLength(3); // Returns [filePath, fileName, fileExt]
      expect(result[2]).toBe('.jpg');
    });

    it('should save file with provided filename', async () => {
      const mockFile = {
        originalname: 'test.jpg',
        buffer: Buffer.from('test'),
      } as Express.Multer.File;

      const result = await service.saveFileToDir(mockFile, UploadDirEnum.OUT, 'custom-name');

      expect(mockFs.promises.writeFile).toHaveBeenCalledWith(
        expect.stringContaining('custom-name.jpg'),
        mockFile.buffer,
      );
      expect(result[1]).toBe('custom-name');
    });
  });

  describe('createFilePath', () => {
    it('should create path with generated filename if none provided', () => {
      const result = service.createFilePath(UploadDirEnum.TEMP, '.jpg');

      expect(result).toContain('mock-ulid.jpg');
      expect(ulid).toHaveBeenCalled();
    });

    it('should create path with provided filename', () => {
      const result = service.createFilePath(UploadDirEnum.OUT, '.png', 'custom-name');

      expect(result).toContain('custom-name.png');
    });
  });

  describe('deleteFile', () => {
    it('should delete file if it exists', () => {
      mockFs.existsSync.mockReturnValue(true);
      mockFs.unlink.mockImplementation((path, callback) => callback(null));

      void service.deleteFile('path/to/file.jpg');

      expect(mockFs.existsSync).toHaveBeenCalledWith('path/to/file.jpg');
      expect(mockFs.unlink).toHaveBeenCalledWith('path/to/file.jpg', expect.any(Function));
    });

    it('should throw error if file does not exist', () => {
      mockFs.existsSync.mockReturnValue(false);

      expect(() => service.deleteFile('path/to/file.jpg')).toThrow('File does not exist!');
      expect(mockFs.existsSync).toHaveBeenCalledWith('path/to/file.jpg');
      expect(mockFs.unlink).not.toHaveBeenCalled();
    });

    it('should throw error if unlink fails', () => {
      mockFs.existsSync.mockReturnValue(true);
      mockFs.unlink.mockImplementation((path, callback) => callback(new Error('Unlink error')));

      expect(() => service.deleteFile('path/to/file.jpg')).toThrow('Unlink error');
    });
  });
});
