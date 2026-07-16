import 'reflect-metadata';
import { DataSource } from 'typeorm';
import {
  CandidateReadModelEntity,
  EventEntity,
  ProjectorStateEntity,
  SlotReadModelEntity,
} from './entities';
import { InitSchema1710000000000 } from './migrations/1710000000000-InitSchema';
import { AddSlotReservations1720000000000 } from './migrations/1720000000000-AddSlotReservations';

const DEFAULT_DATABASE_URL = 'postgres://ats:ats@localhost:5432/ats';

// Single place that wires entities and migrations to a Postgres
// connection. synchronize stays false: schema changes only happen
// through migrations, never by TypeORM inferring DDL from entities.
export function createDataSource(url?: string): DataSource {
  return new DataSource({
    type: 'postgres',
    url: url ?? process.env.DATABASE_URL ?? DEFAULT_DATABASE_URL,
    entities: [
      EventEntity,
      CandidateReadModelEntity,
      SlotReadModelEntity,
      ProjectorStateEntity,
    ],
    migrations: [InitSchema1710000000000, AddSlotReservations1720000000000],
    synchronize: false,
    logging: false,
  });
}
