import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';

import { WorkerPool } from '@common/jobs/worker-pool';
import { RedisService } from '@common/redis/redis.service';
import { UploadDirEnum } from '@common/storage/constants/storage.constants';
import { MinioService } from '@common/storage/minio.service';
import { StorageService } from '@common/storage/storage.service';

import { ThumbnailCollectionKey } from '@feature/image-tools/constants/image-tools.constants';
import { ThumbnailDto } from '@feature/image-tools/dto/image-tools.dto';
import { ThumbnailWorkerEvent } from '@feature/image-tools/workers/thumbnail-worker.event';

/**
 * Service for processing and managing images
 *
 * Provides thumbnail generation functionality and manages thumbnail data.
 */
@Injectable()
export class ImageToolsService {
  private readonly logger = new Logger(ImageToolsService.name);

  /**
   * Creates a new instance of ImageToolsService
   *
   * @param storageService - Service for handling file storage operations
   * @param workerPool - Service for managing background worker processes
   * @param redisService - Service for Redis data storage
   */
  constructor(
    private storageService: StorageService,
    private workerPool: WorkerPool,
    private redisService: RedisService,
    private minioService: MinioService,
  ) {}

  /**
   * Generates a thumbnail from an uploaded image
   *
   * @param image - The uploaded image file
   * @param sizeX - Desired width of the thumbnail (default: 100)
   * @param sizeY - Desired height of the thumbnail (default: 100)
   * @returns Promise resolving to the job ID
   * @throws BadRequestException if thumbnail generation fails
   */
  async generateThumbnail(image: Express.Multer.File, sizeX = 100, sizeY = 100): Promise<string> {
    // Temp save file
    const [inputFilePath, inputFileName, inputExt] = await this.storageService.saveFileToDir(image, UploadDirEnum.TEMP);
    const outputFilePath = this.storageService.createFilePath(UploadDirEnum.OUT, inputExt, inputFileName);
    const fileName = `${inputFileName}${inputExt}`;
    // Get output file url from bucket
    const url = this.minioService.getFileUrl(fileName);

    const thumbnailWorkerEvent = new ThumbnailWorkerEvent(inputFilePath, outputFilePath, fileName, url, sizeX, sizeY);

    try {
      await this.workerPool.postEvent(thumbnailWorkerEvent);
    } catch (err) {
      throw new BadRequestException(`Something went wrong: ${err}`);
    }

    return thumbnailWorkerEvent.id;
  }

  /**
   * Handles successful thumbnail generation
   *
   * @param data - Worker event data containing thumbnail information
   */
  async handleThumbnailSuccess(data: ThumbnailWorkerEvent) {
    // Delete temp input file
    this.storageService.deleteFile(data.inputFilePath);

    await this.minioService.uploadFileFromPath(data.outputFilePath, data.fileName);

    // Save in redis
    const thumbnailData: ThumbnailDto = {
      outputFilePath: data.outputFilePath,
      url: data.url,
    };

    await this.redisService.setChild(ThumbnailCollectionKey, this.createThumbnailKey(data.id), thumbnailData);
  }

  /**
   * Handles errors in thumbnail generation
   *
   * @param err - The error that occurred
   * @param data - Worker event data
   */
  handleThumbnailError(err: Error, data: ThumbnailWorkerEvent) {
    this.logger.error('[handleThumbnailError] Failed to generate thumbnail %s: %s', data.id, err.message);
    // Delete temp input file
    this.storageService.deleteFile(data.inputFilePath);
  }

  /**
   * Retrieves all thumbnails
   *
   * @returns Array of thumbnail data with absolute URLs
   */
  async getAllThumbnails(): Promise<ThumbnailDto[]> {
    const thumbnailData = await this.redisService.getAllChildren<ThumbnailDto>(ThumbnailCollectionKey);

    return Object.values(thumbnailData);
  }

  /**
   * Retrieves a specific thumbnail by ID
   *
   * @param id - The thumbnail ID
   * @param origin - The origin URL to prepend to relative paths
   * @returns Thumbnail data with absolute URL
   * @throws NotFoundException if the thumbnail doesn't exist
   */
  async getThumbnailById(id: string): Promise<ThumbnailDto> {
    const thumbnailData = (await this.redisService.getChild<ThumbnailDto>(
      ThumbnailCollectionKey,
      this.createThumbnailKey(id),
    )) as ThumbnailDto;

    if (!thumbnailData) {
      throw new NotFoundException(`Thumbnail ${id} does not exist`);
    }

    return thumbnailData;
  }

  /**
   * Creates a Redis key for a thumbnail based on its ID
   *
   * @param id - The thumbnail ID
   * @returns The formatted Redis key
   * @private
   */
  private createThumbnailKey(id: string) {
    return `${ThumbnailCollectionKey}:${id}`;
  }

  /**
   * Transforms a relative URL to an absolute URL
   *
   * @param origin - The origin part of the URL (e.g., 'http://example.com')
   * @param url - The relative URL path
   * @returns The absolute URL
   * @private
   */
  private transformUrl(origin: string, url: string): string {
    return `${origin}${url}`;
  }
}
