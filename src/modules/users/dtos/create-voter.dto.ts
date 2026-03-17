import { IsEmail, IsNotEmpty, IsString, Matches, MaxLength, MinLength } from 'class-validator'

export class CreateVoterDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  fullname!: string

  @IsString()
  @IsNotEmpty()
  @MinLength(6)
  @MaxLength(50)
  @Matches(/^\d+$/, { message: 'mssv must be numeric' })
  mssv!: string

  @IsEmail()
  email!: string
}
