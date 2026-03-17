import { Injectable } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import { Nominee } from './entities/nominee.entity'

@Injectable()
export class NomineesService {
  constructor(
    @InjectRepository(Nominee)
    private readonly nomineeRepo: Repository<Nominee>,
  ) {}

  findAll(categoryId?: string) {
    const where = categoryId ? { categoryId } : {}
    return this.nomineeRepo.find({
      where,
      order: { name: 'ASC' },
    })
  }

  findOne(id: string) {
    return this.nomineeRepo.findOneBy({ id })
  }

  create(data: Partial<Nominee>) {
    const entity = this.nomineeRepo.create(data)
    return this.nomineeRepo.save(entity)
  }

  async update(id: string, data: Partial<Nominee>) {
    await this.nomineeRepo.update(id, data)
    return this.findOne(id)
  }

  delete(id: string) {
    return this.nomineeRepo.delete(id)
  }
}
