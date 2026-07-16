import { Inject, Injectable, Logger } from '@nestjs/common';
import type { CommandEnvelope, EventEnvelope, EventDraft } from '@ats/contracts';
import { decide, initialState, reduce, type State } from '@ats/engine';
import type { EventStoreRepository, NewEvent, StoredEvent } from '@ats/persistence';
import { Clock } from '../common/clock.service';
import { IdGenerator } from '../common/id.service';
import { EVENT_STORE_REPOSITORY } from '../persistence/persistence.tokens';

function envelope(event: StoredEvent): EventEnvelope {
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
    private readonly ids: IdGenerator,
  ) {}

  private async state(): Promise<State> {
    const events = await this.eventStore.loadAll();
    return events.reduce(
      (state, event) => reduce(state, envelope(event)),
      initialState(),
    );
  }

  private async appendDrafts(drafts: EventDraft[], occurredAt: string): Promise<void> {
    for (const draft of drafts) {
      const version = await this.eventStore.currentVersion(draft.stream);
      const event: NewEvent = {
        eventId: this.ids.next(),
        type: draft.type,
        payload: draft.payload,
        occurredAt,
      };
      await this.eventStore.append(draft.stream, [event], version);
    }
  }

  async reserve(
    candidateId: string,
    slotId: string,
  ): Promise<{ reservationId: string; status: 'pending'; expiresAt: string }> {
    const reservationId = this.ids.next();
    const occurredAt = this.clock.now();
    const command: CommandEnvelope = {
      commandId: this.ids.next(),
      type: 'ReserveSlot',
      occurredAt,
      payload: { reservationId, slotId, candidateId },
    };
    const drafts = decide(await this.state(), command);
    await this.appendDrafts(drafts, occurredAt);
    const placed = drafts[0].payload as { expiresAt: string };
    this.logger.log(`reservation ${reservationId} placed on slot ${slotId}`);
    return { reservationId, status: 'pending', expiresAt: placed.expiresAt };
  }

  async confirm(reservationId: string): Promise<{ status: 'confirmed' }> {
    const occurredAt = this.clock.now();
    const command: CommandEnvelope = {
      commandId: this.ids.next(),
      type: 'ConfirmReservation',
      occurredAt,
      payload: { reservationId },
    };
    const drafts = decide(await this.state(), command);
    await this.appendDrafts(drafts, occurredAt);
    this.logger.log(`reservation ${reservationId} confirmed`);
    return { status: 'confirmed' };
  }

  async sweep(): Promise<{ expired: number }> {
    const occurredAt = this.clock.now();
    const command: CommandEnvelope = {
      commandId: this.ids.next(),
      type: 'Sweep',
      occurredAt,
      payload: {},
    };
    const drafts = decide(await this.state(), command);
    await this.appendDrafts(drafts, occurredAt);
    return { expired: drafts.length };
  }
}
