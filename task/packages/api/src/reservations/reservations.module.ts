import { Module } from '@nestjs/common';
import { Clock } from '../common/clock.service';
import { IdGenerator } from '../common/id.service';
import { ReservationsController } from './reservations.controller';
import { ReservationsService } from './reservations.service';

@Module({
  controllers: [ReservationsController],
  providers: [ReservationsService, Clock, IdGenerator],
})
export class ReservationsModule {}
