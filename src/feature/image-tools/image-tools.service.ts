import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';

import { WorkerPool } from '@common/jobs/worker-pool';
import { RedisService } from '@common/redis/redis.service';
import { UploadDirEnum } from '@common/storage/constants/storage.constants';
import { StorageService } from '@common/storage/storage.service';

import { ThumbnailCollectionKey } from '@feature/image-tools/constants/image-tools.constants';
import { ThumbnailDto } from '@feature/image-tools/dto/image-tools.dto';
import { ThumbnailWorkerEvent } from '@feature/image-tools/workers/thumbnail-worker.event';

@Injectable()
export class ImageToolsService {
  private readonly logger = new Logger(ImageToolsService.name);

  constructor(
    private storageService: StorageService,
    private workerPool: WorkerPool,
    private redisService: RedisService,
  ) {}

  async generateThumbnail(image: Express.Multer.File, sizeX = 100, sizeY = 100): Promise<string> {
    // Temp save file
    const [inputFilePath, inputFileName, inputExt] = await this.storageService.saveFileToDir(image, UploadDirEnum.TEMP);
    const outputFilePath = this.storageService.createFilePath(UploadDirEnum.OUT, inputExt, inputFileName);
    const url = `/${UploadDirEnum.OUT}/${inputFileName}${inputExt}`;

    const thumbnailWorkerEvent = new ThumbnailWorkerEvent(inputFilePath, outputFilePath, url, sizeX, sizeY);

    try {
      await this.workerPool.postEvent(thumbnailWorkerEvent);
    } catch (err) {
      throw new BadRequestException(`Something went wrong: ${err}`);
    }

    return thumbnailWorkerEvent.id;
  }

  async handleThumbnailSuccess(data: ThumbnailWorkerEvent) {
    // Delete temp input file
    this.storageService.deleteFile(data.inputFilePath);

    // Save in redis
    const thumbnailData: ThumbnailDto = {
      outputFilePath: data.outputFilePath,
      url: data.url,
    };

    await this.redisService.setChild(ThumbnailCollectionKey, this.createThumbnailKey(data.id), thumbnailData);
  }

  handleThumbnailError(err: Error, data: ThumbnailWorkerEvent) {
    this.logger.error('[handleThumbnailError] Failed to generate thumbnail %s: %s', data.id, err.message);
    // Delete temp input file
    this.storageService.deleteFile(data.inputFilePath);
  }

  async getAllThumbnails(origin: string): Promise<ThumbnailDto[]> {
    const thumbnailData = await this.redisService.getAllChildren<ThumbnailDto>(ThumbnailCollectionKey);
    const formattedThumbnails = Object.values(thumbnailData);
    formattedThumbnails.map((thumbnail) => {
      thumbnail.url = this.transformUrl(origin, thumbnail.url);
    });

    return formattedThumbnails;
  }

  async getThumbnailById(id: string, origin: string) {
    const thumbnailData = (await this.redisService.getChild<ThumbnailDto>(
      ThumbnailCollectionKey,
      this.createThumbnailKey(id),
    )) as ThumbnailDto;

    if (!thumbnailData) {
      throw new NotFoundException(`Thumbnail ${id} does not exist`);
    }

    thumbnailData.url = this.transformUrl(origin, thumbnailData.url);

    return thumbnailData;
  }

  private createThumbnailKey(id: string) {
    return `${ThumbnailCollectionKey}:${id}`;
  }

  private transformUrl(origin: string, url: string): string {
    return `${origin}${url}`;
  }
}
