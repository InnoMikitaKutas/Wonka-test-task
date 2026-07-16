import { Inject, Injectable, Logger } from '@nestjs/common';
import {
  ReservationPlacedPayload,
  type CommandEnvelope,
  type EventEnvelope,
} from '@ats/contracts';
import { decide, DomainError, initialState, reduce } from '@ats/engine';
import type { EventStoreRepository, NewEvent, StoredEvent } from '@ats/persistence';
import { Clock } from '../common/clock.service';
import { runCommand } from '../common/command-runner';
import { IdGenerator } from '../common/id.service';
import { candidateStream, slotStream } from '../common/streams';
import { EVENT_STORE_REPOSITORY } from '../persistence/persistence.tokens';
import type { ReserveSlotDto } from './dto/reserve-slot.dto';

const RESERVATION_EVENT_TYPES = [
  'ReservationPlaced',
  'ReservationConfirmed',
  'ReservationExpired',
];

function toEventEnvelope(event: StoredEvent): EventEnvelope {
  return {
    eventId: event.eventId,
    type: event.type,
    stream: event.stream,
    streamVersion: event.streamVersion,
    schemaVersion: event.schemaVersion as 1,
    occurredAt: event.occurredAt,
    payload: event.payload,
  };
}

@Injectable()
export class ReservationsService {
  private readonly logger = new Logger(ReservationsService.name);

  constructor(
    @Inject(EVENT_STORE_REPOSITORY) private readonly eventStore: EventStoreRepository,
    private readonly clock: Clock,
    private readonly idGenerator: IdGenerator,
  ) {}

  async reserve(
    candidateId: string,
    dto: ReserveSlotDto,
  ): Promise<{ reservationId: string; status: 'pending'; expiresAt: string }> {
    const reservationId = this.idGenerator.next();
    const targetStream = slotStream(dto.slotId);
    const command: CommandEnvelope = {
      commandId: this.idGenerator.next(),
      type: 'ReserveSlot',
      occurredAt: this.clock.now(),
      payload: { reservationId, slotId: dto.slotId, candidateId },
    };
    const drafts = await runCommand(
      this.eventStore,
      this.idGenerator,
      command,
      [targetStream, candidateStream(candidateId)],
      targetStream,
    );
    const placed = ReservationPlacedPayload.parse(drafts[0]?.payload);
    this.logger.log(`reservation ${reservationId} placed on slot ${dto.slotId}`);
    return { reservationId, status: 'pending', expiresAt: placed.expiresAt };
  }

  async confirm(reservationId: string): Promise<{ status: 'confirmed' }> {
    const targetStream = await this.eventStore.findReservationStream(reservationId);
    if (!targetStream) {
      throw new DomainError('NOT_FOUND', `reservation ${reservationId} not found`);
    }
    const command: CommandEnvelope = {
      commandId: this.idGenerator.next(),
      type: 'ConfirmReservation',
      occurredAt: this.clock.now(),
      payload: { reservationId },
    };
    await runCommand(
      this.eventStore,
      this.idGenerator,
      command,
      [targetStream],
      targetStream,
    );
    this.logger.log(`reservation ${reservationId} confirmed`);
    return { status: 'confirmed' };
  }

  async sweep(): Promise<{ expired: number }> {
    const reservationEvents = await this.eventStore.loadByTypes(RESERVATION_EVENT_TYPES);
    const streams = [...new Set(reservationEvents.map((event) => event.stream))];
    const stored = await this.eventStore.loadStreams(streams);
    const state = stored.reduce(
      (current, event) => reduce(current, toEventEnvelope(event)),
      initialState(),
    );
    const occurredAt = this.clock.now();
    const command: CommandEnvelope = {
      commandId: this.idGenerator.next(),
      type: 'Sweep',
      occurredAt,
      payload: {},
    };
    const drafts = decide(state, command);

    for (const stream of streams) {
      const streamDrafts = drafts.filter((draft) => draft.stream === stream);
      if (streamDrafts.length === 0) {
        continue;
      }
      const expectedVersion = stored
        .filter((event) => event.stream === stream)
        .reduce((max, event) => Math.max(max, event.streamVersion), 0);
      const events: NewEvent[] = streamDrafts.map((draft) => ({
        eventId: this.idGenerator.next(),
        type: draft.type,
        payload: draft.payload,
        occurredAt,
      }));
      await this.eventStore.append(stream, events, expectedVersion);
    }

    this.logger.log(`reservation sweep expired ${drafts.length}`);
    return { expired: drafts.length };
  }
}
