import type { components } from '../../../../shared/api-types';
import type { IdentityDeps } from '../deps';
import { findUserById, type UserRow } from '../infra/user-repo';
import { hasActiveMessageConsent } from './kakao-token';

export type Me = components['schemas']['Me'];

/**
 * 알림을 받을 곳을 확보했는지 (표시용, 발송 여부를 정하지 않는다). 발송 채널(`NOTIFICATION_MODE`)로 갈린다.
 * - `dealer`: 알림톡 수신 전화번호
 * - `kakao_memo`: '나에게 보내기' 동의(D-16)
 * - `log`: 개발·staging 모드는 발표용 채널(`kakao_memo`)을 흉내 내므로 같은 기준을 쓴다
 */
async function hasRecipient(deps: IdentityDeps, user: UserRow): Promise<boolean> {
  if (deps.notificationMode === 'dealer') return user.phoneNumberEncrypted !== null;
  return hasActiveMessageConsent(deps, user.id);
}

export async function getMe(deps: IdentityDeps, userId: string): Promise<Me | null> {
  const user = await findUserById(deps.db, userId);
  if (!user) return null;

  return {
    id: user.id,
    ...(user.nickname !== null && { nickname: user.nickname }),
    role: user.role,
    notificationEnabled: user.notificationEnabled === 1,
    ...(user.notificationConsentAt !== null && {
      notificationConsentAt: user.notificationConsentAt,
    }),
    hasRecipient: await hasRecipient(deps, user),
  } as Me;
}
