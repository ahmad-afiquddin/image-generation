import { Injectable, NotFoundException } from '@nestjs/common';

import { JobCollectionKey } from '@common/jobs/constants/jobs.constants';
import { JobDataDto } from '@common/jobs/dto/jobs.dto';
import { WorkerPool } from '@common/jobs/worker-pool';
import { RedisService } from '@common/redis/redis.service';

@Injectable()
export class JobsService {
  constructor(
    private readonly redisService: RedisService,
    private readonly workerPool: WorkerPool,
  ) {}

  async getAllJobs(): Promise<JobDataDto[]> {
    const jobs = await this.redisService.getAllChildren<JobDataDto>(JobCollectionKey);
    return Object.values(jobs);
  }

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
