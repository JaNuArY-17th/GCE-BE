import { Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'
import { S3Service } from '../../common/services/s3.service'
import { MediaController } from './media.controller'
import { MediaService } from './media.service'
import { Media } from './entities/media.entity'

@Module({
  imports: [TypeOrmModule.forFeature([Media])],
  controllers: [MediaController],
  providers: [MediaService, S3Service],
  exports: [MediaService],
})
export class MediaModule {}
