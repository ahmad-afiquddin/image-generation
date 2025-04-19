import { Injectable, NotFoundException } from '@nestjs/common';

import { JobCollectionKey } from '@common/jobs/constants/jobs.constants';
import { JobDataDto } from '@common/jobs/dto/jobs.dto';
import { WorkerPool } from '@common/jobs/worker-pool';
import { RedisService } from '@common/redis/redis.service';

/**
 * Service responsible for managing background jobs
 *
 * Provides methods to retrieve information about all jobs or specific jobs
 * stored in Redis, using the WorkerPool for job processing.
 */
@Injectable()
export class JobsService {
  /**
   * Creates a new instance of JobsService
   *
   * @param redisService - Service to interact with Redis for job data storage
   * @param workerPool - Service that manages worker threads for job execution
   */
  constructor(
    private readonly redisService: RedisService,
    private readonly workerPool: WorkerPool,
  ) {}

  /**
   * Retrieves all jobs stored in Redis
   *
   * @returns Promise resolving to an array of job data
   */
  async getAllJobs(): Promise<JobDataDto[]> {
    const jobs = await this.redisService.getAllChildren<JobDataDto>(JobCollectionKey);
    return Object.values(jobs);
  }

  /**
   * Retrieves a specific job by its ID
   *
   * @param id - The unique identifier of the job to retrieve
   * @returns Promise resolving to the job data
   * @throws NotFoundException if the job doesn't exist
   */
  async getJobById(id: string): Promise<JobDataDto | null> {
    const jobData = (await this.redisService.getChild<JobDataDto>(
      JobCollectionKey,
      this.workerPool.createJobKey(id),
    )) as JobDataDto;

    if (!jobData) {
      throw new NotFoundException(`Job ${id} does not exist`);
    }

    return jobData;
  }
}
