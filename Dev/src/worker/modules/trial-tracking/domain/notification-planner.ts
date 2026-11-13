import type { components } from '../../../../shared/api-types';
import {
  addDays,
  kstAt,
  kstDateOf,
  toUtcInstant,
  type KstDate,
  type UtcInstant,
} from '../../../../shared/kst-date';

// 알림 계획기: 어떤 슬롯을 언제 보낼지 정하는 순수 함수 (SPEC §6, architecture §5.4).
// 저장·취소·발송은 하지 않는다. 호출하는 쪽(T16)이 기존 PENDING 슬롯을 먼저 취소한 뒤 결과를 저장한다.

export type NotificationKind = 'ESCAPE_ALERT' | 'CANCEL_CONFIRM_CHECK' | 'BILLING_CHECK';

export type EscapeAlertVariant = 'REGULAR' | 'LATE_BILLING_DAY' | 'LATE_SAFE_END_DAY';
export type ConfirmCheckVariant = 'REGULAR' | 'SAME_DAY_DOMESTIC';

export type PlannedSlot =
  | {
      kind: 'ESCAPE_ALERT';
      slot: 'D3' | 'D1' | 'LATE_REGISTRATION';
      variant: EscapeAlertVariant;
      safeEndDate: KstDate;
      sendAt: UtcInstant;
    }
  | {
      kind: 'CANCEL_CONFIRM_CHECK';
      slot: 'D1_CONFIRM' | 'SAME_DAY_CONFIRM';
      variant: ConfirmCheckVariant;
      safeEndDate: KstDate;
      sendAt: UtcInstant;
    };

/** 계획에 필요한 기록의 날짜·버퍼 정보 */
export interface PlannerRecord {
  billingDate: KstDate;
  safeEndDate: KstDate;
  bufferApplied: boolean;
}

export interface PlannerSettings {
  /** 기본 발송 시각 `HH:mm` (KST) */
  sendTime: string;
}

/** `TRACKING` 생성·재예약 때의 슬롯: D3, D1, 늦은 등록 */
export function planInitialSlots(
  record: PlannerRecord,
  now: UtcInstant,
  settings: PlannerSettings,
): PlannedSlot[] {
  const { safeEndDate } = record;
  const slots: PlannedSlot[] = [];

  const d3At = kstAt(addDays(safeEndDate, -3), settings.sendTime);
  if (d3At > now) {
    slots.push({ kind: 'ESCAPE_ALERT', slot: 'D3', variant: 'REGULAR', safeEndDate, sendAt: d3At });
  }
  const d1At = kstAt(addDays(safeEndDate, -1), settings.sendTime);
  if (d1At > now) {
    slots.push({ kind: 'ESCAPE_ALERT', slot: 'D1', variant: 'REGULAR', safeEndDate, sendAt: d1At });
  }

  // 정규 슬롯이 모두 지났어도 오늘이 결제 예정일 이하이면 즉시 1회 보낸다 (늦은 등록)
  const today = kstDateOf(now);
  if (slots.length === 0 && today <= record.billingDate) {
    slots.push({
      kind: 'ESCAPE_ALERT',
      slot: 'LATE_REGISTRATION',
      variant: lateRegistrationVariant(record, today),
      safeEndDate,
      sendAt: now,
    });
  }
  return slots;
}

/**
 * `CANCEL_ATTEMPTED` 확인 알림: 사유 선택(`TRACKING → CANCEL_ATTEMPTED`)과 `CANCEL_ATTEMPTED` 재예약(G3) 때의 슬롯.
 * 기존 D3·D1(또는 PENDING 전부)의 취소는 호출하는 쪽이 먼저 한다.
 * `now`는 사유를 고른 시각 또는 기록을 고친 시각이다. 슬롯이 없으면 결제 확인 흐름(`BILLING_CHECK`)으로 이어진다.
 */
export function planCancelConfirmSlots(
  record: PlannerRecord,
  now: UtcInstant,
  settings: PlannerSettings,
): PlannedSlot[] {
  const { safeEndDate } = record;
  const confirm = (
    slot: 'D1_CONFIRM' | 'SAME_DAY_CONFIRM',
    variant: ConfirmCheckVariant,
    sendAt: UtcInstant,
  ): PlannedSlot[] => [{ kind: 'CANCEL_CONFIRM_CHECK', slot, variant, safeEndDate, sendAt }];

  const d1At = kstAt(addDays(safeEndDate, -1), settings.sendTime);
  if (d1At > now) return confirm('D1_CONFIRM', 'REGULAR', d1At);

  // D1 발송 시각이 지난 뒤: 당일 해지 확인 알림 (글로벌은 20:00, 국내는 시도 시점에 따라)
  if (record.bufferApplied) {
    const deadline = kstAt(safeEndDate, '20:00');
    return now < deadline ? confirm('SAME_DAY_CONFIRM', 'REGULAR', deadline) : [];
  }
  const today = kstDateOf(now);
  if (today < safeEndDate) {
    return confirm('SAME_DAY_CONFIRM', 'SAME_DAY_DOMESTIC', kstAt(safeEndDate, settings.sendTime));
  }
  if (today === safeEndDate && now < kstAt(safeEndDate, '21:00')) {
    const oneHourLater = toUtcInstant(new Date(Date.parse(now) + HOUR_MS));
    return confirm('SAME_DAY_CONFIRM', 'SAME_DAY_DOMESTIC', oneHourLater);
  }
  return [];
}

const HOUR_MS = 60 * 60 * 1000;

/** 알림 문구를 고르는 단위: 종류와 그 종류에서 가능한 변형 (architecture §5.5) */
export type NotificationTemplate =
  | { kind: 'ESCAPE_ALERT'; variant: EscapeAlertVariant }
  | { kind: 'CANCEL_CONFIRM_CHECK'; variant: ConfirmCheckVariant }
  | { kind: 'BILLING_CHECK'; variant: 'REGULAR' };

export type AccessRetentionPolicy = components['schemas']['AccessRetentionPolicy'];

/**
 * 템플릿 키 `kind.variant[.retentionPolicy]`. 접근 정책에 따라 문구가 갈리는 것은 탈출 알림뿐이고,
 * 해지 확인·결제 확인 알림은 두 정책의 문구가 같으므로 정책을 키에 넣지 않는다 (architecture §5.5 표의 "(같음)").
 */
export function templateKeyFor(
  template: NotificationTemplate,
  retentionPolicy: AccessRetentionPolicy,
): string {
  const base = `${template.kind}.${template.variant}`;
  return template.kind === 'ESCAPE_ALERT' ? `${base}.${retentionPolicy}` : base;
}

/** 위에서부터 먼저 해당하는 문구: 결제 예정일 당일 → 안전 만료일 당일 → 일반 (SPEC §6) */
function lateRegistrationVariant(record: PlannerRecord, today: KstDate): EscapeAlertVariant {
  if (today === record.billingDate) return 'LATE_BILLING_DAY';
  if (today === record.safeEndDate) return 'LATE_SAFE_END_DAY';
  return 'REGULAR';
}
