import type { Clock } from '../../shared/kst-date';

export type { Clock };

export class SystemClock implements Clock {
  now(): Date {
    return new Date();
  }
}
