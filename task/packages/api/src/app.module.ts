import { Module } from '@nestjs/common';
import { PersistenceModule } from './persistence/persistence.module';
import { CandidatesModule } from './candidates/candidates.module';
import { SlotsModule } from './slots/slots.module';
import { ReservationsModule } from './reservations/reservations.module';

@Module({
  imports: [PersistenceModule, CandidatesModule, SlotsModule, ReservationsModule],
})
export class AppModule {}
