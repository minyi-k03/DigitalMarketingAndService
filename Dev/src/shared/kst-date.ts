// KST 달력 날짜와 UTC 시각 처리 (SPEC §4, architecture §4).
// 한국은 일광절약시간이 없으므로 고정 오프셋(+9h)과 Date.UTC 일 단위 연산만 쓴다.

/** KST 기준 달력 날짜 `YYYY-MM-DD` */
export type KstDate = string & { readonly __brand: 'KstDate' };

/** UTC ISO 8601 시각. 항상 `Date.prototype.toISOString()` 형식이라 문자열 비교가 시간순이다 */
export type UtcInstant = string & { readonly __brand: 'UtcInstant' };

export interface Clock {
  now(): Date;
}

const KST_OFFSET_HOURS = 9;
const KST_OFFSET_MS = KST_OFFSET_HOURS * 60 * 60 * 1000;
const DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;
const HHMM_PATTERN = /^([01]\d|2[0-3]):([0-5]\d)$/;

function formatDate(ms: number): KstDate {
  return new Date(ms).toISOString().slice(0, 10) as KstDate;
}

function splitDate(date: KstDate): [number, number, number] {
  const match = DATE_PATTERN.exec(date);
  return [Number(match?.[1]), Number(match?.[2]), Number(match?.[3])];
}

/** `YYYY-MM-DD` 형식이고 실제로 존재하는 날짜인지 검사해 KstDate로 돌려준다 */
export function parseKstDate(value: string): KstDate {
  const match = DATE_PATTERN.exec(value);
  if (match) {
    const [y, m, d] = [Number(match[1]), Number(match[2]), Number(match[3])];
    if (formatDate(Date.UTC(y, m - 1, d)) === value) return value as KstDate;
  }
  throw new RangeError(`잘못된 KST 날짜: ${value}`);
}

/** 오늘(KST): UTC 현재 시각 + 9시간의 날짜 */
export function todayKst(clock: Clock): KstDate {
  return formatDate(clock.now().getTime() + KST_OFFSET_MS);
}

export function addDays(date: KstDate, days: number): KstDate {
  const [y, m, d] = splitDate(date);
  return formatDate(Date.UTC(y, m - 1, d + days));
}

/** KST 날짜의 `HH:mm`에 해당하는 UTC 시각 */
export function kstAt(date: KstDate, hhmm: string): UtcInstant {
  const match = HHMM_PATTERN.exec(hhmm);
  if (!match) throw new RangeError(`잘못된 시각 형식(HH:mm): ${hhmm}`);
  const [y, m, d] = splitDate(date);
  const ms = Date.UTC(y, m - 1, d, Number(match[1]) - KST_OFFSET_HOURS, Number(match[2]));
  return new Date(ms).toISOString() as UtcInstant;
}

/** UTC 시각의 KST 날짜 */
export function kstDateOf(instant: UtcInstant): KstDate {
  const ms = Date.parse(instant);
  if (Number.isNaN(ms)) throw new RangeError(`잘못된 UTC 시각: ${instant}`);
  return formatDate(ms + KST_OFFSET_MS);
}

export function toUtcInstant(date: Date): UtcInstant {
  return date.toISOString() as UtcInstant;
}
