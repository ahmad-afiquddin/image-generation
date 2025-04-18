import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { LoggerModule } from 'nestjs-pino';

import { JobsModule } from '@common/jobs/jobs.module';
import { RedisModule } from '@common/redis/redis.module';
import { StorageModule } from '@common/storage/storage.module';

import { ImageToolsModule } from '@feature/image-tools/image-tools.module';

import { AppController } from './app.controller';

@Module({
  imports: [ConfigModule.forRoot(), LoggerModule.forRoot(), RedisModule, JobsModule, ImageToolsModule, StorageModule],
  controllers: [AppController],
})
export class AppModule {}
