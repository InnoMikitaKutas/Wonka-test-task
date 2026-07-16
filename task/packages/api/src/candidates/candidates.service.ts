import { Inject, Injectable, Logger } from '@nestjs/common';
import type { CommandEnvelope } from '@ats/contracts';
import { DomainError } from '@ats/engine';
import type {
  CandidateReadModelRepository,
  EventStoreRepository,
} from '@ats/persistence';
import { Clock } from '../common/clock.service';
import { runCommand } from '../common/command-runner';
import { IdGenerator } from '../common/id.service';
import { candidateStream } from '../common/streams';
import {
  CANDIDATE_READ_MODEL_REPOSITORY,
  EVENT_STORE_REPOSITORY,
} from '../persistence/persistence.tokens';
import { CandidateView, toCandidateView } from './candidate.view';
import type {
  AssignScoreDto,
  ChangeStageDto,
  CreateCandidateDto,
  ExtendOfferDto,
} from './dto';

@Injectable()
export class CandidatesService {
  private readonly logger = new Logger(CandidatesService.name);

  constructor(
    @Inject(EVENT_STORE_REPOSITORY) private readonly eventStore: EventStoreRepository,
    @Inject(CANDIDATE_READ_MODEL_REPOSITORY)
    private readonly candidateReadModel: CandidateReadModelRepository,
    private readonly clock: Clock,
    private readonly idGenerator: IdGenerator,
  ) {}

  async submitApplication(dto: CreateCandidateDto): Promise<{ candidateId: string }> {
    const candidateId = this.idGenerator.next();
    const stream = candidateStream(candidateId);
    const command: CommandEnvelope = {
      commandId: this.idGenerator.next(),
      type: 'SubmitApplication',
      occurredAt: this.clock.now(),
      payload: {
        candidateId,
        name: dto.name,
        position: dto.position,
        source: dto.source,
      },
    };
    await runCommand(this.eventStore, this.idGenerator, command, [stream], stream);
    this.logger.log(`application received for candidate ${candidateId}`);
    return { candidateId };
  }

  async changeStage(candidateId: string, dto: ChangeStageDto): Promise<{ ok: true }> {
    const stream = candidateStream(candidateId);
    const command: CommandEnvelope = {
      commandId: this.idGenerator.next(),
      type: 'ChangeStage',
      occurredAt: this.clock.now(),
      payload: { candidateId, toStage: dto.toStage },
    };
    await runCommand(this.eventStore, this.idGenerator, command, [stream], stream);
    this.logger.log(`candidate ${candidateId} moved to stage ${dto.toStage}`);
    return { ok: true };
  }

  async assignScore(candidateId: string, dto: AssignScoreDto): Promise<{ ok: true }> {
    const stream = candidateStream(candidateId);
    const command: CommandEnvelope = {
      commandId: this.idGenerator.next(),
      type: 'AssignScore',
      occurredAt: this.clock.now(),
      payload: { candidateId, score: dto.score, assessor: dto.assessor },
    };
    await runCommand(this.eventStore, this.idGenerator, command, [stream], stream);
    this.logger.log(`score assigned for candidate ${candidateId}`);
    return { ok: true };
  }

  async extendOffer(candidateId: string, dto: ExtendOfferDto): Promise<{ ok: true }> {
    const stream = candidateStream(candidateId);
    const command: CommandEnvelope = {
      commandId: this.idGenerator.next(),
      type: 'ExtendOffer',
      occurredAt: this.clock.now(),
      payload: { candidateId, note: dto.note },
    };
    await runCommand(this.eventStore, this.idGenerator, command, [stream], stream);
    this.logger.log(`offer extended for candidate ${candidateId}`);
    return { ok: true };
  }

  async getCandidate(id: string): Promise<CandidateView> {
    const candidate = await this.candidateReadModel.findById(id);
    if (!candidate) {
      throw new DomainError('NOT_FOUND', `candidate ${id} not found`);
    }
    return toCandidateView(candidate);
  }
}
