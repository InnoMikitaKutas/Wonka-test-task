import {
  CandidateReadModelEntity,
  CandidateReadModelRepository,
  EventEntity,
  EventStoreRepository,
  ProjectorStateEntity,
  ProjectorStateRepository,
  SlotReadModelEntity,
  SlotReadModelRepository,
  ReservationReadModelEntity,
  ReservationReadModelRepository,
  createDataSource,
} from '@ats/persistence';
import type { ProjectorDeps } from './projector';

// Connecting here, before any repository is built, guarantees the entity
// metadata TypeORM needs already exists once getRepository is called.
async function connect(url?: string) {
  const dataSource = createDataSource(url);
  await dataSource.initialize();
  return dataSource;
}

// The connected DataSource type, inferred from connect() rather than
// imported from typeorm directly: persistence owns that dependency, the
// projector only consumes what it exports.
type Connection = Awaited<ReturnType<typeof connect>>;

export interface Bootstrapped extends ProjectorDeps {
  dataSource: Connection;
}

// Connects one DataSource and builds every repository the projector
// needs from it. The caller owns the DataSource and must close it with
// dataSource.destroy() once done.
export async function bootstrap(url?: string): Promise<Bootstrapped> {
  const dataSource = await connect(url);
  return {
    dataSource,
    eventStore: new EventStoreRepository(dataSource.getRepository(EventEntity)),
    candidateReadModel: new CandidateReadModelRepository(
      dataSource.getRepository(CandidateReadModelEntity),
    ),
    slotReadModel: new SlotReadModelRepository(
      dataSource.getRepository(SlotReadModelEntity),
    ),
    reservationReadModel: new ReservationReadModelRepository(
      dataSource.getRepository(ReservationReadModelEntity),
    ),
    projectorState: new ProjectorStateRepository(
      dataSource.getRepository(ProjectorStateEntity),
    ),
  };
}
