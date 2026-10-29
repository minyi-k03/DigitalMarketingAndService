import { decryptAesGcm, encryptAesGcm } from '../../../platform/crypto';
import { toUtcInstant } from '../../../../shared/kst-date';
import type { IdentityDeps } from '../deps';
import { findKakaoToken, replaceRefreshToken } from '../infra/kakao-token-repo';

const TALK_MESSAGE_SCOPE = 'talk_message';

/**
 * '나에게 보내기' 발송용 access token을 돌려준다 (D-16, V-10).
 * 저장된 refresh token으로 갱신하고, 카카오가 새 refresh token을 주면 교체 저장한다.
 * 동의가 없거나 refresh token이 만료·무효이면 null. 카카오 API 오류는 호출한 쪽이 재시도하도록 던진다.
 */
export async function getKakaoMessageAccessToken(
  deps: IdentityDeps,
  userId: string,
): Promise<string | null> {
  const stored = await findKakaoToken(deps.db, userId);
  if (!stored || !stored.scopes.includes(TALK_MESSAGE_SCOPE)) return null;

  const now = deps.clock.now();
  const nowIso = toUtcInstant(now);
  if (stored.refreshTokenExpiresAt <= nowIso) return null;

  const refreshToken = await decryptAesGcm(deps.tokenEncryptionKey, stored.refreshTokenEncrypted);
  const refreshed = await deps.kakao.refreshAccessToken(refreshToken);
  if (!refreshed) return null;

  if (refreshed.refreshToken) {
    const expiresAt = refreshed.refreshTokenExpiresInSeconds
      ? toUtcInstant(new Date(now.getTime() + refreshed.refreshTokenExpiresInSeconds * 1000))
      : stored.refreshTokenExpiresAt;
    await replaceRefreshToken(deps.db, {
      userId,
      refreshTokenEncrypted: await encryptAesGcm(deps.tokenEncryptionKey, refreshed.refreshToken),
      refreshTokenExpiresAt: expiresAt,
      updatedAt: nowIso,
    });
  }
  return refreshed.accessToken;
}
