import { resolve } from 'path';

import { Injectable, Logger } from '@nestjs/common';

import { WorkerPool } from '@common/jobs/worker-pool';

import { ImageToolsService } from '@feature/image-tools/image-tools.service';
import { ThumbnailWorkerEvent } from '@feature/image-tools/workers/thumbnail-worker.event';

/**
 * Hook class for setting up and tearing down image processing workers
 *
 * Responsible for subscribing and unsubscribing thumbnail worker events
 * with the worker pool when the module is initialized or destroyed.
 */
@Injectable()
export class ImageToolsHook {
  private readonly logger = new Logger(ImageToolsHook.name);

  /**
   * Creates a new ImageToolsHook instance
   *
   * @param workerPool - Service for managing background worker processes
   * @param imageToolsService - Service for image processing operations
   */
  constructor(
    private workerPool: WorkerPool,
    private imageToolsService: ImageToolsService,
  ) {}

  /**
   * Lifecycle hook called when the module is initialized
   *
   * Subscribes the thumbnail worker to the worker pool
   */
  async onModuleInit() {
    await this.workerPool.subscribe(
      // Create temp worker event to store config
      new ThumbnailWorkerEvent('', '', '', ''),
      resolve(__dirname, '../workers/thumbnail.worker.js'),
      this,
      this.onThumbnailSuccess,
      this.onThumbnailError,
    );
  }

  /**
   * Lifecycle hook called when the module is being destroyed
   *
   * Unsubscribes the thumbnail worker from the worker pool
   */
  async onModuleDestroy() {
    await this.workerPool.unsubscribe(new ThumbnailWorkerEvent('', '', '', ''));
  }

  /**
   * Callback for successful thumbnail generation
   *
   * @param data - The worker event data
   * @private
   */
  private onThumbnailSuccess(data: ThumbnailWorkerEvent) {
    void this.imageToolsService.handleThumbnailSuccess(data);
  }

  /**
   * Callback for thumbnail generation errors
   *
   * @param err - The error that occurred
   * @param data - The worker event data (optional)
   * @private
   */
  private onThumbnailError(err: Error, data?: ThumbnailWorkerEvent) {
    this.logger.error('[onThumbnailError] Failed to run job for %s', data?.id);
  }
}
