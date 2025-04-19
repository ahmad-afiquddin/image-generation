import { BadRequestException, Injectable, PipeTransform } from '@nestjs/common';

/**
 * Validation pipe for image file uploads
 *
 * Validates that uploaded files are of permitted MIME types.
 * Used with NestJS controllers to validate file uploads before processing.
 */
@Injectable()
export class ImageValidationPipe implements PipeTransform {
  /** List of acceptable MIME types for uploaded images */
  /** Can be extended to accept other file types */
  private readonly acceptedMimeTypes = ['image/jpeg', 'image/png'];

  /**
   * Creates a new ImageValidationPipe instance
   *
   * @param mimeTypes - Array of accepted MIME types to override the defaults
   */
  constructor(mimeTypes: string[]) {
    this.acceptedMimeTypes = mimeTypes;
  }

  /**
   * Validates the uploaded file
   *
   * @param file - The file object from Multer middleware
   * @returns The validated file object if valid
   * @throws BadRequestException if file is missing or has invalid type
   */
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
