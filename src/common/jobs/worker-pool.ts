import { cpus } from 'os';
import { Worker } from 'worker_threads';

import { Injectable, Logger } from '@nestjs/common';

import { JobCollectionKey, JobKey, JobStatusEnum } from '@common/jobs/constants/jobs.constants';
import { JobDataDto, WorkerMessage } from '@common/jobs/dto/jobs.dto';
import { WorkerEventConfig, WorkerEvent } from '@common/jobs/worker';
import { RedisService } from '@common/redis/redis.service';

@Injectable()
export class WorkerPool {
  private readonly logger = new Logger(WorkerPool.name);
  private readonly maxPool = Math.max(cpus().length, 1);
  private workerConfigMap: Map<string, WorkerEventConfig> = new Map();
  private activeWorkers: Set<Worker> = new Set();
  private workerEventQueue: WorkerEvent[] = [];
  private running = 0;

  constructor(private readonly redisService: RedisService) {}

  async onApplicationBootstrap() {
    // server has restarted, there are unfinshed jobs on redis
    // get all jobs.status =/= success that have retries of > 0
    const fromRedis = await this.redisService.getAllChildren<JobDataDto>(JobCollectionKey);
    const unstartedJobs: WorkerEvent[] = Object.values(fromRedis)
      .filter(({ status }) => [JobStatusEnum.QUEUED, JobStatusEnum.PROCESSING].includes(status))
      .map(({ event }) => event);

    if (!unstartedJobs.length) {
      this.logger.log('[onApplicationBootstrap] No unstarted jobs');
      return;
    }

    const promises = unstartedJobs.map((workerEvent) => this.postEvent(workerEvent));

    this.logger.log('[onAppliationBootstrap] Adding unstarted jobs to queue');
    void Promise.all(promises);
  }

  async onModuleDestroy() {
    // Stop all running workers
    await this.terminateAllWorkers();
  }

  public subscribe(
    workerEvent: WorkerEvent,
    scriptPath: string,
    subscriber: any,
    successCallback: (data: any) => void,
    errorCallback: (err: Error, data?: any) => void,
    override = false,
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      const workerEventName = workerEvent.constructor.name;
      if (this.workerConfigMap.has(workerEventName) && !override) {
        reject(new Error(`Config for event ${workerEventName} exists and cannot be overwritten!`));
      }

      this.workerConfigMap.set(
        workerEventName,
        new WorkerEventConfig(scriptPath, subscriber, successCallback, errorCallback),
      );

      this.logger.log('[subscribe] Successfully subscribed event %s in worker pool', workerEventName);
      resolve();
    });
  }

  public unsubscribe(workerEvent: WorkerEvent): Promise<void> {
    const workerEventName = workerEvent.constructor.name;

    return new Promise((resolve) => {
      if (this.workerConfigMap.has(workerEventName)) {
        this.workerConfigMap.delete(workerEventName);
      }

      this.logger.log('[unsubscribe] Successfully unsubscribed event %s', workerEventName);
      resolve();
    });
  }

  public async postEvent(workerEvent: WorkerEvent): Promise<void> {
    return new Promise((resolve, reject) => {
      const workerEventName = workerEvent.constructor.name;

      if (!this.workerConfigMap.has(workerEventName)) {
        reject(new Error(`Config for event ${workerEventName} does not exist!`));
      }

      this.addAndSaveWorkerEvent(workerEvent)
        .then(() => {
          void this.processQueue();
        })
        .catch((err: Error) => {
          this.logger.error('Cannot save job: %s', err.message);
        });
      resolve();
    });
  }

  public createJobKey(id: string): string {
    return `${JobKey}:${id}`;
  }

  private async addAndSaveWorkerEvent(workerEvent: WorkerEvent) {
    // Add to queue
    this.workerEventQueue.push(workerEvent);

    // Save to Redis
    const jobData: JobDataDto = {
      id: workerEvent.id,
      status: JobStatusEnum.QUEUED,
      event: workerEvent,
    };
    await this.redisService.setChild(JobCollectionKey, this.createJobKey(workerEvent.id), jobData);
  }

  private async processQueue() {
    if (!this.workerEventQueue.length) return;
    if (this.running >= this.maxPool) return;

    this.running++;

    const workerEvent = this.workerEventQueue.shift()!;

    const { scriptPath, subscriber, successCallback, errorCallback } = this.workerConfigMap.get(
      workerEvent.constructor.name,
    )!;

    await this.handleProcessing(workerEvent);

    try {
      const worker = new Worker(scriptPath, { workerData: workerEvent });
      this.activeWorkers.add(worker);

      this.logger.log('[processQueue] Running worker for %s using thread %s', workerEvent.id, worker.threadId);

      let isErrorHandled = false;

      worker.on('message', (result: WorkerMessage) => {
        if (result.success) {
          this.logger.log('[processQueue] Worker success');
          // terminate worker and handle success
          void this.cleanupWorker(worker);
          void this.handleSuccess(workerEvent, result.data, subscriber, successCallback);
        } else {
          void this.cleanupWorker(worker);
          void this.handleError(
            workerEvent,
            result.err ?? new Error('Something unexpected happened!'),
            subscriber,
            errorCallback,
          );
        }
      });

      worker.on('error', (err) => {
        if (isErrorHandled) {
          return;
        } else {
          isErrorHandled = true;
        }

        // terminate worker and handle error
        this.cleanupWorker(worker);
        void this.handleError(workerEvent, err, subscriber, errorCallback);
      });

      worker.on('exit', (code) => {
        if (isErrorHandled) {
          return;
        } else {
          isErrorHandled = true;
        }

        if (code !== 0) {
          void this.handleError(workerEvent, new Error('Worker terminated unexpectedly!'), subscriber, errorCallback);
        }
      });
    } catch (err) {
      const error = err as Error;
      this.logger.error('[processQueue] Error starting worker: %s', error.message ?? err);
      this.running--;

      this.handleError(workerEvent, err as Error, subscriber, errorCallback);
    }
  }

  private cleanupWorker(worker: Worker, retries = 3) {
    this.running--;
    void this.processQueue();

    worker
      .terminate()
      .then(() => {
        this.logger.log('[cleanupWorker] Successfully terminated worker');
        this.activeWorkers.delete(worker);
      })
      .catch((err) => {
        this.logger.log('[cleanupWorker] Error terminating worker at thread %s, retrying', worker.threadId);
        // If failed to terminate try again
        if (!retries) {
          throw new Error(`Failed to terminate worker ${worker.threadId}: ${err}`);
        }
        this.cleanupWorker(worker, retries - 1);
      });
  }

  private async handleProcessing(workerEvent: WorkerEvent) {
    const jobKey = this.createJobKey(workerEvent.id);
    const jobData = (await this.redisService.getChild<JobDataDto>(JobCollectionKey, jobKey)) as JobDataDto;
    if (jobData) {
      jobData.status = JobStatusEnum.PROCESSING;
      await this.redisService.setChild(JobCollectionKey, jobKey, jobData);
    }
  }

  private async handleSuccess(
    workerEvent: WorkerEvent,
    data: any,
    subscriber: any,
    successCallback: (data: any) => void,
  ) {
    // Call success callback
    successCallback.call(subscriber, data);
    // Update status in redis to success
    const jobKey = this.createJobKey(workerEvent.id);
    const jobData = (await this.redisService.getChild<JobDataDto>(JobCollectionKey, jobKey)) as JobDataDto;
    if (jobData) {
      jobData.status = JobStatusEnum.SUCCESS;
      await this.redisService.setChild(JobCollectionKey, jobKey, jobData);
    }
  }

  private handleError(workerEvent: WorkerEvent, err: Error, subscriber: any, errorCallback: (err: Error) => void) {
    this.logger.error('[handleError] Error running worker for %s: %s', workerEvent.id, err.message);
    workerEvent.retries--;

    // Optionally pass back worker event data with error
    errorCallback.call(subscriber, err, workerEvent);

    if (!workerEvent.retries) {
      this.logger.log('[handleError] Retrying for %s', workerEvent.id);
      void this.handleNoRetriesError(workerEvent, err.message);
    } else {
      this.workerEventQueue.push(workerEvent);
    }
  }

  private async handleNoRetriesError(workerEvent: WorkerEvent, message: string) {
    // Update status in redis to failed
    const jobKey = this.createJobKey(workerEvent.id);
    const jobData = (await this.redisService.getChild<JobDataDto>(JobCollectionKey, jobKey)) as JobDataDto;
    if (jobData) {
      jobData.status = JobStatusEnum.FAILED;
      jobData.metadata = { ...(jobData.metadata ?? {}), err: { message } };
      await this.redisService.setChild(JobCollectionKey, jobKey, jobData);
    }
  }

  private async terminateAllWorkers() {
    const promises = Array.from(this.activeWorkers).map((worker) => worker.terminate());

    try {
      await Promise.all(promises);
    } catch {
      this.logger.error('Failed to terminate workers');
    }

    this.activeWorkers.clear();
    this.running = 0;
  }
}
