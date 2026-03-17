import { IsNotEmpty, IsString, Matches } from 'class-validator'

export class GetPresignedUrlDto {
  @IsString()
  @IsNotEmpty()
  filename!: string

  @IsString()
  @IsNotEmpty()
  @Matches(/^[-\w.+]+\/[\w.+-]+$/, { message: 'Invalid contentType' })
  contentType!: string
}
