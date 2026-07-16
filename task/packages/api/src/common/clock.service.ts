import { Injectable } from '@nestjs/common';

// This is the edge: time enters the system here (ADR 0001). The engine
// never reads the wall clock itself.
@Injectable()
export class Clock {
  now(): string {
    return new Date().toISOString();
  }
}
