import { Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'
import { NomineesController } from './nominees.controller'
import { NomineesService } from './nominees.service'
import { Nominee } from './entities/nominee.entity'

@Module({
  imports: [TypeOrmModule.forFeature([Nominee])],
  controllers: [NomineesController],
  providers: [NomineesService],
  exports: [NomineesService],
})
export class NomineesModule {}
