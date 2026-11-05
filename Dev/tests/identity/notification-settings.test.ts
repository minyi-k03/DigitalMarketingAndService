import { env } from 'cloudflare:test';
import { describe, expect, it } from 'vitest';
import { createIdentityService } from '../../src/worker/modules/identity';
import type { NotificationMode } from '../../src/worker/platform/notification-mode';
import { FakeClock } from '../support/fake-clock';
import { FakeKakaoOAuthClient } from '../support/fake-kakao-oauth';
import { FakeRecipientResolver } from '../support/fake-recipient-resolver';

const REDIRECT_URI = 'https://subcut.test/auth/kakao/callback';
const TALK = ['profile_nickname', 'talk_message'];

function setup(options: { mode?: NotificationMode } = {}) {
  const clock = new FakeClock('2026-11-02T01:00:00.000Z');
  const kakao = new FakeKakaoOAuthClient();
  const recipients = new FakeRecipientResolver();
  const identity = createIdentityService({
    db: env.DB,
    clock,
    kakao,
    sessionSigningKey: 'test-session-signing-key',
    tokenEncryptionKey: btoa('0123456789abcdef0123456789abcdef'),
    notificationMode: options.mode ?? 'kakao_memo',
    recipientResolver: recipients,
  });
  return { clock, kakao, recipients, identity };
}

type Setup = ReturnType<typeof setup>;

/** 카카오 로그인으로 가입하고 사용자 id를 돌려준다. 동의한 범위(scope)는 인자로 정한다 */
async function signUp(s: Setup, scopes: string[] = ['profile_nickname']) {
  const code = `code-${crypto.randomUUID()}`;
  s.kakao.grant(code, { kakaoId: `kakao-${crypto.randomUUID()}`, nickname: '민지' }, scopes);
  const { authorizeUrl, nonce } = await s.identity.startKakaoLogin({ redirectUri: REDIRECT_URI });
  const state = new URL(authorizeUrl).searchParams.get('state') ?? '';
  const { sessionToken } = await s.identity.loginWithKakao({
    code,
    state,
    nonce,
    redirectUri: REDIRECT_URI,
  });
  const user = await s.identity.authenticate(sessionToken);
  return user!.userId;
}

describe('IA 알림 수신 설정 [S44][T07]', () => {
  it('끄면 내 계정 정보에 반영되고 다시 켜면 돌아온다', async () => {
    const s = setup();
    const userId = await signUp(s);

    const off = await s.identity.setNotificationEnabled(userId, false);
    const afterOff = await s.identity.getMe(userId);
    const on = await s.identity.setNotificationEnabled(userId, true);

    expect(off?.notificationEnabled).toBe(false);
    expect(afterOff?.notificationEnabled).toBe(false);
    expect(on?.notificationEnabled).toBe(true);
    expect((await s.identity.getMe(userId))?.notificationEnabled).toBe(true);
  });

  it('없는 사용자는 null이고 아무것도 만들어지지 않는다', async () => {
    const s = setup();

    const result = await s.identity.setNotificationEnabled('no-such-user', false);

    expect(result).toBeNull();
    const row = await env.DB.prepare('SELECT COUNT(*) AS n FROM users WHERE id = ?')
      .bind('no-such-user')
      .first<{ n: number }>();
    expect(row?.n).toBe(0);
  });
});

const DAY_MS = 24 * 60 * 60 * 1000;

async function hasRecipient(s: Setup, userId: string) {
  return (await s.identity.getMe(userId))?.hasRecipient;
}

describe('IA 내 계정의 hasRecipient 판정 [S44][D-16][T07]', () => {
  it('kakao_memo: talk_message에 동의했으면 true, 동의하지 않았으면 false다', async () => {
    const s = setup({ mode: 'kakao_memo' });
    const consented = await signUp(s, TALK);
    const notConsented = await signUp(s, ['profile_nickname']);

    expect(await hasRecipient(s, consented)).toBe(true);
    expect(await hasRecipient(s, notConsented)).toBe(false);
  });

  it('kakao_memo: 저장된 refresh token 만료 시각이 지났으면 false다 (카카오를 호출하지 않는다)', async () => {
    const s = setup({ mode: 'kakao_memo' });
    const userId = await signUp(s, TALK);

    // 가짜 카카오가 주는 refresh token 유효 기간은 60일이다
    s.clock.advanceBy(61 * DAY_MS);

    expect(await hasRecipient(s, userId)).toBe(false);
    expect(s.kakao.refreshCalls).toEqual([]);
  });

  it('log: 개발·staging 모드는 kakao_memo와 같은 기준이다', async () => {
    const s = setup({ mode: 'log' });
    const consented = await signUp(s, TALK);
    const notConsented = await signUp(s, ['profile_nickname']);

    expect(await hasRecipient(s, consented)).toBe(true);
    expect(await hasRecipient(s, notConsented)).toBe(false);
  });

  it('dealer: 카카오 동의가 아니라 전화번호가 있어야 true다', async () => {
    const s = setup({ mode: 'dealer' });
    const withToken = await signUp(s, TALK);
    const withPhone = await signUp(s);
    await env.DB.prepare('UPDATE users SET phone_number_encrypted = ? WHERE id = ?')
      .bind('encrypted-phone', withPhone)
      .run();

    expect(await hasRecipient(s, withToken)).toBe(false);
    expect(await hasRecipient(s, withPhone)).toBe(true);
  });

  it('수신을 꺼도 수신처 확보 여부는 그대로다 (표시용 값이고 발송 여부를 정하지 않는다)', async () => {
    const s = setup({ mode: 'kakao_memo' });
    const userId = await signUp(s, TALK);

    const me = await s.identity.setNotificationEnabled(userId, false);

    expect(me).toMatchObject({ notificationEnabled: false, hasRecipient: true });
  });
});

describe('IA 알림 수신처 조회 [S44][T07]', () => {
  const memo = { channel: 'KAKAO_MEMO', accessToken: 'access-1' } as const;

  it('수신을 켠 사용자는 수신처 조회 결과를 함께 돌려준다', async () => {
    const s = setup();
    const userId = await signUp(s);
    s.recipients.set(userId, memo);

    expect(await s.identity.getNotificationRecipient(userId)).toEqual({
      enabled: true,
      recipient: memo,
    });
  });

  it('수신처를 확보하지 못했으면 recipient 없이 돌려준다 (그 슬롯은 SKIPPED)', async () => {
    const s = setup();
    const userId = await signUp(s);

    const result = await s.identity.getNotificationRecipient(userId);

    expect(result).toEqual({ enabled: true });
    expect(result).not.toHaveProperty('recipient');
  });

  it('수신을 끈 사용자는 수신처가 있어도 enabled false만 돌려주고 조회하지 않는다', async () => {
    const s = setup();
    const userId = await signUp(s);
    s.recipients.set(userId, memo);
    await s.identity.setNotificationEnabled(userId, false);

    const result = await s.identity.getNotificationRecipient(userId);

    expect(result).toEqual({ enabled: false });
    expect(s.recipients.calls).toEqual([]);
  });

  it('다시 켜면 이후 조회부터 수신처가 돌아온다', async () => {
    const s = setup();
    const userId = await signUp(s);
    s.recipients.set(userId, memo);
    await s.identity.setNotificationEnabled(userId, false);
    await s.identity.setNotificationEnabled(userId, true);

    expect(await s.identity.getNotificationRecipient(userId)).toEqual({
      enabled: true,
      recipient: memo,
    });
  });

  it('없는 사용자는 enabled false다', async () => {
    const s = setup();

    expect(await s.identity.getNotificationRecipient('no-such-user')).toEqual({ enabled: false });
    expect(s.recipients.calls).toEqual([]);
  });
});
