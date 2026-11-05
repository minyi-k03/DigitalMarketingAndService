import type { Recipient } from '../../../ports/recipient-resolver';
import type { IdentityDeps } from '../deps';
import { findUserById, updateNotificationEnabled } from '../infra/user-repo';
import { getMe, type Me } from './me';

/**
 * 알림 수신 여부를 바꾸고 갱신된 계정 정보를 돌려준다 (SPEC §6, §15, S44).
 * 끄는 요청의 확인 창은 클라이언트가 맡는다(V-07). 사용자가 없으면 `null`.
 * 운영 설정(발송 시각·문구)을 바꾸는 Trial Tracking의 `updateNotificationSettings`와는 다른 명령이다.
 */
export async function setNotificationEnabled(
  deps: IdentityDeps,
  userId: string,
  enabled: boolean,
): Promise<Me | null> {
  const updated = await updateNotificationEnabled(deps.db, userId, enabled);
  if (!updated) return null;
  return getMe(deps, userId);
}

export interface NotificationRecipient {
  enabled: boolean;
  /** 수신을 켰고 수신처를 확보했을 때만 있다. 없으면 호출한 쪽이 슬롯을 `SKIPPED`로 처리한다 */
  recipient?: Recipient;
}

/**
 * 발송 직전에 쓰는 수신 여부와 수신처 (architecture §5.7, SPEC §6).
 * 수신을 끈 사용자와 없는 사용자는 수신처를 조회하지 않는다. 조회에 카카오 토큰 갱신 같은
 * 외부 호출이 따를 수 있기 때문이다.
 */
export async function getNotificationRecipient(
  deps: IdentityDeps,
  userId: string,
): Promise<NotificationRecipient> {
  const user = await findUserById(deps.db, userId);
  if (!user || user.notificationEnabled !== 1) return { enabled: false };

  const recipient = await deps.recipientResolver.resolve(userId);
  return recipient ? { enabled: true, recipient } : { enabled: true };
}
