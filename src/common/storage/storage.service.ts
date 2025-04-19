import { existsSync, mkdirSync, promises as fsPromises, unlink } from 'fs';
import { extname, join, parse } from 'path';

import { Injectable, Logger } from '@nestjs/common';
import { ulid } from 'ulid';

import { UploadDirEnum } from './constants/storage.constants';

/**
 * Service for handling file storage operations
 *
 * Provides functionality to save, retrieve, and delete files from the file system.
 * Manages temporary and output directories for file storage.
 */
@Injectable()
export class StorageService {
  /** Mapping of directory enums to their actual file system paths */
  private saveDirectories: Record<UploadDirEnum, string> = {
    out: join(process.cwd(), './public/out'),
    temp: join(process.cwd(), './public/temp'),
  };
  /** Logger instance */
  private readonly logger = new Logger(StorageService.name);

  constructor() {}

  /**
   * Lifecycle hook called when the module is initialized
   *
   * Creates necessary directories if they don't exist
   */
  onModuleInit() {
    this.createDirectoryIfNotExists(this.saveDirectories.out);
    this.createDirectoryIfNotExists(this.saveDirectories.temp);
  }

  /**
   * Creates a directory if it doesn't already exist
   *
   * @param path - Path to the directory
   * @private
   */
  private createDirectoryIfNotExists(path: string) {
    if (!existsSync(path)) {
      mkdirSync(path);
    }
  }

  /**
   * Saves a file to the specified directory
   *
   * @param file - The file object from Multer middleware
   * @param dirName - Directory to save the file in (default: temp)
   * @param fileName - Optional custom filename (default: original name + timestamp)
   * @returns Tuple containing [filePath, fileName, fileExtension]
   */
  public async saveFileToDir(
    file: Express.Multer.File,
    dirName = UploadDirEnum.TEMP,
    fileName?: string,
  ): Promise<[string, string, string]> {
    const fileExt = extname(file.originalname);

    if (!fileName) {
      fileName = `${parse(file.originalname).name}-${Date.now()}`;
    }

    const filePath = this.createFilePath(dirName, fileExt, fileName);

    await fsPromises.writeFile(filePath, file.buffer);
    this.logger.log('[saveFileToDir] Successfully saved file: %s', filePath);

    return [filePath, fileName, fileExt];
  }

  /**
   * Creates a file path based on directory, extension, and optional filename
   *
   * @param dirName - Directory to save the file in (default: temp)
   * @param fileExt - File extension including the dot (e.g., '.jpg')
   * @param fileName - Optional custom filename (default: generated ULID)
   * @returns Complete file path
   */
  public createFilePath(dirName = UploadDirEnum.TEMP, fileExt: string, fileName?: string): string {
    if (!fileName) {
      fileName = `${ulid()}`;
    }

    fileName = `${fileName}${fileExt}`;

    const filePath = join(this.saveDirectories[dirName], fileName);

    return filePath;
  }

  /**
   * Deletes a file from the file system
   *
   * @param filePath - Path to the file to delete
   * @throws Error if the file doesn't exist
   */
  public deleteFile(filePath: string) {
    if (existsSync(filePath)) {
      unlink(filePath, (err) => {
        if (err) throw err;
      });
    } else {
      throw Error('File does not exist!');
    }
  }
}
