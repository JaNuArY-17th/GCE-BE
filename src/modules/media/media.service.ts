import { Injectable } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import { Media } from './entities/media.entity'

@Injectable()
export class MediaService {
  constructor(
    @InjectRepository(Media)
    private readonly mediaRepo: Repository<Media>,
  ) {}

  findAll() {
    return this.mediaRepo.find({ order: { createdAt: 'DESC' } })
  }

  findOne(id: string) {
    return this.mediaRepo.findOneBy({ id })
  }

  create(dto: Partial<Media>) {
    const entity = this.mediaRepo.create(dto)
    return this.mediaRepo.save(entity)
  }

  delete(id: string) {
    return this.mediaRepo.delete(id)
  }
}
