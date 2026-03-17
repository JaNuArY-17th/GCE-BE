import { Injectable, OnModuleInit } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import { Voter } from './entities/user.entity'

@Injectable()
export class UsersService implements OnModuleInit {
  constructor(
    @InjectRepository(Voter)
    private readonly voterRepo: Repository<Voter>,
  ) {}

  async onModuleInit() {
    // seed a sample voter list if empty (can be replaced by true seed tooling)
    const count = await this.voterRepo.count()
    if (count === 0) {
      await this.voterRepo.save([
        {
          fullname: 'Nguyen Van A',
          mssv: '12345678',
          email: 'student@example.com',
        },
        {
          fullname: 'Tran Thi B',
          mssv: '87654321',
          email: 'student2@example.com',
        },
      ])
    }
  }

  findByMssv(mssv: string) {
    return this.voterRepo.findOneBy({ mssv })
  }

  async createVoter(voter: Partial<Voter>) {
    return this.voterRepo.save(voter)
  }

  async createBatch(voters: Partial<Voter>[]) {
    const entities = this.voterRepo.create(voters)
    return this.voterRepo.save(entities)
  }
}
