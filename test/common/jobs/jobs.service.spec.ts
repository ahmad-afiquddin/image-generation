import { NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';

import { JobCollectionKey, JobStatusEnum } from '@common/jobs/constants/jobs.constants';
import { JobDataDto } from '@common/jobs/dto/jobs.dto';
import { JobsService } from '@common/jobs/jobs.service';
import { WorkerPool } from '@common/jobs/worker-pool';
import { RedisService } from '@common/redis/redis.service';

describe('JobsService', () => {
  let service: JobsService;
  let redisService: jest.Mocked<RedisService>;
  let workerPool: jest.Mocked<WorkerPool>;

  const mockJobs: Record<string, JobDataDto> = {
    'jobs:job1': { id: 'job1', status: JobStatusEnum.SUCCESS, event: { id: 'job1', retries: 3 } },
    'jobs:job2': { id: 'job2', status: JobStatusEnum.PROCESSING, event: { id: 'job2', retries: 3 } },
  };

  beforeEach(async () => {
    const mockRedisService = {
      getAllChildren: jest.fn(),
      getChild: jest.fn(),
    };

    const mockWorkerPool = {
      createJobKey: jest.fn().mockImplementation((id) => `jobs:${id}`),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        JobsService,
        { provide: RedisService, useValue: mockRedisService },
        { provide: WorkerPool, useValue: mockWorkerPool },
      ],
    }).compile();

    service = module.get<JobsService>(JobsService);
    redisService = module.get(RedisService);
    workerPool = module.get(WorkerPool);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getAllJobs', () => {
    it('should return all jobs from Redis', async () => {
      redisService.getAllChildren.mockResolvedValue(mockJobs);

      const result = await service.getAllJobs();

      expect(redisService.getAllChildren).toHaveBeenCalledWith(JobCollectionKey);
      expect(result).toEqual(Object.values(mockJobs));
      expect(result).toHaveLength(2);
    });

    it('should return empty array when no jobs exist', async () => {
      redisService.getAllChildren.mockResolvedValue({});

      const result = await service.getAllJobs();

      expect(redisService.getAllChildren).toHaveBeenCalledWith(JobCollectionKey);
      expect(result).toEqual([]);
      expect(result).toHaveLength(0);
    });
  });

  describe('getJobById', () => {
    it('should return a job by id', async () => {
      const jobId = 'job1';
      const jobKey = `jobs:${jobId}`;
      const mockJob = mockJobs[jobKey];

      redisService.getChild.mockResolvedValue(mockJob);
      workerPool.createJobKey.mockReturnValue(jobKey);

      const result = await service.getJobById(jobId);

      expect(workerPool.createJobKey).toHaveBeenCalledWith(jobId);
      expect(redisService.getChild).toHaveBeenCalledWith(JobCollectionKey, jobKey);
      expect(result).toEqual(mockJob);
    });

    it('should return throw an error if job does not exist', async () => {
      const jobId = 'nonexistent';
      const jobKey = `jobs:${jobId}`;

      redisService.getChild.mockResolvedValue(null);
      workerPool.createJobKey.mockReturnValue(jobKey);

      await expect(service.getJobById(jobId)).rejects.toThrow(NotFoundException);

      expect(workerPool.createJobKey).toHaveBeenCalledWith(jobId);
      expect(redisService.getChild).toHaveBeenCalledWith(JobCollectionKey, jobKey);
    });
  });
});
