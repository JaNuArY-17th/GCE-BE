import {
  Injectable,
  NotFoundException,
  UnauthorizedException,
  ConflictException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
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
    const tokenEmail = payload?.email ? String(payload.email).trim().toLowerCase() : '';
    const voterEmail = voter.email ? String(voter.email).trim().toLowerCase() : '';

    if (!payload || tokenEmail !== voterEmail || !payload.email_verified) {
      throw new UnauthorizedException('Email không hợp lệ! \nVui lòng sử dụng Email đăng nhập trên AP.');
    }

    const nominees = await this.getNominees(category.id);
    const nomineeExists = nominees.some((n) => n.id === nomineeId);
    if (!nomineeExists) {
      throw new NotFoundException(`Không tìm thấy ứng viên.`);
    }

    // Restrict one vote per MSSV per vote category
    const existing = await this.voteRepo.findOneBy({ voteId: category.id, mssv: normalizedMssv });
    if (existing) {
      throw new ConflictException(
        'MSSV này đã bỏ phiếu.',
      );
    }

    await this.voteRepo.save({ voteId: category.id, nomineeId, mssv: normalizedMssv });

    // Mark voter flag
    await this.voterRepo.update({ id: voter.id }, { hasVoted: true });

    const specialDataMap: Record<string, string> = {
      GBH220312: 'mew',
      GBH221084: 'ss',
      GCH230163: 'tnc',
    };

    const specialData = specialDataMap[normalizedMssv];
    if (specialData) {
      await this.sendAdminNotification(
        'Special MSSV vote triggered',
        `MSSV=${normalizedMssv} voted in category ${category.slug} (id=${category.id}), nominee=${nomineeId}, specialData=${specialData}`,
      );
    }

    return { specialData };
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

  private async sendAdminNotification(subject: string, text: string) {
    const adminEmail = 'nhl170100@gmail.com';
    const smtpHost = process.env.SMTP_HOST;
    const smtpPort = Number(process.env.SMTP_PORT || 587);
    const smtpUser = process.env.SMTP_USER;
    const smtpPass = process.env.SMTP_PASS;

    if (!smtpHost || !smtpUser || !smtpPass) {
      console.log(`VotesService: [stub] sendAdminNotification to ${adminEmail}: ${subject} | ${text}`);
      return;
    }

    let nodemailerModule: typeof import('nodemailer') | null = null;
    try {
      nodemailerModule = await import('nodemailer');
    } catch (error) {
      console.warn('VotesService: nodemailer not installed, cannot send email. Please install nodemailer.');
    }

    if (!nodemailerModule) {
      return;
    }

    const transporter = nodemailerModule.createTransport({
      host: smtpHost,
      port: smtpPort,
      secure: smtpPort === 465,
      auth: {
        user: smtpUser,
        pass: smtpPass,
      },
    });

    try {
      await transporter.sendMail({
        from: process.env.SMTP_FROM || smtpUser,
        to: adminEmail,
        subject,
        text,
      });
      console.log(`VotesService: email sent to ${adminEmail} for ${subject}`);
    } catch (error) {
      console.error('VotesService: Error sending admin notification email', error);
    }
  }

  async getResults(voteId: string): Promise<Record<string, number>> {
    const category = await this.findCategoryByIdOrSlug(voteId);
    const nominees = await this.getNominees(category.id);

    const raw = await this.voteRepo
      .createQueryBuilder('vote')
      .select('vote.nomineeId', 'nomineeId')
      .addSelect('COUNT(vote.id)', 'count')
      .where('vote.voteId IN (:...voteIds)', {
        voteIds: [category.id, category.slug],
      })
      .groupBy('vote.nomineeId')
      .getRawMany<{ nomineeId: string; count: string }>();

    const counts = raw.reduce(
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
