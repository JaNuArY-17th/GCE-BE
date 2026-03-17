import { Body, Controller, Delete, Get, Param, Post, UseGuards } from '@nestjs/common'
import { JwtAuthGuard } from '@common/guards/jwt-auth.guard'
import { S3Service } from '@common/services/s3.service'
import { MediaService } from './media.service'
import { Media } from './entities/media.entity'
import { GetPresignedUrlDto } from './dtos/get-presigned-url.dto'
import crypto from 'crypto'

@Controller('api/media')
export class MediaController {
  constructor(
    private readonly mediaService: MediaService,
    private readonly s3Service: S3Service,
  ) {}

  @Get()
  findAll() {
    return this.mediaService.findAll()
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.mediaService.findOne(id)
  }

  @UseGuards(JwtAuthGuard)
  @Post('presign')
  async getPresignedUrl(@Body() dto: GetPresignedUrlDto) {
    const key = `uploads/${crypto.randomUUID()}-${dto.filename}`
    const { url } = await this.s3Service.createPresignedUploadUrl(key, dto.contentType)
    return { url, key }
  }

  @UseGuards(JwtAuthGuard)
  @Post()
  create(@Body() dto: Partial<Media>) {
    return this.mediaService.create(dto)
  }

  @UseGuards(JwtAuthGuard)
  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.mediaService.delete(id)
  }
}
