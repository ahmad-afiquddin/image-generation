/* eslint-disable @typescript-eslint/no-unsafe-function-type */
/* eslint-disable @typescript-eslint/no-unsafe-return */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-call */

import { Test, TestingModule } from '@nestjs/testing';

import { WorkerPool } from '@common/jobs/worker-pool';

import { ImageToolsHook } from '@feature/image-tools/hooks/image-tools.hook';
import { ImageToolsService } from '@feature/image-tools/image-tools.service';
import { ThumbnailWorkerEvent } from '@feature/image-tools/workers/thumbnail-worker.event';

describe('ImageToolsHook', () => {
  let hook: ImageToolsHook;
  let workerPool: jest.Mocked<WorkerPool>;
  let imageToolsService: jest.Mocked<ImageToolsService>;

  beforeEach(async () => {
    const mockWorkerPool = {
      subscribe: jest.fn().mockResolvedValue(undefined),
      unsubscribe: jest.fn().mockResolvedValue(undefined),
    };

    const mockImageToolsService = {
      handleThumbnailSuccess: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ImageToolsHook,
        { provide: WorkerPool, useValue: mockWorkerPool },
        { provide: ImageToolsService, useValue: mockImageToolsService },
      ],
    }).compile();

    hook = module.get<ImageToolsHook>(ImageToolsHook);
    workerPool = module.get(WorkerPool);
    imageToolsService = module.get(ImageToolsService);
  });

  it('should be defined', () => {
    expect(hook).toBeDefined();
  });

  describe('onModuleInit', () => {
    it('should subscribe to ThumbnailWorkerEvent', async () => {
      await hook.onModuleInit();

      expect(workerPool.subscribe).toHaveBeenCalledWith(
        expect.any(ThumbnailWorkerEvent),
        expect.stringContaining('thumbnail.worker.js'),
        hook,
        expect.any(Function),
        expect.any(Function),
      );
    });

    it('should pass correct callbacks', async () => {
      // Capture the callbacks when subscribe is called
      let capturedSuccessCallback: Function = () => {};
      let capturedErrorCallback: Function = () => {};

      workerPool.subscribe.mockImplementation((event, path, subscriber, success, error) => {
        capturedSuccessCallback = success;
        capturedErrorCallback = error;
        return Promise.resolve();
      });

      await hook.onModuleInit();

      // Create a mock event to test the callbacks
      const mockEvent = new ThumbnailWorkerEvent('input', 'output', 'filename', 'url');
      const mockError = new Error('Test error');

      // Test success callback
      capturedSuccessCallback.call(hook, mockEvent);
      expect(imageToolsService.handleThumbnailSuccess).toHaveBeenCalledWith(mockEvent);

      // Test error callback - it's empty but should not throw
      expect(() => capturedErrorCallback.call(hook, mockError, mockEvent)).not.toThrow();
    });
  });

  describe('onModuleDestroy', () => {
    it('should unsubscribe from ThumbnailWorkerEvent', async () => {
      await hook.onModuleDestroy();

      expect(workerPool.unsubscribe).toHaveBeenCalledWith(expect.any(ThumbnailWorkerEvent));
    });
  });

  // Test the callback methods directly
  describe('callback methods', () => {
    it('onThumbnailSuccess should call imageToolsService.handleThumbnailSuccess', () => {
      const mockEvent = new ThumbnailWorkerEvent('input', 'output', 'filename', 'url');

      // Call the private method
      (hook as any).onThumbnailSuccess(mockEvent);

      expect(imageToolsService.handleThumbnailSuccess).toHaveBeenCalledWith(mockEvent);
    });

    it('onThumbnailError should not throw', () => {
      const mockEvent = new ThumbnailWorkerEvent('input', 'output', 'filename', 'url');
      const mockError = new Error('Test error');

      // Call the private method
      expect(() => (hook as any).onThumbnailError(mockError, mockEvent)).not.toThrow();
    });
  });
});
