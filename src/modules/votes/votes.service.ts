import {
  Injectable,
  NotFoundException,
  UnauthorizedException,
  ConflictException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, ObjectLiteral, Repository, SelectQueryBuilder } from 'typeorm';
import { OAuth2Client, TokenPayload } from 'google-auth-library';
import { Voter } from '@modules/users/entities/user.entity';
import { Vote } from './entities/vote.entity';
import { Category } from '../categories/entities/category.entity';
import { Nominee } from '../nominees/entities/nominee.entity';
import { Media } from '../media/entities/media.entity';

export type VoteCategoryType = 'person' | 'club' | 'event';

export interface VoteCategory {
  id: string;
  slug: string;
  title: string;
  type: VoteCategoryType;
  themeColor?: string;
  description?: string;
  date?: string;
  location?: string;
  maxVotes?: number;
}

export interface VoteNominee {
  id: string;
  name: string;
  imageUrl?: string;
  description?: string;
  date?: string;
  location?: string;
}

type SeedNominee = {
  name: string;
  description?: string;
};

export interface VoteSubmission {
  voteId: string;
  nomineeId: string;
  mssv: string;
  idToken: string;
}

type VoteDateRangeInput = {
  startDate?: string;
  endDate?: string;
};

type VoterListOptions = VoteDateRangeInput & {
  search?: string;
  hasVoted?: boolean;
  page?: number;
  pageSize?: number;
};

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
}

@Injectable()
export class VotesService {
  private readonly oauthClient: OAuth2Client;

  constructor(
    @InjectRepository(Voter)
    private readonly voterRepo: Repository<Voter>,
    @InjectRepository(Vote)
    private readonly voteRepo: Repository<Vote>,
    @InjectRepository(Category)
    private readonly categoryRepo: Repository<Category>,
    @InjectRepository(Nominee)
    private readonly nomineeRepo: Repository<Nominee>,
    @InjectRepository(Media)
    private readonly mediaRepo: Repository<Media>,
    private readonly dataSource: DataSource,
  ) {
    this.oauthClient = new OAuth2Client(process.env.GOOGLE_OAUTH_CLIENT_ID);
  }

  getCategories(): Promise<VoteCategory[]> {
    return this.categoryRepo.find({ order: { slug: 'ASC' } }).then((cats) =>
      cats.map((cat) => ({
        id: cat.id,
        slug: cat.slug,
        title: cat.title,
        type: cat.type as VoteCategoryType,
        description: cat.description,
        maxVotes: cat.maxVotes ?? 1,
      })),
    );
  }

  private async findCategoryByIdOrSlug(voteId: string): Promise<Category> {
    let category: Category | null = null;

    if (isUuid(voteId)) {
      category = await this.categoryRepo.findOneBy({ id: voteId });
    }

    if (!category) {
      category = await this.categoryRepo.findOneBy({ slug: voteId });
    }
    if (!category) {
      throw new NotFoundException(`Unknown vote category: ${voteId}`);
    }
    return category;
  }

  async getNominees(voteId: string): Promise<VoteNominee[]> {
    const category = await this.findCategoryByIdOrSlug(voteId);

    const nominees = await this.nomineeRepo.find({
      where: { categoryId: category.id },
      relations: ['media'],
      order: { name: 'ASC' },
    });
    return nominees.map((n) => ({
      id: n.id,
      name: n.name,
      description: n.description,
      imageUrl: n.media?.[0]?.url,
      imageUrls: n.media?.map((m) => m.url) ?? [],
      date: undefined,
      location: undefined,
    }));
  }

  private normalizeMssv(mssv: string): string {
    return String(mssv || '').trim().toUpperCase();
  }

  async submitVote({ voteId, nomineeId, mssv, idToken }: VoteSubmission): Promise<{ specialData?: string }> {
    const normalizedMssv = this.normalizeMssv(mssv);
    const category = await this.findCategoryByIdOrSlug(voteId);

    const voter = await this.voterRepo.findOneBy({ mssv: normalizedMssv });
    if (!voter) {
      throw new NotFoundException('Không tìm thấy người dùng với MSSV này.');
    }

    if (voter.hasVoted) {
      throw new ConflictException('MSSV này đã bỏ phiếu.');
    }

    const payload = await this.verifyGoogleToken(idToken);
    const tokenEmail = payload?.email ? String(payload.email).trim().toUpperCase() : '';
    const voterEmail = voter.email ? String(voter.email).trim().toUpperCase() : '';

    if (!payload || tokenEmail !== voterEmail || !payload.email_verified) {
      throw new UnauthorizedException('Email không hợp lệ! \nVui lòng sử dụng Email đăng nhập trên AP.');
    }

    const nominees = await this.getNominees(category.id);
    const nomineeExists = nominees.some((n) => n.id === nomineeId);
    if (!nomineeExists) {
      throw new NotFoundException(`Không tìm thấy ứng viên.`);
    }

    // Restrict votes per MSSV per category based on category.maxVotes
    const maxVotes = category.maxVotes ?? 1;
    const voteCount = await this.voteRepo.count({
      where: { voteId: category.id, mssv: normalizedMssv },
    });
    if (voteCount >= maxVotes) {
      throw new ConflictException(
        'Bạn đã bỏ phiếu đủ số lượng cho hạng mục này.',
      );
    }

    // Prevent voting for the same nominee twice in the same category
    const duplicate = await this.voteRepo.findOneBy({
      voteId: category.id,
      mssv: normalizedMssv,
      nomineeId,
    });
    if (duplicate) {
      throw new ConflictException('Bạn đã bỏ phiếu cho ứng viên này rồi.');
    }

    await this.voteRepo.save({ voteId: category.id, nomineeId, mssv: normalizedMssv });

    // Mark voter flag
    await this.voterRepo.update({ id: voter.id }, { hasVoted: true });

    const specialDataMap: Record<string, string> = {
      GBH220312: 'mew',
      GBH221084: 'ss',
      GCH230163: 'tnc',
      GCH230179: 'mew',
    };

    const specialData = specialDataMap[normalizedMssv];

    return { specialData };
  }

  /**
   * Submit multiple vote choices atomically.
   * - Verifies the Google token and voter ONCE (not per choice).
   * - Wraps all database writes in a single transaction so it's all-or-nothing.
   * - Processes choices sequentially to avoid race conditions on hasVoted.
   */
  async submitAllVotes(
    mssv: string,
    idToken: string,
    choices: Array<{ voteId: string; nomineeId: string }>,
  ): Promise<{ specialData?: string }> {
    const normalizedMssv = this.normalizeMssv(mssv);

    // 1. Verify voter exists and hasn't already voted
    const voter = await this.voterRepo.findOneBy({ mssv: normalizedMssv });
    if (!voter) {
      throw new NotFoundException('Không tìm thấy người dùng với MSSV này.');
    }
    if (voter.hasVoted) {
      throw new ConflictException('MSSV này đã bỏ phiếu.');
    }

    // 2. Verify Google token once for all choices
    const payload = await this.verifyGoogleToken(idToken);
    const tokenEmail = payload?.email ? String(payload.email).trim().toUpperCase() : '';
    const voterEmail = voter.email ? String(voter.email).trim().toUpperCase() : '';
    if (!payload || tokenEmail !== voterEmail || !payload.email_verified) {
      throw new UnauthorizedException('Email không hợp lệ! \nVui lòng sử dụng Email đăng nhập trên AP.');
    }

    // 3. Resolve all categories and validate nominees before touching the DB
    const resolvedChoices: Array<{ categoryId: string; nomineeId: string }> = [];
    // Track how many choices for each category are already in this batch (pre-write).
    // Without this, for multi-vote categories (maxVotes > 1), voteCount from DB stays 0
    // for all choices in the batch (nothing written yet), so the maxVotes cap would not
    // be enforced within a single request.
    const batchCountByCategory = new Map<string, number>();

    for (const choice of choices) {
      const category = await this.findCategoryByIdOrSlug(choice.voteId);

      const nominees = await this.getNominees(category.id);
      if (!nominees.some((n) => n.id === choice.nomineeId)) {
        throw new NotFoundException(`Không tìm thấy ứng viên.`);
      }

      const maxVotes = category.maxVotes ?? 1;
      const dbCount = await this.voteRepo.count({ where: { voteId: category.id, mssv: normalizedMssv } });
      const batchCount = batchCountByCategory.get(category.id) ?? 0;
      if (dbCount + batchCount >= maxVotes) {
        throw new ConflictException('Bạn đã bỏ phiếu đủ số lượng cho hạng mục này.');
      }

      const duplicate = await this.voteRepo.findOneBy({ voteId: category.id, mssv: normalizedMssv, nomineeId: choice.nomineeId });
      if (duplicate) {
        throw new ConflictException('Bạn đã bỏ phiếu cho ứng viên này rồi.');
      }

      batchCountByCategory.set(category.id, batchCount + 1);
      resolvedChoices.push({ categoryId: category.id, nomineeId: choice.nomineeId });
    }

    // 4. Write all votes + mark hasVoted in a single transaction
    await this.dataSource.transaction(async (manager) => {
      for (const { categoryId, nomineeId } of resolvedChoices) {
        await manager.save(Vote, { voteId: categoryId, nomineeId, mssv: normalizedMssv });
      }
      await manager.update(Voter, { id: voter.id }, { hasVoted: true });
    });

    const specialDataMap: Record<string, string> = {
      GBH220312: 'mew',
      GBH221084: 'ss',
      GCH230163: 'tnc',
      GCH230179: 'mew',
    };
    return { specialData: specialDataMap[normalizedMssv] };
  }

  async getVoteHistory(mssv: string) {
    const normalizedMssv = this.normalizeMssv(mssv);

    const history = await this.voteRepo
      .createQueryBuilder('vote')
      .select([
        'vote.id AS vote_id',
        'vote.voteId AS vote_voteId',
        'vote.nomineeId AS vote_nomineeId',
        'vote.createdAt AS vote_createdAt',
      ])
      .addSelect([
        'nominee.id AS nominee_id',
        'nominee.name AS nominee_name',
        'nominee.description AS nominee_description',
      ])
      .addSelect([
        'category.id AS category_id',
        'category.slug AS category_slug',
        'category.title AS category_title',
      ])
      .leftJoin(Nominee, 'nominee', 'nominee.id = vote.nomineeId')
      .leftJoin(Category, 'category', 'category.id = nominee.categoryId')
      .where('vote.mssv = :mssv', { mssv: normalizedMssv })
      .orderBy('vote.createdAt', 'DESC')
      .getRawMany<any>();

    const nomineeIds = Array.from(new Set(history.map((r) => r.nominee_id)));
    const medias = await this.mediaRepo.find({
      where: { nomineeId: In(nomineeIds) },
      order: { createdAt: 'ASC' },
    });
    const mediaMap = medias.reduce((acc, media) => {
      if (!acc[media.nomineeId]) {
        acc[media.nomineeId] = media;
      }
      return acc;
    }, {} as Record<string, Media>);

    return history.map((row) => ({
      id: row.vote_id,
      voteId: row.vote_voteId,
      createdAt: row.vote_createdAt,
      nominee: {
        id: row.nominee_id,
        name: row.nominee_name,
        description: row.nominee_description,
        imageUrl: mediaMap[row.nominee_id]?.url,
      },
      category: {
        id: row.category_id,
        slug: row.category_slug,
        title: row.category_title,
      },
    }));
  }

  async getResults(
    voteId: string,
    filters?: VoteDateRangeInput,
  ): Promise<Record<string, number>> {
    const { startDate, endDate } = this.normalizeDateRange(filters);
    const category = await this.findCategoryByIdOrSlug(voteId);
    const nominees = await this.getNominees(category.id);

    const raw = await this.voteRepo
      .createQueryBuilder('vote')
      .select('vote.nomineeId', 'nomineeId')
      .addSelect('COUNT(vote.id)', 'count')
      .where('vote.voteId IN (:...voteIds)', {
        voteIds: [category.id, category.slug],
      })
      .groupBy('vote.nomineeId');

    this.applyVoteDateFilter(raw, 'vote', startDate, endDate);

    const results = await raw.getRawMany<{ nomineeId: string; count: string }>();

    const counts = results.reduce(
      (acc, row) => {
        acc[row.nomineeId] = Number(row.count);
        return acc;
      },
      {} as Record<string, number>,
    );

    return nominees.reduce(
      (acc, nominee) => {
        acc[nominee.id] = counts[nominee.id] ?? 0;
        return acc;
      },
      {} as Record<string, number>,
    );
  }

  async getVoteStats(filters?: VoteDateRangeInput) {
    const { startDate, endDate } = this.normalizeDateRange(filters);
    const qb = this.voteRepo
      .createQueryBuilder('vote')
      .select('COUNT(vote.id)', 'totalVoteRecords');

    this.applyVoteDateFilter(qb, 'vote', startDate, endDate);

    const raw = await qb.getRawOne<{ totalVoteRecords: string }>();
    const totalVoteRecords = Number(raw?.totalVoteRecords ?? 0);

    return {
      totalVoteRecords,
      totalVoters: Math.floor(totalVoteRecords / 5),
      dateRange: {
        startDate: startDate?.toISOString(),
        endDate: endDate?.toISOString(),
      },
    };
  }

  async listVoters(options: VoterListOptions) {
    const sanitizedPage = Math.max(1, options.page ?? 1);
    const sanitizedPageSize = Math.min(Math.max(options.pageSize ?? 20, 1), 100);
    const { startDate, endDate } = this.normalizeDateRange(options);

    const summaryQb = this.voteRepo
      .createQueryBuilder('vote')
      .select('vote.mssv', 'mssv')
      .addSelect('COUNT(vote.id)', 'votes_count')
      .addSelect('MAX(vote.createdAt)', 'last_voted_at')
      .groupBy('vote.mssv');

    this.applyVoteDateFilter(summaryQb, 'vote', startDate, endDate);

    const baseQb = this.voterRepo
      .createQueryBuilder('voter')
      .leftJoin(
        `(${summaryQb.getQuery()})`,
        'vote_summary',
        'vote_summary.mssv = voter.mssv',
      )
      .setParameters(summaryQb.getParameters())
      .select([
        'voter.id AS voter_id',
        'voter.fullname AS voter_fullname',
        'voter.mssv AS voter_mssv',
        'voter.email AS voter_email',
        'voter.hasVoted AS voter_hasVoted',
        'vote_summary.votes_count AS vote_summary_votes_count',
        'vote_summary.last_voted_at AS vote_summary_last_voted_at',
      ]);

    const searchTerm = options.search?.trim();
    if (searchTerm) {
      baseQb.andWhere(
        '(voter.fullname ILIKE :searchTerm OR voter.mssv ILIKE :searchTerm)',
        { searchTerm: `%${searchTerm}%` },
      );
    }

    if (options.hasVoted === true) {
      baseQb.andWhere('vote_summary.votes_count > 0');
    } else if (options.hasVoted === false) {
      baseQb.andWhere('COALESCE(vote_summary.votes_count, 0) = 0');
    }

    const dataQb = baseQb.clone();
    const countQb = baseQb.clone().select('COUNT(voter.id)', 'count');

    const rows = await dataQb
      .orderBy('voter.fullname', 'ASC')
      .offset((sanitizedPage - 1) * sanitizedPageSize)
      .limit(sanitizedPageSize)
      .getRawMany<any>();

    const totalRaw = await countQb.getRawOne<{ count: string }>();
    const total = Number(totalRaw?.count ?? 0);

    return {
      page: sanitizedPage,
      pageSize: sanitizedPageSize,
      total,
      items: rows.map((row) => ({
        id: row.voter_id,
        fullname: row.voter_fullname,
        mssv: row.voter_mssv,
        email: row.voter_email,
        hasVoted: Boolean(row.voter_hasVoted),
        votesInRange: Number(row.vote_summary_votes_count ?? 0),
        lastVotedAt: row.vote_summary_last_voted_at
          ? new Date(row.vote_summary_last_voted_at)
          : undefined,
      })),
    };
  }

  private normalizeDateRange(filters?: VoteDateRangeInput) {
    return {
      startDate: this.parseDate(filters?.startDate, false),
      endDate: this.parseDate(filters?.endDate, true),
    };
  }

  private parseDate(value?: string, endOfDay = false): Date | undefined {
    if (!value) {
      return undefined;
    }

    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      return undefined;
    }

    // If value is date-only like '2026-03-23', treat endDate as end of the day.
    const isDateOnly = /^\d{4}-\d{2}-\d{2}$/.test(value);
    if (endOfDay && isDateOnly) {
      date.setHours(23, 59, 59, 999);
    }

    return date;
  }

  private applyVoteDateFilter(
    qb: SelectQueryBuilder<ObjectLiteral>,
    alias: string,
    startDate?: Date,
    endDate?: Date,
  ) {
    if (startDate) {
      qb.andWhere(`${alias}.createdAt >= :startDate`, { startDate });
    }
    if (endDate) {
      qb.andWhere(`${alias}.createdAt <= :endDate`, { endDate });
    }
  }

  private async verifyGoogleToken(
    idToken: string,
  ): Promise<TokenPayload | null> {
    if (
      process.env.NODE_ENV === 'test' ||
      process.env.SKIP_GOOGLE_OAUTH === 'true'
    ) {
      return {
        email: 'student@example.com',
        email_verified: true,
      } as unknown as TokenPayload;
    }

    const ticket = await this.oauthClient.verifyIdToken({
      idToken,
      audience: process.env.GOOGLE_OAUTH_CLIENT_ID,
    });
    return ticket.getPayload() ?? null;
  }

  /**
   * Return true when current date is within the allowed voting window.
   * Not used by default, but can be hooked into controllers as needed.
   */
  isVotingOpen(): boolean {
    const start = process.env.VOTE_DATE_START
      ? new Date(process.env.VOTE_DATE_START)
      : null;
    const end = process.env.VOTE_DATE_END
      ? new Date(process.env.VOTE_DATE_END)
      : null;
    const now = new Date();

    if (!start && !end) return true;
    if (start && now < start) return false;
    if (end && now > end) return false;
    return true;
  }
}
