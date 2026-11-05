import { decryptAesGcm, encryptAesGcm } from '../../../platform/crypto';
import { toUtcInstant } from '../../../../shared/kst-date';
import type { IdentityDeps } from '../deps';
import { findKakaoToken, replaceRefreshToken, type KakaoTokenRow } from '../infra/kakao-token-repo';

const TALK_MESSAGE_SCOPE = 'talk_message';

/** '나에게 보내기' 동의가 있고 저장된 refresh token이 아직 만료 전인지. 카카오를 호출하지 않는다 */
function isMessageConsentActive(
  stored: KakaoTokenRow | null,
  nowIso: string,
): stored is KakaoTokenRow {
  return (
    stored !== null &&
    stored.scopes.includes(TALK_MESSAGE_SCOPE) &&
    stored.refreshTokenExpiresAt > nowIso
  );
}

/**
 * `Me.hasRecipient`(kakao_memo)용 가벼운 판정. 실제 만료·철회는 발송 때 `getKakaoMessageAccessToken`이
 * 카카오에 확인하므로 여기서는 저장된 값만 본다.
 */
export async function hasActiveMessageConsent(
  deps: IdentityDeps,
  userId: string,
): Promise<boolean> {
  const stored = await findKakaoToken(deps.db, userId);
  return isMessageConsentActive(stored, toUtcInstant(deps.clock.now()));
}

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
  const now = deps.clock.now();
  const nowIso = toUtcInstant(now);
  if (!isMessageConsentActive(stored, nowIso)) return null;

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
