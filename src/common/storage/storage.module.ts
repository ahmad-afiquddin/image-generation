import { Module } from '@nestjs/common';

import { MinioService } from '@common/storage/minio.service';
import { StorageService } from '@common/storage/storage.service';

@Module({
  providers: [StorageService, MinioService],
  exports: [StorageService],
})
export class StorageModule {}
