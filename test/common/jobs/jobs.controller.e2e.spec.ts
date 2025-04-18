/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-argument */
import { INestApplication, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import * as request from 'supertest';

import { JobStatusEnum } from '@common/jobs/constants/jobs.constants';
import { JobDataDto } from '@common/jobs/dto/jobs.dto';
import { JobsModule } from '@common/jobs/jobs.module';
import { JobsService } from '@common/jobs/jobs.service';

describe('JobsController (e2e)', () => {
  let app: INestApplication;

  const mockJobs: JobDataDto[] = [
    {
      id: 'job1',
      status: JobStatusEnum.SUCCESS,
      event: { id: 'job1', retries: 3 },
    },
    {
      id: 'job2',
      status: JobStatusEnum.PROCESSING,
      event: { id: 'job2', retries: 3 },
    },
  ];

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [JobsModule],
    })
      .overrideProvider(JobsService)
      .useValue({
        getAllJobs: jest.fn().mockResolvedValue(mockJobs),
        getJobById: jest.fn().mockImplementation((id: string) => {
          const job = mockJobs.find((job) => job.id === id);
          if (!job) {
            throw new NotFoundException(`Job ${id} does not exist`);
          }
          return Promise.resolve(job);
        }),
      })
      .compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  describe('/jobs (GET)', () => {
    it('should return all jobs', () => {
      return request(app.getHttpServer())
        .get('/jobs')
        .expect(200)
        .expect((res) => {
          expect(res.body).toHaveLength(mockJobs.length);
          expect(res.body[0].id).toBe('job1');
          expect(res.body[1].id).toBe('job2');
        });
    });
  });

  describe('/jobs/:id (GET)', () => {
    it('should return a job by id', () => {
      return request(app.getHttpServer())
        .get('/jobs/job1')
        .expect(200)
        .expect((res) => {
          expect(res.body.id).toBe('job1');
          expect(res.body.status).toBe(JobStatusEnum.SUCCESS);
        });
    });

    it('should return 404 if job not found', () => {
      return request(app.getHttpServer()).get('/jobs/nonexistent').expect(404);
    });
  });
});
