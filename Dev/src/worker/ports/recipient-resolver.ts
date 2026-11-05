/**
 * 알림을 받을 곳. 채널은 `NOTIFICATION_MODE`의 어댑터와 짝을 이룬다 (SPEC FN §4, D-16).
 * 토큰·전화번호는 발송 어댑터만 쓰고 로그에 남기지 않는다 (AGENTS §6).
 */
export type Recipient =
  { channel: 'KAKAO_MEMO'; accessToken: string } | { channel: 'ALIMTALK'; phoneNumber: string };

export interface RecipientResolver {
  /** 발송 시점에 수신처를 확정한다. 확보하지 못했으면 `null`이고 그 슬롯은 `SKIPPED`다 */
  resolve(userId: string): Promise<Recipient | null>;
}
