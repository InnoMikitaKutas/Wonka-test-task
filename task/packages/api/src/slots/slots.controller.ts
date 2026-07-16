import { Body, Controller, Get, HttpCode, HttpStatus, Param, Post } from '@nestjs/common';
import { SlotsService } from './slots.service';
import type { SlotView } from './slot.view';
import { OpenSlotDto, ScheduleInterviewDto } from './dto';

@Controller('slots')
export class SlotsController {
  constructor(private readonly slotsService: SlotsService) {}

  @Post()
  open(@Body() dto: OpenSlotDto): Promise<{ slotId: string }> {
    return this.slotsService.openSlot(dto);
  }

  @Post(':id/schedule')
  @HttpCode(HttpStatus.OK)
  schedule(
    @Param('id') id: string,
    @Body() dto: ScheduleInterviewDto,
  ): Promise<{ ok: true }> {
    return this.slotsService.scheduleInterview(id, dto);
  }

  @Get(':id')
  getOne(@Param('id') id: string): Promise<SlotView> {
    return this.slotsService.getSlot(id);
  }
}
