import { Global, Inject, Module, OnModuleDestroy } from '@nestjs/common';
import {
  CandidateReadModelEntity,
  CandidateReadModelRepository,
  EventEntity,
  EventStoreRepository,
  SlotReadModelEntity,
  SlotReadModelRepository,
  createDataSource,
} from '@ats/persistence';
import {
  CANDIDATE_READ_MODEL_REPOSITORY,
  DATA_SOURCE,
  EVENT_STORE_REPOSITORY,
  SLOT_READ_MODEL_REPOSITORY,
} from './persistence.tokens';

// The repository providers below call dataSource.getRepository(...), which
// needs entity metadata that only exists after the DataSource connects.
// Doing the connect here, inside the DATA_SOURCE factory, guarantees it
// finishes before any provider that depends on it is built.
async function connect() {
  const dataSource = createDataSource(process.env.DATABASE_URL);
  await dataSource.initialize();
  return dataSource;
}

// The connected DataSource type, inferred from connect() rather than
// imported from typeorm directly: persistence owns that dependency, the
// api only consumes what it exports.
type Connection = Awaited<ReturnType<typeof connect>>;

// Wires the shared DataSource and the persistence repositories as Nest
// providers. Global so every feature module can inject a repository
// without importing this module directly.
@Global()
@Module({
  providers: [
    { provide: DATA_SOURCE, useFactory: connect },
    {
      provide: EVENT_STORE_REPOSITORY,
      useFactory: (dataSource: Connection) =>
        new EventStoreRepository(dataSource.getRepository(EventEntity)),
      inject: [DATA_SOURCE],
    },
    {
      provide: CANDIDATE_READ_MODEL_REPOSITORY,
      useFactory: (dataSource: Connection) =>
        new CandidateReadModelRepository(
          dataSource.getRepository(CandidateReadModelEntity),
        ),
      inject: [DATA_SOURCE],
    },
    {
      provide: SLOT_READ_MODEL_REPOSITORY,
      useFactory: (dataSource: Connection) =>
        new SlotReadModelRepository(dataSource.getRepository(SlotReadModelEntity)),
      inject: [DATA_SOURCE],
    },
  ],
  exports: [
    DATA_SOURCE,
    EVENT_STORE_REPOSITORY,
    CANDIDATE_READ_MODEL_REPOSITORY,
    SLOT_READ_MODEL_REPOSITORY,
  ],
})
export class PersistenceModule implements OnModuleDestroy {
  constructor(@Inject(DATA_SOURCE) private readonly dataSource: Connection) {}

  async onModuleDestroy(): Promise<void> {
    await this.dataSource.destroy();
  }
}
