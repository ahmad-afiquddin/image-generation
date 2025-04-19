import { Body, Controller, Get, Param, Post, UploadedFile, UseInterceptors, ValidationPipe } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBody, ApiConsumes, ApiOperation, ApiResponse } from '@nestjs/swagger';

import { ImageValidationPipe } from '@common/pipes/image-validation.pipe';

import { CreateThumbnailReqDto, CreateThumbnailResDto, ThumbnailDto } from '@feature/image-tools/dto/image-tools.dto';
import { ImageToolsService } from '@feature/image-tools/image-tools.service';

@Controller('image-tools')
export class ImageToolsController {
  constructor(private readonly imageToolsService: ImageToolsService) {}

  @Get('thumbnails')
  @ApiOperation({
    summary: 'Return all created thumbnails',
  })
  @ApiResponse({ type: Array<ThumbnailDto>, description: 'thumbnails' })
  async getAllThumbnails() {
    return this.imageToolsService.getAllThumbnails();
  }

  @Get('thumbnails/:id')
  @ApiOperation({
    summary: 'Return all created thumbnails',
  })
  @ApiResponse({ type: ThumbnailDto, description: 'thumbnail by id' })
  async getThumbnailById(@Param('id') id: string) {
    return this.imageToolsService.getThumbnailById(id);
  }

  @Post('thumbnails')
  @ApiOperation({
    summary: 'Create a long-running job to convert image into thumbnail of specified dimensions',
  })
  @ApiConsumes('multipart/form-data')
  @ApiBody({ type: CreateThumbnailReqDto, description: 'Image file and optional dimensions' })
  @ApiResponse({ type: CreateThumbnailResDto, description: 'jobId to check status' })
  @UseInterceptors(FileInterceptor('image'))
  async generateThumbnail(
    @UploadedFile(new ImageValidationPipe(['image/jpeg', 'image/png', 'image/gif']))
    image: Express.Multer.File,
    @Body(new ValidationPipe({ transform: true }))
    options?: CreateThumbnailReqDto,
  ): Promise<string> {
    const response = await this.imageToolsService.generateThumbnail(image, options?.sizeX, options?.sizeY);
    return response;
  }
}
