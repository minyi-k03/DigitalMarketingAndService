import { env } from 'cloudflare:test';
import { describe, expect, it } from 'vitest';
import { createApp } from '../../src/worker/http/app';
import type { Logger } from '../../src/worker/http/logger';
import { seedItem } from '../support/catalog-seed';
import { buildLoginApp, loginAs, ORIGIN } from '../support/http-login';
import { slotStatusesOf } from '../support/trial-state-seed';

/** `waitUntil`로 넘긴 작업을 모아 두었다가 테스트가 끝나기를 기다릴 수 있는 ExecutionContext */
function fakeExecutionContext() {
  const pending: Promise<unknown>[] = [];
  const ctx = {
    waitUntil: (task: Promise<unknown>) => void pending.push(task),
    passThroughOnException: () => {},
    props: {},
  } as unknown as ExecutionContext;
  return { ctx, settled: () => Promise.all(pending), count: () => pending.length };
}

type Built = ReturnType<typeof buildLoginApp>;

function send(
  built: Built,
  ctx: ExecutionContext,
  method: 'POST' | 'PATCH',
  path: string,
  { cookie, body }: { cookie: string; body: unknown },
) {
  return built.app.request(
    `${ORIGIN}${path}`,
    {
      method,
      headers: { Origin: ORIGIN, Cookie: cookie, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    },
    env,
    ctx,
  );
}

// buildLoginApp 시계는 2026-11-02 10:00 KST. 기본 항목(글로벌, 30일)을 2026-10-03에 시작하면
// 오늘(11-02)이 결제 예정일이고 정규 슬롯은 모두 지나 늦은 등록이 된다
const LATE_START = '2026-10-03';

async function setup() {
  const built = buildLoginApp();
  const { cookie, userId } = await loginAs(built, { kakaoId: `k-${crypto.randomUUID()}` });
  built.recipients.set(userId, { channel: 'KAKAO_MEMO', accessToken: 'access-token' });
  const item = await seedItem(built.catalog, 'PUBLISHED');
  return { built, cookie, userId, item };
}

describe('늦은 등록 즉시 발송 (waitUntil) [S6][S13][T17]', () => {
  it('POST /api/trials가 늦은 등록을 저장하면 응답 뒤 waitUntil로 바로 발송한다', async () => {
    const { built, cookie, item } = await setup();
    const background = fakeExecutionContext();

    const res = await send(built, background.ctx, 'POST', '/api/trials', {
      cookie,
      body: { catalogItemId: item.id, startDate: LATE_START },
    });

    expect(res.status).toBe(201);
    const { id } = (await res.json()) as { id: string };
    await background.settled();
    expect(built.sender.calls.map((c) => c.notification)).toMatchObject([
      { slot: 'LATE_REGISTRATION', link: `/bridge/${id}` },
    ]);
    expect(await slotStatusesOf(id)).toEqual([{ slot: 'LATE_REGISTRATION', status: 'SENT' }]);
  });

  it('PATCH /api/trials/{id}로 정규 슬롯이 모두 지나면 응답 뒤 waitUntil로 바로 발송한다', async () => {
    const { built, cookie, userId, item } = await setup();
    const record = await built.trialTracking.createTrialRecord({ userId, catalogItemId: item.id });
    const background = fakeExecutionContext();

    const res = await send(built, background.ctx, 'PATCH', `/api/trials/${record.id}`, {
      cookie,
      body: { startDate: LATE_START },
    });

    expect(res.status).toBe(200);
    await background.settled();
    expect(built.sender.calls.map((c) => c.notification.slot)).toEqual(['LATE_REGISTRATION']);
  });

  it('정규 슬롯이 남은 등록은 즉시 보낼 것이 없어 아무것도 발송하지 않는다', async () => {
    const { built, cookie, item } = await setup();
    const background = fakeExecutionContext();

    const res = await send(built, background.ctx, 'POST', '/api/trials', {
      cookie,
      body: { catalogItemId: item.id },
    });

    expect(res.status).toBe(201);
    await background.settled();
    expect(built.sender.calls).toEqual([]);
  });

  it('백그라운드 발송이 실패해도 응답은 그대로이고 오류 종류만 기록한다', async () => {
    const { built, cookie, item } = await setup();
    const background = fakeExecutionContext();
    const logs: { event: string; fields?: Record<string, unknown> }[] = [];
    const logger: Logger = {
      info: () => {},
      error: (event, fields) => logs.push({ event, fields }),
    };
    const failing = createApp({
      clock: built.clock,
      db: env.DB,
      logger,
      identity: built.identity,
      catalog: built.catalog,
      trialTracking: {
        ...built.trialTracking,
        dispatchDueNotifications: async () => {
          throw new Error('토큰 abc 포함 메시지');
        },
      },
    });

    const res = await failing.request(
      `${ORIGIN}/api/trials`,
      {
        method: 'POST',
        headers: { Origin: ORIGIN, Cookie: cookie, 'Content-Type': 'application/json' },
        body: JSON.stringify({ catalogItemId: item.id, startDate: LATE_START }),
      },
      env,
      background.ctx,
    );
    await background.settled();

    expect(res.status).toBe(201);
    expect(logs).toEqual([{ event: 'notification_dispatch_failed', fields: { name: 'Error' } }]);
  });
});
