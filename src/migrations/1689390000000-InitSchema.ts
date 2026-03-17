import { MigrationInterface, QueryRunner, Table, TableIndex } from 'typeorm'

export class InitSchema1689390000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'voters',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            isGenerated: true,
            generationStrategy: 'uuid',
          },
          {
            name: 'fullname',
            type: 'varchar',
            length: '255',
            isNullable: false,
          },
          {
            name: 'mssv',
            type: 'varchar',
            length: '50',
            isNullable: false,
          },
          {
            name: 'email',
            type: 'varchar',
            length: '255',
            isNullable: false,
          },
        ],
      }),
      true,
    )

    await queryRunner.createIndex(
      'voters',
      new TableIndex({
        name: 'IDX_VOTERS_MSSV',
        columnNames: ['mssv'],
        isUnique: true,
      }),
    )

    await queryRunner.createTable(
      new Table({
        name: 'votes',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            isGenerated: true,
            generationStrategy: 'uuid',
          },
          {
            name: 'voteId',
            type: 'varchar',
            length: '100',
            isNullable: false,
          },
          {
            name: 'nomineeId',
            type: 'varchar',
            length: '100',
            isNullable: false,
          },
          {
            name: 'mssv',
            type: 'varchar',
            length: '50',
            isNullable: false,
          },
          {
            name: 'createdAt',
            type: 'timestamp',
            default: 'NOW()',
          },
        ],
      }),
      true,
    )

    await queryRunner.createIndex(
      'votes',
      new TableIndex({
        name: 'IDX_VOTES_UNIQUE_VOTE_MSSV',
        columnNames: ['voteId', 'mssv'],
        isUnique: true,
      }),
    )
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('votes')
    await queryRunner.dropTable('voters')
  }
}
