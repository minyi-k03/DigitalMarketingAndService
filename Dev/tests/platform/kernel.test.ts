import { describe, expect, it } from 'vitest';
import { SystemClock } from '../../src/worker/platform/clock';
import { DomainError } from '../../src/worker/platform/errors';
import { newId } from '../../src/worker/platform/id';

describe('platform [T02]', () => {
  it('SystemClock은 현재 시각의 Date를 돌려준다', () => {
    const before = Date.now();
    const now = new SystemClock().now();

    expect(now).toBeInstanceOf(Date);
    expect(now.getTime()).toBeGreaterThanOrEqual(before);
  });

  it('DomainError는 code를 보존하고 message 기본값은 code다', () => {
    const e = new DomainError('INVALID_TRANSITION');

    expect(e).toBeInstanceOf(Error);
    expect(e.code).toBe('INVALID_TRANSITION');
    expect(e.message).toBe('INVALID_TRANSITION');
    expect(new DomainError('NOT_FOUND', '기록 없음').message).toBe('기록 없음');
  });

  it('newId는 매번 다른 UUID v4를 만든다', () => {
    const a = newId();
    const b = newId();

    expect(a).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    expect(a).not.toBe(b);
  });
});
