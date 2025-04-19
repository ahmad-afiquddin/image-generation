import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

import { MinioService } from '@common/storage/minio.service';
import { StorageService } from '@common/storage/storage.service';

@Module({
  imports: [ConfigModule],
  providers: [StorageService, MinioService],
  exports: [StorageService, MinioService],
})
export class StorageModule {}
