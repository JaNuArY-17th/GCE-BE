import { Body, Controller, Delete, Get, Param, Post, Put, Query, UseGuards } from '@nestjs/common'
import { JwtAuthGuard } from '@common/guards/jwt-auth.guard'
import { NomineesService } from './nominees.service'
import { Nominee } from './entities/nominee.entity'

@Controller('api/nominees')
export class NomineesController {
  constructor(private readonly nomineesService: NomineesService) {}

  @Get()
  findAll(@Query('category') categoryId?: string) {
    return this.nomineesService.findAll(categoryId)
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.nomineesService.findOne(id)
  }

  @UseGuards(JwtAuthGuard)
  @Post()
  create(@Body() dto: Partial<Nominee>) {
    return this.nomineesService.create(dto)
  }

  @UseGuards(JwtAuthGuard)
  @Put(':id')
  update(@Param('id') id: string, @Body() dto: Partial<Nominee>) {
    return this.nomineesService.update(id, dto)
  }

  @UseGuards(JwtAuthGuard)
  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.nomineesService.delete(id)
  }
}
