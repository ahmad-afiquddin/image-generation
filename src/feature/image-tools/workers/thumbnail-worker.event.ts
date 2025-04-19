import { WorkerEvent } from '@common/jobs/worker';

/**
 * Worker event for thumbnail generation
 *
 * Contains configuration data for thumbnail generation tasks,
 * including source and destination paths and dimensions.
 */
export class ThumbnailWorkerEvent extends WorkerEvent {
  /** Path to the source image file */
  inputFilePath: string;
  /** Path where the generated thumbnail should be saved */
  outputFilePath: string;
  /** Filename of the generated thumbnail with extension */
  fileName: string;
  /** Relative URL path for accessing the thumbnail */
  url: string;
  /** Desired width of the thumbnail in pixels */
  sizeX = 100;
  /** Desired height of the thumbnail in pixels */
  sizeY = 100;

  /**
   * Creates a new thumbnail worker event
   *
   * @param inputFilePath - Path to the source image file
   * @param outputFilePath - Path where the thumbnail should be saved
   * @param url - Relative URL path for accessing the thumbnail
   * @param sizeX - Desired width of the thumbnail (default: 100px)
   * @param sizeY - Desired height of the thumbnail (default: 100px)
   */
  constructor(
    inputFilePath: string,
    outputFilePath: string,
    fileName: string,
    url: string,
    sizeX?: number,
    sizeY?: number,
  ) {
    super();

    this.inputFilePath = inputFilePath;
    this.outputFilePath = outputFilePath;
    this.fileName = fileName;
    this.url = url;

    if (sizeX) {
      this.sizeX = sizeX;
    }
    if (sizeY) {
      this.sizeY = sizeY;
    }
  }
}
