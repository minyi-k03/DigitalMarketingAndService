import type { Recipient } from './recipient-resolver';

/**
 * 발송할 알림 한 건. 문구는 어댑터가 `templateKey`로 골라 만든다 (architecture §5.5).
 * `link`는 기록 ID만 담은 구독컷 내부 경로이며 로그인 토큰은 넣지 않는다 (ADR-0001).
 */
export interface OutgoingNotification {
  kind: string;
  slot: string;
  variant: string;
  /** `kind.variant[.retentionPolicy]` (architecture §5.5) */
  templateKey: string;
  /** 카탈로그 항목 이름 (`CatalogItem.name`) */
  catalogItemName: string;
  /** `/bridge/{id}` 또는 `/trials/{id}`. 도메인 접두는 어댑터가 붙인다 */
  link: string;
}

/**
 * 알림 발송 포트. 어댑터는 `NOTIFICATION_MODE`로 고른다(`log`, `kakao_memo`, `dealer`).
 * 발송에 실패하면 던진다. 호출한 쪽이 재시도 횟수를 올린다 (SPEC §17). 수신처를 쓸 수 없다고 확인된 경우
 * (예: 발송 시점에 확인된 동의 철회)만 `RecipientUnavailableError`로 던지고, 호출한 쪽은 재시도 없이 슬롯을
 * `SKIPPED`로 닫는다 (SPEC §17, V-10).
 * 수신처(토큰·전화번호)는 로그에 남기지 않는다 (AGENTS §6).
 */
export interface NotificationSender {
  send(input: { recipient: Recipient; notification: OutgoingNotification }): Promise<void>;
}

/** 재시도해도 회복되지 않는 수신처 문제. 메시지에는 수신처 정보를 담지 않는다 (AGENTS §6) */
export class RecipientUnavailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'RecipientUnavailableError';
  }
}
