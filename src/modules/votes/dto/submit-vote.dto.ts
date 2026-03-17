import { IsArray, IsNotEmpty, IsString, ValidateNested } from 'class-validator'
import { Type } from 'class-transformer'

export class VoteChoiceDto {
  @IsString()
  @IsNotEmpty()
  voteId!: string

  @IsString()
  @IsNotEmpty()
  nomineeId!: string
}

export class SubmitVoteDto {
  @IsString()
  @IsNotEmpty()
  mssv!: string

  @IsString()
  @IsNotEmpty()
  idToken!: string

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => VoteChoiceDto)
  choices!: VoteChoiceDto[]
}
