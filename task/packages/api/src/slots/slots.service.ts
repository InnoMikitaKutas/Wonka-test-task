import { Inject, Injectable, Logger } from '@nestjs/common';
import type { CommandEnvelope } from '@ats/contracts';
import { DomainError } from '@ats/engine';
import type { EventStoreRepository, SlotReadModelRepository } from '@ats/persistence';
import { Clock } from '../common/clock.service';
import { runCommand } from '../common/command-runner';
import { IdGenerator } from '../common/id.service';
import { candidateStream, slotStream } from '../common/streams';
import {
  EVENT_STORE_REPOSITORY,
  SLOT_READ_MODEL_REPOSITORY,
} from '../persistence/persistence.tokens';
import type { OpenSlotDto, ScheduleInterviewDto } from './dto';
import { SlotView, toSlotView } from './slot.view';

@Injectable()
export class SlotsService {
  private readonly logger = new Logger(SlotsService.name);

  constructor(
    @Inject(EVENT_STORE_REPOSITORY) private readonly eventStore: EventStoreRepository,
    @Inject(SLOT_READ_MODEL_REPOSITORY)
    private readonly slotReadModel: SlotReadModelRepository,
    private readonly clock: Clock,
    private readonly idGenerator: IdGenerator,
  ) {}

  async openSlot(dto: OpenSlotDto): Promise<{ slotId: string }> {
    const slotId = this.idGenerator.next();
    const stream = slotStream(slotId);
    const command: CommandEnvelope = {
      commandId: this.idGenerator.next(),
      type: 'OpenSlot',
      occurredAt: this.clock.now(),
      payload: { slotId, interviewer: dto.interviewer, startsAt: dto.startsAt },
    };
    await runCommand(this.eventStore, this.idGenerator, command, [stream], stream);
    this.logger.log(`slot ${slotId} opened`);
    return { slotId };
  }

  // Reads two streams (the slot and the candidate) but writes only to
  // the slot stream. Two concurrent schedule requests for the same slot
  // both compute expectedVersion from the same read, so only one append
  // can win; the other surfaces as an OptimisticConcurrencyError.
  async scheduleInterview(
    slotId: string,
    dto: ScheduleInterviewDto,
  ): Promise<{ ok: true }> {
    const targetStream = slotStream(slotId);
    const readStreams = [targetStream, candidateStream(dto.candidateId)];
    const command: CommandEnvelope = {
      commandId: this.idGenerator.next(),
      type: 'ScheduleInterview',
      occurredAt: this.clock.now(),
      payload: { slotId, candidateId: dto.candidateId },
    };
    await runCommand(
      this.eventStore,
      this.idGenerator,
      command,
      readStreams,
      targetStream,
    );
    this.logger.log(`slot ${slotId} scheduled for candidate ${dto.candidateId}`);
    return { ok: true };
  }

  async getSlot(id: string): Promise<SlotView> {
    const slot = await this.slotReadModel.findById(id);
    if (!slot) {
      throw new DomainError('NOT_FOUND', `slot ${id} not found`);
    }
    return toSlotView(slot);
  }
}
