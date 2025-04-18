import { WorkerEvent } from '@common/jobs/worker';

export class ThumbnailWorkerEvent extends WorkerEvent {
  inputFilePath: string;
  outputFilePath: string;
  url: string;
  sizeX = 100;
  sizeY = 100;

  constructor(inputFilePath: string, outputFilePath: string, url: string, sizeX?: number, sizeY?: number) {
    super();

    this.inputFilePath = inputFilePath;
    this.outputFilePath = outputFilePath;
    this.url = url;

    if (sizeX) {
      this.sizeX = sizeX;
    }
    if (sizeY) {
      this.sizeY = sizeY;
    }
  }
}
