import { ulid } from 'ulid';

export class WorkerEvent {
  id: string;
  retries = 3;

  constructor(retries = 3) {
    this.id = ulid();
    this.retries = retries;
  }
}

export class WorkerEventConfig {
  scriptPath: string;
  subscriber: any;
  successCallback: (data: any) => void;
  errorCallback: (err: Error) => void;

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
