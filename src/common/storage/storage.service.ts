import { existsSync, mkdirSync, promises as fsPromises, unlink } from 'fs';
import { extname, join, parse } from 'path';

import { Injectable, Logger } from '@nestjs/common';
import { ulid } from 'ulid';

import { UploadDirEnum } from './constants/storage.constants';

@Injectable()
export class StorageService {
  private saveDirectories: Record<UploadDirEnum, string> = {
    out: join(process.cwd(), './public/out'),
    temp: join(process.cwd(), './public/temp'),
  };
  private readonly logger = new Logger(StorageService.name);

  constructor() {}

  onModuleInit() {
    this.createDirectoryIfNotExists(this.saveDirectories.out);
    this.createDirectoryIfNotExists(this.saveDirectories.temp);
  }

  private createDirectoryIfNotExists(path: string) {
    if (!existsSync(path)) {
      mkdirSync(path);
    }
  }

  public async saveFileToDir(
    file: Express.Multer.File,
    dirName = UploadDirEnum.TEMP,
    fileName?: string,
  ): Promise<[string, string, string]> {
    const fileExt = extname(file.originalname);

    if (!fileName) {
      fileName = `${parse(file.originalname).name}-${Date.now()}`;
    }

    const filePath = this.createFilePath(dirName, fileExt, fileName);

    await fsPromises.writeFile(filePath, file.buffer);
    this.logger.log('[saveFileToDir] Successfully saved file: %s', filePath);

    return [filePath, fileName, fileExt];
  }

  public createFilePath(dirName = UploadDirEnum.TEMP, fileExt: string, fileName?: string): string {
    if (!fileName) {
      fileName = `${ulid()}`;
    }

    fileName = `${fileName}${fileExt}`;

    const filePath = join(this.saveDirectories[dirName], fileName);

    return filePath;
  }

  public deleteFile(filePath: string) {
    if (existsSync(filePath)) {
      unlink(filePath, (err) => {
        if (err) throw err;
      });
    } else {
      throw Error('File does not exist!');
    }
  }
}
