import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm'

@Entity({ name: 'media' })
export class Media {
  @PrimaryGeneratedColumn('uuid')
  id!: string

  @Column({ type: 'varchar', length: 500 })
  url!: string

  @Column({ type: 'varchar', length: 255, nullable: true })
  filename?: string

  @Column({ type: 'varchar', length: 50, nullable: true })
  mimeType?: string

  @Column({ type: 'int', nullable: true })
  size?: number

  @CreateDateColumn()
  createdAt!: Date
}
