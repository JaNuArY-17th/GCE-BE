import {
  Body,
  Controller,
  Get,
  HttpCode,
  NotFoundException,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { SubmitVoteDto } from '@modules/votes/dto/submit-vote.dto';
import { VotesService } from '@modules/votes/votes.service';
import { JwtAuthGuard } from '@common/guards/jwt-auth.guard';
import {
  VoteDateRangeQuery,
  VoteStatsQuery,
  VoterListQuery,
} from '@modules/votes/dto/admin-query.dto';

@Controller()
export class VotesController {
  constructor(private readonly votesService: VotesService) {}

  @Get('categories')
  getCategories() {
    return this.votesService.getCategories();
  }

  @Get('categories/:voteId/nominees')
  getNominees(@Param('voteId') voteId: string) {
    return this.votesService.getNominees(voteId);
  }

  private normalizeMssv(mssv: string): string {
    return String(mssv || '').trim().toUpperCase();
  }

  @Post('votes')
  @HttpCode(201)
  async submitVote(@Body() body: SubmitVoteDto) {
    if (!body?.mssv || !body?.idToken) {
      throw new NotFoundException('Missing mssv or idToken');
    }

    const mssv = this.normalizeMssv(body.mssv);

    const choices = body.choices?.length
      ? body.choices
      : body.voteId && body.nomineeId
      ? [{ voteId: body.voteId, nomineeId: body.nomineeId }]
      : [];

    if (!choices.length) {
      throw new NotFoundException('Missing vote choices');
    }

    const result = await this.votesService.submitAllVotes(mssv, body.idToken, choices);

    const response: any = {
      success: true,
      message: 'Bình chọn thành công!',
    };

    if (result?.specialData) {
      response.data = result.specialData;
    }

    return response;
  }

  @Get('votes/:voteId/results')
  getResults(
    @Param('voteId') voteId: string,
    @Query() query: VoteDateRangeQuery,
  ) {
    return this.votesService.getResults(voteId, query);
  }

  @UseGuards(JwtAuthGuard)
  @Get('admin/votes/stats')
  getAdminStats(@Query() query: VoteStatsQuery) {
    return this.votesService.getVoteStats(query);
  }

  @UseGuards(JwtAuthGuard)
  @Get('admin/voters')
  getVoters(@Query() query: VoterListQuery) {
    const page = query.page ? Number(query.page) : 1;
    const pageSize = query.pageSize ? Number(query.pageSize) : 20;
    const hasVoted =
      query.hasVoted === 'true'
        ? true
        : query.hasVoted === 'false'
        ? false
        : undefined;

    return this.votesService.listVoters({
      search: query.search?.trim(),
      hasVoted,
      page,
      pageSize,
      startDate: query.startDate,
      endDate: query.endDate,
    });
  }

  @Get('votes/history/:mssv')
  getHistory(@Param('mssv') mssv: string) {
    return this.votesService.getVoteHistory(mssv);
  }
}
