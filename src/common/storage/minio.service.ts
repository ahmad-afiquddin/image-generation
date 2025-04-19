import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as Minio from 'minio';

@Injectable()
export class MinioService {
  private readonly logger = new Logger(MinioService.name);
  private minioClient: Minio.Client;
  private bucketName: string;
  private publicUrl: string;
  private region: string;

  constructor(private readonly configService: ConfigService) {
    this.minioClient = new Minio.Client({
      endPoint: this.configService.get<string>('MINIO_ENDPOINT')!,
      port: this.configService.get<number>('MINIO_PORT'),
      useSSL: this.configService.get<string>('MINIO_USE_SSL') === 'true',
      accessKey: this.configService.get<string>('MINIO_ACCESS_KEY'),
      secretKey: this.configService.get<string>('MINIO_SECRET_KEY'),
    });

    this.bucketName = this.configService.get<string>('MINIO_BUCKET_NAME')!;
    this.publicUrl = this.configService.get<string>('MINIO_PUBLIC_URL')!;
    this.region = this.configService.get<string>('MINIO_REGION')!;
  }

  async onModuleInit() {
    const exists = await this.minioClient.bucketExists(this.bucketName);
    if (exists) {
      this.logger.log('[onModuleInit] Bucket %s exists', this.bucketName);
    } else {
      await this.minioClient.makeBucket(this.bucketName, this.region);
      this.logger.log('[onModuleInit] Bucket %s created in %s', this.bucketName, this.region);
    }
  }

  async uploadFileFromPath(filePath: string, outFileName: string) {
    await this.minioClient.fPutObject(this.bucketName, outFileName, filePath);
    return this.getFileUrl(outFileName);
  }

  getFileUrl(fileName: string) {
    return `${this.publicUrl}/${this.bucketName}/${fileName}`;
  }
}
