import { Injectable } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import { Category } from './entities/category.entity'

@Injectable()
export class CategoriesService {
  constructor(
    @InjectRepository(Category)
    private readonly categoryRepo: Repository<Category>,
  ) {}

  findAll() {
    return this.categoryRepo.find({ order: { title: 'ASC' } })
  }

  findOne(id: string) {
    return this.categoryRepo.findOneBy({ id })
  }

  create(data: Partial<Category>) {
    const entity = this.categoryRepo.create(data)
    return this.categoryRepo.save(entity)
  }

  async update(id: string, data: Partial<Category>) {
    await this.categoryRepo.update(id, data)
    return this.findOne(id)
  }

  delete(id: string) {
    return this.categoryRepo.delete(id)
  }
}
