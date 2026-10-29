import {
  fromBase64Url,
  hmacSign,
  hmacVerify,
  randomToken,
  toBase64Url,
} from '../../../platform/crypto';
import { DomainError } from '../../../platform/errors';
import { isInternalPath } from './return-to';

export const STATE_TTL_MS = 10 * 60 * 1000;

interface StatePayload {
  nonce: string;
  returnTo: string;
  /** 만료 시각(epoch ms) */
  exp: number;
}

export const invalidLoginState = () =>
  new DomainError('VALIDATION_FAILED', '로그인 state가 올바르지 않거나 만료되었습니다', {
    errors: [{ field: 'state', message: '올바르지 않거나 만료된 state입니다' }],
  });

export interface LoginState {
  /** state에 서명해 넣은 nonce. 로그인을 시작한 브라우저의 쿠키 값과 같아야 한다 */
  nonce: string;
  returnTo: string;
}

/**
 * `{nonce, returnTo, 만료}`를 HMAC으로 서명한 OAuth state를 만든다 (architecture §9).
 * 같은 nonce를 브라우저 쿠키에도 심어 콜백에서 대조하면 로그인 CSRF를 막는다.
 */
export async function signLoginState(
  secret: string,
  returnTo: string,
  nowMs: number,
): Promise<{ state: string; nonce: string }> {
  const nonce = randomToken(16);
  const payload: StatePayload = { nonce, returnTo, exp: nowMs + STATE_TTL_MS };
  const body = toBase64Url(new TextEncoder().encode(JSON.stringify(payload)));
  return { state: `${body}.${await hmacSign(secret, body)}`, nonce };
}

/** 서명·만료·returnTo를 검증하고 nonce·returnTo를 돌려준다. 하나라도 어긋나면 VALIDATION_FAILED */
export async function verifyLoginState(
  secret: string,
  state: string,
  nowMs: number,
): Promise<LoginState> {
  const [body, signature, ...rest] = state.split('.');
  if (!body || !signature || rest.length > 0) throw invalidLoginState();
  if (!(await hmacVerify(secret, body, signature))) throw invalidLoginState();

  let payload: Partial<StatePayload>;
  try {
    payload = JSON.parse(new TextDecoder().decode(fromBase64Url(body))) as Partial<StatePayload>;
  } catch {
    throw invalidLoginState();
  }
  const { nonce, returnTo, exp } = payload;
  if (typeof exp !== 'number' || exp < nowMs) throw invalidLoginState();
  if (typeof returnTo !== 'string' || !isInternalPath(returnTo)) throw invalidLoginState();
  if (typeof nonce !== 'string' || nonce === '') throw invalidLoginState();
  return { nonce, returnTo };
}
