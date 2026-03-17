import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm'

@Entity({ name: 'voters' })
export class Voter {
  @PrimaryGeneratedColumn('uuid')
  id!: string

  @Column({ type: 'varchar', length: 255 })
  fullname!: string

  @Index({ unique: true })
  @Column({ type: 'varchar', length: 50 })
  mssv!: string

  @Column({ type: 'varchar', length: 255 })
  email!: string
}
