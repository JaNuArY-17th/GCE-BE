import { Injectable, NotFoundException, UnauthorizedException, ConflictException, OnModuleInit } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import { OAuth2Client, TokenPayload } from 'google-auth-library'
import { Voter } from '@modules/users/entities/user.entity'
import { Vote } from './entities/vote.entity'
import { Category } from '../categories/entities/category.entity'
import { Nominee } from '../nominees/entities/nominee.entity'

export type VoteCategoryType = 'person' | 'club' | 'event'

export interface VoteCategory {
  id: string
  slug: string
  title: string
  type: VoteCategoryType
  themeColor?: string
  description?: string
  date?: string
  location?: string
}

export interface Nominee {
  id: string
  name: string
  imageUrl?: string
  description?: string
  date?: string
  location?: string
}

export interface VoteSubmission {
  voteId: string
  nomineeId: string
  mssv: string
  idToken: string
}

@Injectable()
export class VotesService {
  private readonly oauthClient: OAuth2Client

  private readonly defaultCategories: VoteCategory[] = [
    {
      id: 'fanpage',
      slug: 'fanpage',
      title: 'Fanpage',
      type: 'club',
      themeColor: '#A77A57',
    },
    {
      id: 'club',
      slug: 'club',
      title: 'Câu lạc bộ',
      type: 'club',
      description:
        'Bình chọn Câu lạc bộ xuất sắc nhất – Đây là danh hiệu dành cho câu lạc bộ có nhiều hoạt động nổi bật, tinh thần sáng tạo và đóng góp tích cực cho cộng đồng. Chỉ được chọn một câu lạc bộ; phiếu bầu của bạn sẽ được tổng hợp để xác định người chiến thắng.',
    },
    {
      id: 'event',
      slug: 'event',
      title: 'Sự kiện',
      type: 'event',
      description:
        'Bình chọn Sự kiện xuất sắc nhất – Đây là danh hiệu dành cho sự kiện có nhiều hoạt động nổi bật, tinh thần sáng tạo và đóng góp tích cực cho cộng đồng. Chỉ được chọn một sự kiện; phiếu bầu của bạn sẽ được tổng hợp để xác định người chiến thắng.',
    },
    {
      id: 'personal',
      slug: 'personal',
      title: 'Cá nhân',
      type: 'person',
      description:
        'Bình chọn Cá nhân xuất sắc nhất – Đây là danh hiệu dành cho cá nhân có nhiều hoạt động nổi bật, tinh thần sáng tạo và đóng góp tích cực cho cộng đồng. Chỉ được chọn một cá nhân; phiếu bầu của bạn sẽ được tổng hợp để xác định người chiến thắng.',
    },
  ]

  private readonly defaultNominees: Record<string, Array<Omit<Nominee, 'date' | 'location'>>> = {
    fanpage: [
      { name: 'Fanpage One', description: 'Popular fanpage' },
      { name: 'Fanpage Two', description: 'Another fanpage' },
    ],
    club: [
      { name: 'Chess Club', description: 'Strategy and fun' },
      { name: 'Drama Club', description: 'Acting ensemble' },
    ],
    event: [
      { name: 'Spring Festival', description: 'Annual celebration' },
      { name: 'Hackathon', description: '24h coding' },
      { name: 'Music Concert', description: 'Live performances' },
      { name: 'Charity Run' },
    ],
    personal: [
      { name: 'Alice Nguyen', description: 'Top contributor' },
      { name: 'Bob Tran', description: 'Community leader' },
    ],
  }

  constructor(
    @InjectRepository(Voter)
    private readonly voterRepo: Repository<Voter>,
    @InjectRepository(Vote)
    private readonly voteRepo: Repository<Vote>,
    @InjectRepository(Category)
    private readonly categoryRepo: Repository<Category>,
    @InjectRepository(Nominee)
    private readonly nomineeRepo: Repository<Nominee>,
  ) {
    this.oauthClient = new OAuth2Client(process.env.GOOGLE_OAUTH_CLIENT_ID)
  }

  async onModuleInit() {
    await this.ensureSeedData()
  }

  private async ensureSeedData() {
    for (const category of this.defaultCategories) {
      let existingCategory = await this.categoryRepo.findOneBy({ slug: category.slug })
      if (!existingCategory) {
        existingCategory = await this.categoryRepo.save(
          this.categoryRepo.create({
            slug: category.slug,
            title: category.title,
            description: category.description,
            type: category.type,
          }),
        )
      }

      const nomineeCount = await this.nomineeRepo.count({ where: { categoryId: existingCategory.id } })
      if (nomineeCount === 0) {
        const nomineesToInsert: Partial<Nominee>[] = (this.defaultNominees[category.slug] ?? []).map(
          (nominee) => ({
            categoryId: existingCategory.id,
            name: nominee.name,
            description: nominee.description,
          }),
        )
        if (nomineesToInsert.length) {
          await this.nomineeRepo.save(nomineesToInsert)
        }
      }
    }
  }

  getCategories(): Promise<VoteCategory[]> {
    return this.categoryRepo
      .find({ order: { slug: 'ASC' } })
      .then((cats) =>
        cats.map((cat) => ({
          id: cat.slug,
          slug: cat.slug,
          title: cat.title,
          type: cat.type as VoteCategoryType,
          description: cat.description,
        })),
      )
  }

  async getNominees(voteId: string): Promise<Nominee[]> {
    const category = await this.categoryRepo.findOneBy({ slug: voteId })
    if (!category) {
      throw new NotFoundException(`Unknown vote category: ${voteId}`)
    }

    const nominees = await this.nomineeRepo.find({ where: { categoryId: category.id } })
    return nominees.map((n) => ({
      id: n.id,
      name: n.name,
      description: n.description,
      imageUrl: n.imageUrl,
      date: n.metadata?.date as string,
      location: n.metadata?.location as string,
    }))
  }

  async submitVote({ voteId, nomineeId, mssv, idToken }: VoteSubmission) {
    const voter = await this.voterRepo.findOneBy({ mssv })
    if (!voter) {
      throw new NotFoundException('Voter not found')
    }

    const payload = await this.verifyGoogleToken(idToken)
    if (!payload || payload.email !== voter.email || !payload.email_verified) {
      throw new UnauthorizedException('Invalid Google authentication')
    }

    const nominees = await this.getNominees(voteId)
    const nomineeExists = nominees.some((n) => n.id === nomineeId)
    if (!nomineeExists) {
      throw new NotFoundException(`Unknown nominee id: ${nomineeId}`)
    }

    // Restrict one vote per MSSV per vote category
    const existing = await this.voteRepo.findOneBy({ voteId, mssv })
    if (existing) {
      throw new ConflictException('This MSSV has already voted for this category')
    }

    await this.voteRepo.save({ voteId, nomineeId, mssv })
  }

  async getVoteHistory(mssv: string) {
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
        'nominee.imageUrl AS nominee_imageUrl',
      ])
      .addSelect([
        'category.id AS category_id',
        'category.slug AS category_slug',
        'category.title AS category_title',
      ])
      .leftJoin(Nominee, 'nominee', 'nominee.id = vote.nomineeId')
      .leftJoin(Category, 'category', 'category.id = nominee.categoryId')
      .where('vote.mssv = :mssv', { mssv })
      .orderBy('vote.createdAt', 'DESC')
      .getRawMany<any>()

    return history.map((row) => ({
      id: row.vote_id,
      voteId: row.vote_voteId,
      createdAt: row.vote_createdAt,
      nominee: {
        id: row.nominee_id,
        name: row.nominee_name,
        description: row.nominee_description,
        imageUrl: row.nominee_imageUrl,
      },
      category: {
        id: row.category_id,
        slug: row.category_slug,
        title: row.category_title,
      },
    }))
  }

  async getResults(voteId: string): Promise<Record<string, number>> {
    const nominees = await this.getNominees(voteId)

    const raw = await this.voteRepo
      .createQueryBuilder('vote')
      .select('vote.nomineeId', 'nomineeId')
      .addSelect('COUNT(vote.id)', 'count')
      .where('vote.voteId = :voteId', { voteId })
      .groupBy('vote.nomineeId')
      .getRawMany<{ nomineeId: string; count: string }>()

    const counts = raw.reduce((acc, row) => {
      acc[row.nomineeId] = Number(row.count)
      return acc
    }, {} as Record<string, number>)

    return nominees.reduce((acc, nominee) => {
      acc[nominee.id] = counts[nominee.id] ?? 0
      return acc
    }, {} as Record<string, number>)
  }

  private async verifyGoogleToken(idToken: string): Promise<TokenPayload | null> {
    if (process.env.NODE_ENV === 'test' || process.env.SKIP_GOOGLE_OAUTH === 'true') {
      return {
        email: 'student@example.com',
        email_verified: true,
      } as unknown as TokenPayload
    }

    const ticket = await this.oauthClient.verifyIdToken({
      idToken,
      audience: process.env.GOOGLE_OAUTH_CLIENT_ID,
    })
    return ticket.getPayload() ?? null
  }

  /**
   * Return true when current date is within the allowed voting window.
   * Not used by default, but can be hooked into controllers as needed.
   */
  isVotingOpen(): boolean {
    const start = process.env.VOTE_DATE_START ? new Date(process.env.VOTE_DATE_START) : null
    const end = process.env.VOTE_DATE_END ? new Date(process.env.VOTE_DATE_END) : null
    const now = new Date()

    if (!start && !end) return true
    if (start && now < start) return false
    if (end && now > end) return false
    return true
  }
}
