import { BadRequestException, Injectable, PipeTransform } from '@nestjs/common';

@Injectable()
export class ImageValidationPipe implements PipeTransform {
  private readonly acceptedMimeTypes = ['image/jpeg', 'image/png'];

  constructor(mimeTypes: string[]) {
    this.acceptedMimeTypes = mimeTypes;
  }

  // Validate file type here
  transform(file: Express.Multer.File) {
    if (!file) {
      throw new BadRequestException('No file uploaded');
    }

    if (!this.acceptedMimeTypes.includes(file.mimetype)) {
      throw new BadRequestException(`Invalid file type. Accepted types: ${this.acceptedMimeTypes.join(', ')}`);
    }

    return file;
  }
}
