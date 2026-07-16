import { Module } from '@nestjs/common';
import { Clock } from '../common/clock.service';
import { IdGenerator } from '../common/id.service';
import { SlotsController } from './slots.controller';
import { SlotsService } from './slots.service';

@Module({
  controllers: [SlotsController],
  providers: [SlotsService, Clock, IdGenerator],
})
export class SlotsModule {}
