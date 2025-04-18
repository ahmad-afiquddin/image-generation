import { Module } from '@nestjs/common';

import { JobsController } from '@common/jobs/jobs.controller';
import { JobsService } from '@common/jobs/jobs.service';
import { WorkerPool } from '@common/jobs/worker-pool';
import { RedisModule } from '@common/redis/redis.module';

@Module({
  imports: [RedisModule],
  providers: [JobsService, WorkerPool],
  controllers: [JobsController],
  exports: [JobsService, WorkerPool],
})
export class JobsModule {}
