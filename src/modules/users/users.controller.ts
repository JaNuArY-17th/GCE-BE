import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common'
import { FileInterceptor } from '@nestjs/platform-express'
import { CreateVoterDto } from './dtos/create-voter.dto'
import { JwtAuthGuard } from '@common/guards/jwt-auth.guard'
import { UsersService } from './users.service'

@Controller('users')
@UseGuards(JwtAuthGuard)
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get(':mssv')
  getByMssv(@Param('mssv') mssv: string) {
    return this.usersService.findByMssv(mssv)
  }

  @Post()
  createVoter(@Body() dto: CreateVoterDto) {
    return this.usersService.createVoter(dto)
  }

  @Post('batch')
  @UseInterceptors(FileInterceptor('file'))
  async createBatch(@UploadedFile() file: Express.Multer.File) {
    if (!file) {
      throw new Error('No file uploaded')
    }

    const xlsx = await import('xlsx')
    const workbook = xlsx.read(file.buffer, { type: 'buffer' })
    const sheet = workbook.Sheets[workbook.SheetNames[0]]
    const rows = xlsx.utils.sheet_to_json<Record<string, unknown>>(sheet)

    const voters = rows
      .map((row) => ({
        fullname: String(row['fullname'] || row['name'] || row['FullName'] || row['Name'] || ''),
        mssv: String(row['mssv'] || row['MSSV'] || row['id'] || ''),
        email: String(row['email'] || row['Email'] || ''),
      }))
      .filter((v) => v.fullname && v.mssv && v.email)

    return this.usersService.createBatch(voters)
  }
}
