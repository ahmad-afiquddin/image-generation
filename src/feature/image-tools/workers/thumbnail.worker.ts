import { parentPort, workerData } from 'worker_threads';

import * as sharp from 'sharp';

import { ThumbnailWorkerEvent } from './thumbnail-worker.event';

/**
 * Worker script for thumbnail generation
 *
 * This script runs in a separate thread and handles the actual image processing.
 * It receives configuration via workerData and communicates results via message passing.
 */

// Extract configuration from worker data
const { inputFilePath, outputFilePath, sizeX, sizeY } = workerData as ThumbnailWorkerEvent;

/**
 * Resizes the input image to create a thumbnail
 *
 * @returns Promise that resolves when resizing is complete
 * @throws Error if the resizing operation fails
 */
async function resizeImage(): Promise<void> {
  await sharp(inputFilePath)
    .resize(sizeX, sizeY, {
      fit: 'cover',
      position: 'center',
    })
    .toFile(outputFilePath);
}

/**
 * Starts the resize operation and handles results
 *
 * On success, sends a success message with the worker data
 * On failure, sends an error message with error details
 */
function startResize() {
  resizeImage()
    .then(() => {
      parentPort?.postMessage({
        success: true,
        data: workerData,
      });
    })
    .catch((err: Error) => {
      parentPort?.postMessage({
        success: false,
        err: {
          name: err.name,
          message: err.message,
          stack: err.stack,
        },
      });
    });
}

// Begin execution
startResize();
