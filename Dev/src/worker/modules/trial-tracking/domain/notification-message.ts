import type { OutgoingNotification } from '../../../ports/notification-sender';
import {
  templateKeyFor,
  type AccessRetentionPolicy,
  type ConfirmCheckVariant,
  type EscapeAlertVariant,
  type NotificationKind,
  type NotificationTemplate,
} from './notification-planner';

/** 저장된 알림 한 행 중 문구·링크를 정하는 데 쓰는 값 */
export interface DueNotification {
  trialRecordId: string;
  kind: NotificationKind;
  slot: string;
  variant: string;
}

const ESCAPE_ALERT_VARIANTS: readonly string[] = [
  'REGULAR',
  'LATE_BILLING_DAY',
  'LATE_SAFE_END_DAY',
] satisfies EscapeAlertVariant[];
const CONFIRM_CHECK_VARIANTS: readonly string[] = [
  'REGULAR',
  'SAME_DAY_DOMESTIC',
] satisfies ConfirmCheckVariant[];

/** DB의 `variant`는 문자열이다. 계획기가 쓰지 않는 값이면 문구를 고를 수 없으므로 던진다 */
function toTemplate(kind: NotificationKind, variant: string): NotificationTemplate {
  const known =
    kind === 'ESCAPE_ALERT'
      ? ESCAPE_ALERT_VARIANTS.includes(variant)
      : kind === 'CANCEL_CONFIRM_CHECK'
        ? CONFIRM_CHECK_VARIANTS.includes(variant)
        : variant === 'REGULAR';
  if (!known) throw new Error(`알 수 없는 알림 변형: ${kind}.${variant}`);
  return { kind, variant } as NotificationTemplate;
}

/**
 * 알림 링크는 기록 ID만 담은 구독컷 내부 경로다 (SPEC §6, ADR-0001). 로그인 토큰은 넣지 않는다.
 * 탈출 알림과 해지 확인 알림은 해지 브릿지로, 결제 확인 알림은 정정 선택지가 있는 내 체험 상세로 연결한다.
 */
export function notificationLink(kind: NotificationKind, trialRecordId: string): string {
  return kind === 'BILLING_CHECK' ? `/trials/${trialRecordId}` : `/bridge/${trialRecordId}`;
}

export function buildOutgoingNotification(
  due: DueNotification,
  terms: { catalogItemName: string; retentionPolicy: AccessRetentionPolicy },
): OutgoingNotification {
  const template = toTemplate(due.kind, due.variant);
  return {
    kind: due.kind,
    slot: due.slot,
    variant: due.variant,
    templateKey: templateKeyFor(template, terms.retentionPolicy),
    catalogItemName: terms.catalogItemName,
    link: notificationLink(due.kind, due.trialRecordId),
  };
}
