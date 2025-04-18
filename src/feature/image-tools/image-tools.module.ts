import { Module } from '@nestjs/common';

import { JobsModule } from '@common/jobs/jobs.module';
import { RedisModule } from '@common/redis/redis.module';
import { StorageModule } from '@common/storage/storage.module';

import { ImageToolsHook } from '@feature/image-tools/hooks/image-tools.hook';
import { ImageToolsController } from '@feature/image-tools/image-tools.controller';
import { ImageToolsService } from '@feature/image-tools/image-tools.service';

@Module({
  imports: [JobsModule, StorageModule, RedisModule],
  providers: [ImageToolsService, ImageToolsHook],
  controllers: [ImageToolsController],
})
export class ImageToolsModule {}
