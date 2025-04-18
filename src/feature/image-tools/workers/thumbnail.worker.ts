import { parentPort, workerData } from 'worker_threads';

import * as sharp from 'sharp';

import { ThumbnailWorkerEvent } from './thumbnail-worker.event';

const { inputFilePath, outputFilePath, sizeX, sizeY } = workerData as ThumbnailWorkerEvent;

async function resizeImage(): Promise<void> {
  try {
    await sharp(inputFilePath)
      .resize(sizeX, sizeY, {
        fit: 'cover',
        position: 'center',
      })
      .toFile(outputFilePath);
  } catch (err) {
    throw err;
  }
}

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

startResize();
