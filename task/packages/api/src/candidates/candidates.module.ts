import { Module } from '@nestjs/common';
import { Clock } from '../common/clock.service';
import { IdGenerator } from '../common/id.service';
import { CandidatesController } from './candidates.controller';
import { CandidatesService } from './candidates.service';

@Module({
  controllers: [CandidatesController],
  providers: [CandidatesService, Clock, IdGenerator],
})
export class CandidatesModule {}
