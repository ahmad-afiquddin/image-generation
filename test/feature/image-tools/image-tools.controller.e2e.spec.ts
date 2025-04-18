/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-unsafe-argument */
import { Buffer } from 'buffer';

import { INestApplication, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import * as request from 'supertest';

import { ThumbnailDto } from '@feature/image-tools/dto/image-tools.dto';
import { ImageToolsModule } from '@feature/image-tools/image-tools.module';
import { ImageToolsService } from '@feature/image-tools/image-tools.service';

describe('ImageToolsController (e2e)', () => {
  let app: INestApplication;
  let imageToolsService: ImageToolsService;

  const mockThumbnails: ThumbnailDto[] = [
    {
      outputFilePath: '/path/to/thumb1.jpg',
      url: 'http://localhost:3000/out/thumb1.jpg',
    },
    {
      outputFilePath: '/path/to/thumb2.jpg',
      url: 'http://localhost:3000/out/thumb2.jpg',
    },
  ];

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [ImageToolsModule],
    })
      .overrideProvider(ImageToolsService)
      .useValue({
        generateThumbnail: jest.fn().mockResolvedValue('thumbnail-job-id'),
        getAllThumbnails: jest.fn().mockResolvedValue(mockThumbnails),
        getThumbnailById: jest.fn().mockImplementation((id: string, origin: string) => {
          if (id === 'thumb1') {
            const thumbnail = { ...mockThumbnails[0] };
            return Promise.resolve(thumbnail);
          }
          if (id === 'thumb2') {
            const thumbnail = { ...mockThumbnails[1] };
            return Promise.resolve(thumbnail);
          }
          throw new NotFoundException(`Thumbnail ${id} does not exist`);
        }),
      })
      .compile();

    app = moduleFixture.createNestApplication();
    imageToolsService = moduleFixture.get<ImageToolsService>(ImageToolsService);
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  describe('/image-tools/thumbnails (POST)', () => {
    it('should generate a thumbnail and return job id', () => {
      // Create a mock image buffer
      const mockImage = Buffer.from('fake-image-content');

      return request(app.getHttpServer())
        .post('/image-tools/thumbnails')
        .attach('image', mockImage, 'test-image.jpg')
        .expect(201)
        .expect('thumbnail-job-id');
    });

    it('should accept custom thumbnail dimensions', () => {
      const mockImage = Buffer.from('fake-image-content');

      return request(app.getHttpServer())
        .post('/image-tools/thumbnails')
        .attach('image', mockImage, 'test-image.jpg')
        .field('sizeX', '200')
        .field('sizeY', '200')
        .expect(201)
        .expect('thumbnail-job-id');
    });

    it('should return 400 if no image is provided', () => {
      return request(app.getHttpServer()).post('/image-tools/thumbnails').expect(400);
    });
  });

  describe('/image-tools/thumbnails (GET)', () => {
    it('should return all thumbnails', () => {
      return request(app.getHttpServer())
        .get('/image-tools/thumbnails')
        .expect(200)
        .expect((res) => {
          expect(res.body).toHaveLength(mockThumbnails.length);
          expect(res.body[0].url).toBe(mockThumbnails[0].url);
          expect(res.body[1].url).toBe(mockThumbnails[1].url);
        });
    });
  });

  describe('/image-tools/thumbnails/:id (GET)', () => {
    it('should return a thumbnail by id', () => {
      return request(app.getHttpServer())
        .get('/image-tools/thumbnails/thumb1')
        .expect(200)
        .expect((res) => {
          expect(res.body.url).toBe(mockThumbnails[0].url);
          expect(res.body.outputFilePath).toBe(mockThumbnails[0].outputFilePath);
        });
    });

    it('should return 404 if thumbnail not found', () => {
      return request(app.getHttpServer())
        .get('/image-tools/thumbnails/nonexistent')
        .expect(404)
        .expect((res) => {
          expect(res.body.message).toBe('Thumbnail nonexistent does not exist');
          expect(res.body.error).toBe('Not Found');
          expect(res.body.statusCode).toBe(404);
        });
    });
  });
});
