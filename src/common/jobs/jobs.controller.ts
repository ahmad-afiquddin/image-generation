import { Controller, Get, Param } from '@nestjs/common';
import { ApiOperation, ApiResponse } from '@nestjs/swagger';

import { JobDataDto } from '@common/jobs/dto/jobs.dto';
import { JobsService } from '@common/jobs/jobs.service';

@Controller('jobs')
export class JobsController {
  constructor(private readonly jobsService: JobsService) {}

  @Get()
  @ApiOperation({
    summary: 'Get all jobs',
  })
  @ApiResponse({ type: Array<JobDataDto>, description: 'all jobs' })
  async getAllJobs(): Promise<JobDataDto[]> {
    return await this.jobsService.getAllJobs();
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Get job by id',
  })
  @ApiResponse({ type: JobDataDto, description: 'job by id' })
  async getJobById(@Param('id') id: string): Promise<JobDataDto | null> {
    return await this.jobsService.getJobById(id);
  }
}
