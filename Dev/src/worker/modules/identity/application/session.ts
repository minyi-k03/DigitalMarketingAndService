import { sha256Hex } from '../../../platform/crypto';
import { toUtcInstant } from '../../../../shared/kst-date';
import type { IdentityDeps } from '../deps';
import { deleteSession, findSession } from '../infra/session-repo';
import type { UserRef } from '../infra/user-repo';

export type AuthenticatedUser = { userId: string; role: UserRef['role'] };

/** 세션 토큰으로 사용자를 찾는다. 없거나 만료되었으면 null */
export async function authenticate(
  deps: IdentityDeps,
  sessionToken: string | undefined,
): Promise<AuthenticatedUser | null> {
  if (!sessionToken) return null;

  const tokenHash = await sha256Hex(sessionToken);
  const session = await findSession(deps.db, tokenHash);
  if (!session) return null;

  if (session.expiresAt <= toUtcInstant(deps.clock.now())) {
    await deleteSession(deps.db, tokenHash);
    return null;
  }
  return { userId: session.id, role: session.role };
}

export async function logout(deps: IdentityDeps, sessionToken: string | undefined): Promise<void> {
  if (!sessionToken) return;
  await deleteSession(deps.db, await sha256Hex(sessionToken));
}
