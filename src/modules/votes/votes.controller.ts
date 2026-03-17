import { Body, Controller, Get, HttpCode, NotFoundException, Param, Post } from '@nestjs/common'
import { SubmitVoteDto } from '@modules/votes/dto/submit-vote.dto'
import { VotesService } from '@modules/votes/votes.service'

@Controller('api')
export class VotesController {
  constructor(private readonly votesService: VotesService) {}

  @Get('categories')
  getCategories() {
    return this.votesService.getCategories()
  }

  @Get('categories/:voteId/nominees')
  getNominees(@Param('voteId') voteId: string) {
    return this.votesService.getNominees(voteId)
  }

  @Post('votes')
  @HttpCode(201)
  async submitVote(@Body() body: SubmitVoteDto) {
    if (!body?.voteId || !body?.nomineeId) {
      throw new NotFoundException('Missing voteId or nomineeId')
    }
    if (!body?.mssv || !body?.idToken) {
      throw new NotFoundException('Missing mssv or idToken')
    }

    await this.votesService.submitVote(body)
    return { success: true }
  }

  @Get('votes/:voteId/results')
  getResults(@Param('voteId') voteId: string) {
    return this.votesService.getResults(voteId)
  }

  @Get('votes/history/:mssv')
  getHistory(@Param('mssv') mssv: string) {
    return this.votesService.getVoteHistory(mssv)
  }
}
