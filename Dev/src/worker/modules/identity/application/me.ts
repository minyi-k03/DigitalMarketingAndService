import type { components } from '../../../../shared/api-types';
import type { IdentityDeps } from '../deps';
import { findUserById } from '../infra/user-repo';

export type Me = components['schemas']['Me'];

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
    hasRecipient: user.phoneNumberEncrypted !== null,
  } as Me;
}
