import { Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'
import baseOptions from './data-source'

@Module({
  imports: [
    TypeOrmModule.forRootAsync({
      useFactory: () => ({
        ...baseOptions,
        synchronize: false, // use migrations instead of sync
      }),
    }),
  ],
})
export class DatabaseModule {}
