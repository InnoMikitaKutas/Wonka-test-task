import { randomUUID } from 'node:crypto';
import { Injectable } from '@nestjs/common';

// This is the edge: identifiers enter the system here (ADR 0001). The
// engine never generates ids itself, so replaying decisions stays
// deterministic.
@Injectable()
export class IdGenerator {
  next(): string {
    return randomUUID();
  }
}
