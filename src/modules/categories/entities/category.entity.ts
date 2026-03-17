import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm'

export type CategoryType = 'club' | 'event' | 'person' | 'other'

@Entity({ name: 'categories' })
export class Category {
  @PrimaryGeneratedColumn('uuid')
  id!: string

  @Column({ type: 'varchar', length: 100, unique: true })
  slug!: string

  @Column({ type: 'varchar', length: 255 })
  title!: string

  @Column({ type: 'text', nullable: true })
  description?: string

  @Column({ type: 'varchar', length: 50, default: 'other' })
  type!: CategoryType

}
