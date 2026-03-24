import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';

@Entity({ name: 'votes' })
@Index(['voteId', 'mssv', 'nomineeId'], { unique: true })
export class Vote {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', length: 100 })
  voteId!: string;

  @Column({ type: 'varchar', length: 100 })
  nomineeId!: string;

  @Column({ type: 'varchar', length: 50 })
  mssv!: string;

  @CreateDateColumn()
  createdAt!: Date;
}
