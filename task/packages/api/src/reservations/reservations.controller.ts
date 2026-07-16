import { Body, Controller, HttpCode, HttpStatus, Param, Post } from '@nestjs/common';
import { ReserveSlotDto } from './dto/reserve-slot.dto';
import { ReservationsService } from './reservations.service';

@Controller()
export class ReservationsController {
  constructor(private readonly reservations: ReservationsService) {}

  @Post('candidates/:candidateId/reservations')
  reserve(
    @Param('candidateId') candidateId: string,
    @Body() dto: ReserveSlotDto,
  ): Promise<{ reservationId: string; status: 'pending'; expiresAt: string }> {
    return this.reservations.reserve(candidateId, dto.slotId);
  }

  @Post('reservations/:reservationId/confirm')
  @HttpCode(HttpStatus.OK)
  confirm(
    @Param('reservationId') reservationId: string,
  ): Promise<{ status: 'confirmed' }> {
    return this.reservations.confirm(reservationId);
  }

  @Post('admin/sweep')
  @HttpCode(HttpStatus.OK)
  sweep(): Promise<{ expired: number }> {
    return this.reservations.sweep();
  }
}
