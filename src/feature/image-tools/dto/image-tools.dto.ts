import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsInt } from 'class-validator';

export class CreateThumbnailReqDto {
  @ApiProperty({
    type: File,
  })
  image: Express.Multer.File;

  @ApiPropertyOptional({ default: 100 })
  @Transform(({ value }) => (Number.isNaN(+value) ? 100 : +value))
  @IsInt()
  sizeX?: number = 100;

  @ApiPropertyOptional({ default: 100 })
  @Transform(({ value }) => (Number.isNaN(+value) ? 100 : +value))
  @IsInt()
  sizeY?: number = 100;
}

export class CreateThumbnailResDto {
  @ApiProperty()
  jobId: string;
}

export class ThumbnailDto {
  @ApiProperty()
  outputFilePath: string;

  @ApiProperty()
  url: string;
}
