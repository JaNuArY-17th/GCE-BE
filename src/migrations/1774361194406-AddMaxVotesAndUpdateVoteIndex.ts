import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddMaxVotesAndUpdateVoteIndex1774361194406 implements MigrationInterface {
  name = 'AddMaxVotesAndUpdateVoteIndex1774361194406';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1. Add max_votes column to categories (default 1)
    const hasMaxVotes = await queryRunner.hasColumn('categories', 'max_votes');
    if (!hasMaxVotes) {
      await queryRunner.query(
        `ALTER TABLE "categories" ADD COLUMN "max_votes" integer NOT NULL DEFAULT 1`,
      );
    }

    // 2. Set max_votes = 3 for community & rookie categories
    await queryRunner.query(
      `UPDATE "categories" SET "max_votes" = 3 WHERE "slug" IN ('community', 'rookie')`,
    );

    // 3. Drop old unique index on (vote_id, mssv) if it exists
    // TypeORM creates indexes named like IDX_<hash>; drop by constraint name pattern
    await queryRunner.query(`
      DO $$
      DECLARE
        idx_name text;
      BEGIN
        SELECT indexname INTO idx_name
        FROM pg_indexes
        WHERE tablename = 'votes'
          AND indexdef LIKE '%("voteId", mssv)%'
           OR (tablename = 'votes' AND indexdef LIKE '%"voteId"%' AND indexdef LIKE '%mssv%' AND indexdef NOT LIKE '%"nomineeId"%');
        IF idx_name IS NOT NULL THEN
          EXECUTE 'DROP INDEX IF EXISTS "' || idx_name || '"';
        END IF;
      END
      $$;
    `);

    // Also try the common TypeORM-generated name pattern
    await queryRunner.query(`
      DROP INDEX IF EXISTS "IDX_votes_voteId_mssv";
    `);

    // 4. Create new unique index on (voteId, mssv, nomineeId)
    const hasNewIndex = await queryRunner.query(`
      SELECT 1 FROM pg_indexes
      WHERE tablename = 'votes'
        AND indexdef LIKE '%"voteId"%'
        AND indexdef LIKE '%mssv%'
        AND indexdef LIKE '%"nomineeId"%'
      LIMIT 1
    `);

    if (!hasNewIndex?.length) {
      await queryRunner.query(
        `CREATE UNIQUE INDEX "IDX_votes_voteId_mssv_nomineeId" ON "votes" ("voteId", "mssv", "nomineeId")`,
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Restore original state

    // 1. Drop the new composite unique index
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_votes_voteId_mssv_nomineeId"`);

    // 2. Re-create the old (voteId, mssv) unique index
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_votes_voteId_mssv" ON "votes" ("voteId", "mssv")`,
    );

    // 3. Remove max_votes column from categories
    const hasMaxVotes = await queryRunner.hasColumn('categories', 'max_votes');
    if (hasMaxVotes) {
      await queryRunner.query(`ALTER TABLE "categories" DROP COLUMN "max_votes"`);
    }
  }
}
