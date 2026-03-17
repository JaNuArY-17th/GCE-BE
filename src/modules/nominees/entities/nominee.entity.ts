import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm'
import { Category } from '../../categories/entities/category.entity'

@Entity({ name: 'nominees' })
export class Nominee {
  @PrimaryGeneratedColumn('uuid')
  id!: string

  @ManyToOne(() => Category, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'categoryId' })
  category!: Category

  @Column({ type: 'uuid' })
  categoryId!: string

  @Column({ type: 'varchar', length: 255 })
  name!: string

  @Column({ type: 'text', nullable: true })
  description?: string

  @Column({ type: 'varchar', length: 255, nullable: true })
  imageUrl?: string

  @Column({ type: 'jsonb', nullable: true })
  metadata?: Record<string, any>

}
