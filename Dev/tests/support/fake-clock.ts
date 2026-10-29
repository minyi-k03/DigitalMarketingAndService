import type { Clock } from '../../src/shared/kst-date';

export class FakeClock implements Clock {
  private ms: number;

  constructor(start: string) {
    this.ms = parseInstant(start);
  }

  now(): Date {
    return new Date(this.ms);
  }

  set(instant: string): void {
    this.ms = parseInstant(instant);
  }

  advanceBy(ms: number): void {
    this.ms += ms;
  }
}

function parseInstant(instant: string): number {
  const ms = Date.parse(instant);
  if (Number.isNaN(ms)) throw new Error(`잘못된 시각: ${instant}`);
  return ms;
}
