import { resolve } from 'path';

import { Injectable, Logger } from '@nestjs/common';

import { WorkerPool } from '@common/jobs/worker-pool';

import { ImageToolsService } from '@feature/image-tools/image-tools.service';
import { ThumbnailWorkerEvent } from '@feature/image-tools/workers/thumbnail-worker.event';

@Injectable()
export class ImageToolsHook {
  private readonly logger = new Logger(ImageToolsHook.name);
  constructor(
    private workerPool: WorkerPool,
    private imageToolsService: ImageToolsService,
  ) {}

  async onModuleInit() {
    await this.workerPool.subscribe(
      // Create temp worker event to store config
      new ThumbnailWorkerEvent('', '', ''),
      resolve(__dirname, '../workers/thumbnail.worker.js'),
      this,
      this.onThumbnailSuccess,
      this.onThumbnailError,
    );
  }

  async onModuleDestroy() {
    await this.workerPool.unsubscribe(new ThumbnailWorkerEvent('', '', ''));
  }

  private onThumbnailSuccess(data: ThumbnailWorkerEvent) {
    void this.imageToolsService.handleThumbnailSuccess(data);
  }

  private onThumbnailError(err: Error, data?: ThumbnailWorkerEvent) {
    this.logger.error('[onThumbnailError] Failed to run job for %s', data?.id);
  }
}
