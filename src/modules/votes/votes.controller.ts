import {
  Body,
  Controller,
  Get,
  HttpCode,
  NotFoundException,
  Param,
  Post,
} from '@nestjs/common';
import { SubmitVoteDto } from '@modules/votes/dto/submit-vote.dto';
import { VotesService } from '@modules/votes/votes.service';

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

    const results = await Promise.all(
      choices.map((choice) =>
        this.votesService.submitVote({
          voteId: choice.voteId,
          nomineeId: choice.nomineeId,
          mssv,
          idToken: body.idToken,
        }),
      ),
    );

    const specialData = results.find((r) => r?.specialData)?.specialData;

    const response: any = {
      success: true,
      message: 'Bình chọn thành công!',
    };

    if (specialData) {
      response.data = specialData;
    }

    return response;
  }

  @Get('votes/:voteId/results')
  getResults(@Param('voteId') voteId: string) {
    return this.votesService.getResults(voteId);
  }

  @Get('votes/history/:mssv')
  getHistory(@Param('mssv') mssv: string) {
    return this.votesService.getVoteHistory(mssv);
  }
}
