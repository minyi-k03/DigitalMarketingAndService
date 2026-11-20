import { env } from 'cloudflare:test';
import { beforeEach, describe, expect, it } from 'vitest';
import { KakaoMemoNotificationSender } from '../../src/worker/adapters/kakao-memo';
import { KakaoMemoRecipientResolver } from '../../src/worker/adapters/kakao-memo-recipient';
import { createCatalogService } from '../../src/worker/modules/catalog';
import { createIdentityService, type IdentityService } from '../../src/worker/modules/identity';
import { createTrialTrackingService } from '../../src/worker/modules/trial-tracking';
import { seedItem } from '../support/catalog-seed';
import { FakeClock } from '../support/fake-clock';
import { FakeKakaoOAuthClient } from '../support/fake-kakao-oauth';
import { slotAttemptsOf, slotStatusesOf } from '../support/trial-state-seed';

// 2026-11-05 12:00 KST에 기본 항목(글로벌, 30일)을 등록하면 D3 = 2026-12-01 10:00 KST(01:00Z)
const NOON_KST_NOV_5 = '2026-11-05T03:00:00.000Z';
const D3_AT = '2026-12-01T01:00:00.000Z';
const REDIRECT_URI = 'https://subcut.test/auth/kakao/callback';

beforeEach(async () => {
  await env.DB.prepare('DELETE FROM notification_schedules').run();
});

interface MemoCall {
  url: string;
  authorization: string | null;
  webUrl: string;
}

/**
 * 조립 그대로 확인한다: 실제 D1·Identity(토큰 갱신)·Trial Tracking과 실제 kakao-memo 어댑터·수신처 조회.
 * 카카오 로그인 서버와 '나에게 보내기' HTTP(`fetch`)만 테스트 더블이다 (V-10).
 */
function setup(respond: () => Response = () => new Response('{"result_code":0}')) {
  const clock = new FakeClock(NOON_KST_NOV_5);
  const kakao = new FakeKakaoOAuthClient();
  const calls: MemoCall[] = [];
  const fetchImpl = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const body = new URLSearchParams(typeof init?.body === 'string' ? init.body : '');
    const template = JSON.parse(body.get('template_object') ?? '{}') as {
      link: { web_url: string };
    };
    calls.push({
      url: String(input),
      authorization: new Headers(init?.headers).get('Authorization'),
      webUrl: template.link.web_url,
    });
    return respond();
  }) as typeof fetch;

  const identity: IdentityService = createIdentityService({
    db: env.DB,
    clock,
    kakao,
    sessionSigningKey: 'test-session-signing-key',
    tokenEncryptionKey: btoa('0123456789abcdef0123456789abcdef'),
    notificationMode: 'kakao_memo',
    recipientResolver: new KakaoMemoRecipientResolver((userId) =>
      identity.getKakaoMessageAccessToken(userId),
    ),
  });
  const catalog = createCatalogService({ db: env.DB, clock });
  const trialTracking = createTrialTrackingService({
    db: env.DB,
    clock,
    catalog,
    identity,
    sender: new KakaoMemoNotificationSender({ appOrigin: 'https://subcut.test', fetch: fetchImpl }),
  });

  async function loginAndRegister(code: string, scopes: string[]) {
    kakao.grant(code, { kakaoId: `kid-${code}`, nickname: '민지' }, scopes);
    const { authorizeUrl, nonce } = await identity.startKakaoLogin({ redirectUri: REDIRECT_URI });
    const state = new URL(authorizeUrl).searchParams.get('state') ?? '';
    const { sessionToken } = await identity.loginWithKakao({
      code,
      state,
      nonce,
      redirectUri: REDIRECT_URI,
    });
    const userId = (await identity.authenticate(sessionToken))!.userId;
    const item = await seedItem(catalog, 'PUBLISHED');
    const record = await trialTracking.createTrialRecord({ userId, catalogItemId: item.id });
    return { userId, record };
  }

  return { clock, kakao, calls, trialTracking, loginAndRegister };
}

describe("TT 카카오 '나에게 보내기' 발송 조립 [S13][V-10][T34]", () => {
  it('동의한 사용자의 도래한 알림을 갱신된 access token으로 보내고 SENT로 닫는다', async () => {
    const s = setup();
    const { record } = await s.loginAndRegister('memo-ok', ['profile_nickname', 'talk_message']);
    s.clock.set(D3_AT);

    await s.trialTracking.dispatchDueNotifications();

    expect(s.calls).toEqual([
      {
        url: 'https://kapi.kakao.com/v2/api/talk/memo/default/send',
        authorization: 'Bearer access-from-refresh-memo-ok',
        webUrl: `https://subcut.test/bridge/${record.id}`,
      },
    ]);
    expect((await slotStatusesOf(record.id)).find((x) => x.slot === 'D3')?.status).toBe('SENT');
  });

  it('talk_message 동의가 없으면 카카오로 보내지 않고 SKIPPED로 닫는다', async () => {
    const s = setup();
    const { record } = await s.loginAndRegister('memo-no-consent', ['profile_nickname']);
    s.clock.set(D3_AT);

    await s.trialTracking.dispatchDueNotifications();

    expect(s.calls).toEqual([]);
    expect((await slotStatusesOf(record.id)).find((x) => x.slot === 'D3')?.status).toBe('SKIPPED');
  });

  it('카카오에서 동의를 철회한 사용자(403, code -402)는 재시도 없이 SKIPPED로 닫는다', async () => {
    const s = setup(
      () => new Response('{"msg":"insufficient scopes","code":-402}', { status: 403 }),
    );
    const { record } = await s.loginAndRegister('memo-revoked', [
      'profile_nickname',
      'talk_message',
    ]);
    s.clock.set(D3_AT);

    await s.trialTracking.dispatchDueNotifications();
    await s.trialTracking.dispatchDueNotifications();

    expect(s.calls).toHaveLength(1);
    expect((await slotStatusesOf(record.id)).find((x) => x.slot === 'D3')?.status).toBe('SKIPPED');
  });

  it('카카오 API 오류는 재시도하고 세 번째 실패에 FAILED가 된다 (재시도 규칙 SPEC §17)', async () => {
    const s = setup(() => new Response('{"code":-500}', { status: 500 }));
    const { record } = await s.loginAndRegister('memo-fail', ['profile_nickname', 'talk_message']);
    s.clock.set(D3_AT);

    await s.trialTracking.dispatchDueNotifications();
    expect((await slotStatusesOf(record.id)).find((x) => x.slot === 'D3')?.status).toBe('PENDING');
    expect((await slotAttemptsOf(record.id, 'D3'))?.attempts).toBe(1);

    await s.trialTracking.dispatchDueNotifications();
    await s.trialTracking.dispatchDueNotifications();

    expect(s.calls).toHaveLength(3);
    expect((await slotStatusesOf(record.id)).find((x) => x.slot === 'D3')?.status).toBe('FAILED');
  });
});
