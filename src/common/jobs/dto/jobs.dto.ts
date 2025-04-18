import { ApiProperty } from '@nestjs/swagger';
import type { ULID } from 'ulid';

import { JobStatusEnum } from '@common/jobs/constants/jobs.constants';
import { WorkerEvent } from '@common/jobs/worker';

export class JobDataDto {
  @ApiProperty()
  id: ULID;

  @ApiProperty()
  status: JobStatusEnum;

  @ApiProperty()
  event: WorkerEvent;

  @ApiProperty()
  metadata?: any;
}

export type WorkerMessage = {
  success: boolean;
  data?: any;
  err?: Error;
};
