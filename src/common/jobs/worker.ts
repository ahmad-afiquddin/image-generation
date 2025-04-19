import { ulid } from 'ulid';

/**
 * Base class for all worker events
 *
 * Provides common functionality for events processed by worker threads,
 * including a unique ID and retry mechanism.
 */
export class WorkerEvent {
  /** Unique identifier for the worker event */
  id: string;
  /** Number of remaining retry attempts if processing fails */
  retries = 3;

  /**
   * Creates a new worker event instance
   *
   * @param retries - Number of retries allowed for this event (default: 3)
   */
  constructor(retries = 3) {
    this.id = ulid();
    this.retries = retries;
  }
}

/**
 * Configuration for a worker event processor
 *
 * Contains all the information needed to process a specific type of worker event,
 * including the script path and callback functions.
 */
export class WorkerEventConfig {
  /** Path to the worker script that will process the event */
  scriptPath: string;
  /** Object instance that will receive the callbacks */
  subscriber: any;
  /** Function to call when the job completes successfully */
  successCallback: (data: any) => void;
  /** Function to call when the job fails */
  errorCallback: (err: Error) => void;

  /**
   * Creates a new worker event configuration
   *
   * @param scriptPath - Path to the worker script file
   * @param subscriber - Object instance that will receive callbacks
   * @param successCallback - Function to call on success
   * @param errorCallback - Function to call on error
   */
  constructor(
    scriptPath: string,
    subscriber: any,
    successCallback: (data: any) => void,
    errorCallback: (data: any) => void,
  ) {
    this.scriptPath = scriptPath;
    this.subscriber = subscriber;
    this.successCallback = successCallback;
    this.errorCallback = errorCallback;
  }
}
