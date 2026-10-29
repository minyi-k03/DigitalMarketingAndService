import { encryptAesGcm, randomToken, sha256Hex } from '../../../platform/crypto';
import { DomainError } from '../../../platform/errors';
import { newId } from '../../../platform/id';
import { toUtcInstant } from '../../../../shared/kst-date';
import type { IdentityDeps } from '../deps';
import { invalidLoginState, signLoginState, verifyLoginState } from '../domain/login-state';
import { isInternalPath } from '../domain/return-to';
import { SESSION_TTL_MS } from '../domain/session-policy';
import { upsertKakaoToken } from '../infra/kakao-token-repo';
import { insertSession } from '../infra/session-repo';
import { upsertUserByKakaoId } from '../infra/user-repo';

const DEFAULT_RETURN_TO = '/';

export interface StartKakaoLoginInput {
  returnTo?: string;
  redirectUri: string;
}

export async function startKakaoLogin(
  deps: IdentityDeps,
  { returnTo = DEFAULT_RETURN_TO, redirectUri }: StartKakaoLoginInput,
): Promise<{ authorizeUrl: string; nonce: string }> {
  if (!isInternalPath(returnTo)) {
    throw new DomainError('VALIDATION_FAILED', 'returnTo는 내부 경로여야 합니다', {
      errors: [{ field: 'returnTo', message: '`/`로 시작하는 내부 경로만 허용합니다' }],
    });
  }

  const { state, nonce } = await signLoginState(
    deps.sessionSigningKey,
    returnTo,
    deps.clock.now().getTime(),
  );
  // nonce는 호출자(HTTP 계층)가 로그인을 시작한 브라우저의 쿠키에 심는다 (로그인 CSRF 방어)
  return { authorizeUrl: deps.kakao.buildAuthorizeUrl({ state, redirectUri }), nonce };
}

export interface LoginWithKakaoInput {
  code: string;
  state: string;
  /** 로그인을 시작한 브라우저의 쿠키에서 읽은 nonce. 없으면 거부한다 */
  nonce: string | undefined;
  redirectUri: string;
}

export interface LoginResult {
  /** 쿠키에 담을 세션 토큰 원문. DB에는 해시만 저장한다 */
  sessionToken: string;
  expiresAt: string;
  returnTo: string;
}

export async function loginWithKakao(
  deps: IdentityDeps,
  { code, state, nonce, redirectUri }: LoginWithKakaoInput,
): Promise<LoginResult> {
  const now = deps.clock.now();
  const { nonce: stateNonce, returnTo } = await verifyLoginState(
    deps.sessionSigningKey,
    state,
    now.getTime(),
  );
  // 다른 브라우저에서 시작된 state(공격자가 받은 URL)로는 로그인을 완료할 수 없다
  if (nonce === undefined || nonce !== stateNonce) throw invalidLoginState();

  const tokens = await deps.kakao.exchangeCode({ code, redirectUri });
  if (!tokens) {
    throw new DomainError('VALIDATION_FAILED', '인가 코드가 올바르지 않거나 만료되었습니다', {
      errors: [{ field: 'code', message: '올바르지 않거나 만료된 인가 코드입니다' }],
    });
  }

  const profile = await deps.kakao.fetchProfile(tokens.accessToken);
  const user = await upsertUserByKakaoId(deps.db, {
    newId: newId(),
    kakaoId: profile.kakaoId,
    nickname: profile.nickname,
    nowIso: toUtcInstant(now),
  });

  // 가장 최근 로그인의 동의 범위로 갱신한다. talk_message 동의를 철회하면 발송 대상에서 빠진다.
  await upsertKakaoToken(deps.db, {
    userId: user.id,
    refreshTokenEncrypted: await encryptAesGcm(deps.tokenEncryptionKey, tokens.refreshToken),
    refreshTokenExpiresAt: toUtcInstant(
      new Date(now.getTime() + tokens.refreshTokenExpiresInSeconds * 1000),
    ),
    scopes: tokens.scopes,
    updatedAt: toUtcInstant(now),
  });

  const sessionToken = randomToken(32);
  const expiresAt = toUtcInstant(new Date(now.getTime() + SESSION_TTL_MS));
  await insertSession(deps.db, {
    tokenHash: await sha256Hex(sessionToken),
    userId: user.id,
    expiresAt,
    createdAt: toUtcInstant(now),
  });

  return { sessionToken, expiresAt, returnTo };
}
