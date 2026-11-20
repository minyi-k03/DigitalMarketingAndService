import { env } from 'cloudflare:test';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createTrialTrackingService } from '../../src/worker/modules/trial-tracking';
import { RecipientUnavailableError } from '../../src/worker/ports/notification-sender';
import {
  forceMissedBilled,
  insertPendingSlot,
  markSending,
  setSendTimeSetting,
  slotAttemptsOf,
  slotStatusesOf,
} from '../support/trial-state-seed';
import { seedItem } from '../support/catalog-seed';
import { buildTrialTracking, registerTrial } from '../support/trial-tracking';
import { insertUser } from '../support/user-seed';

// 2026-11-05 12:00 KST. 기본 항목(글로벌, 30일)을 오늘 등록하면 billingDate 2026-12-05, safeEndDate 2026-12-04,
// D3 = 12-01 10:00 KST(01:00Z), D1 = 12-03 10:00 KST(01:00Z)
const NOON_KST_NOV_5 = '2026-11-05T03:00:00.000Z';
const D3_AT = '2026-12-01T01:00:00.000Z';

// 같은 파일의 테스트는 D1을 공유하므로, 전체 디스패치가 앞선 테스트의 행을 건드리지 않게 비운다
beforeEach(async () => {
  await env.DB.prepare('DELETE FROM notification_schedules').run();
});

// 발송 시각 설정을 바꾼 테스트 뒤에 기본값으로 되돌린다
afterEach(() => setSendTimeSetting('"10:00"'));

/** 알림을 켜 둔 사용자가 카카오 '나에게 보내기' 수신처를 확보한 상태 */
async function registerWithRecipient(startAt = NOON_KST_NOV_5) {
  const t = await registerTrial(startAt);
  t.recipients.set(t.userId, { channel: 'KAKAO_MEMO', accessToken: 'access-token' });
  return t;
}

describe('TT 발송 디스패처 [S13][T17]', () => {
  it('도래한 PENDING 슬롯만 수신처로 보내고 SENT로 닫는다. 미래 슬롯은 그대로다', async () => {
    const t = await registerWithRecipient();
    t.clock.set(D3_AT);

    await t.trialTracking.dispatchDueNotifications();

    expect(t.sender.calls).toEqual([
      {
        recipient: { channel: 'KAKAO_MEMO', accessToken: 'access-token' },
        notification: {
          kind: 'ESCAPE_ALERT',
          slot: 'D3',
          variant: 'REGULAR',
          templateKey: 'ESCAPE_ALERT.REGULAR.RETAIN_UNTIL_END',
          catalogItemName: t.item.name,
          link: `/bridge/${t.record.id}`,
        },
      },
    ]);
    expect(await slotStatusesOf(t.record.id)).toEqual([
      { slot: 'D1', status: 'PENDING' },
      { slot: 'D3', status: 'SENT' },
    ]);
  });

  it('발송 중인 슬롯은 겹쳐 실행된 디스패치가 다시 보내지 않는다 (Cron 겹침 실행 시 1회) [S13]', async () => {
    const t = await registerWithRecipient();
    t.clock.set(D3_AT);
    let second: Promise<unknown> | undefined;
    // 첫 실행이 보내는 도중(행이 SENDING인 때) 두 번째 실행이 시작되는 겹침을 결정적으로 만든다
    t.sender.onSend = async () => {
      t.sender.onSend = undefined;
      second = t.trialTracking.dispatchDueNotifications();
      await second;
    };

    await t.trialTracking.dispatchDueNotifications();

    expect(t.sender.calls).toHaveLength(1);
    expect(await slotStatusesOf(t.record.id)).toEqual([
      { slot: 'D1', status: 'PENDING' },
      { slot: 'D3', status: 'SENT' },
    ]);
  });
});

describe('TT 알림 수신 거부 [S44][V-07][T17]', () => {
  it('수신을 끈 사용자의 슬롯은 보내지 않고 SKIPPED로 기록하며 수신처 조회도 하지 않는다', async () => {
    const t = await registerWithRecipient();
    await t.identity.setNotificationEnabled(t.userId, false);
    t.clock.set(D3_AT);

    await t.trialTracking.dispatchDueNotifications();

    expect(t.sender.calls).toEqual([]);
    expect(t.recipients.calls).toEqual([]);
    expect(await slotStatusesOf(t.record.id)).toEqual([
      { slot: 'D1', status: 'PENDING' },
      { slot: 'D3', status: 'SKIPPED' },
    ]);
  });

  it('수신처를 확보하지 못한 슬롯도 SKIPPED다 (동의 없음·토큰 만료)', async () => {
    const t = await registerTrial(NOON_KST_NOV_5); // 수신처를 등록하지 않음
    t.clock.set(D3_AT);

    await t.trialTracking.dispatchDueNotifications();

    expect(t.sender.calls).toEqual([]);
    expect((await slotStatusesOf(t.record.id)).find((s) => s.slot === 'D3')?.status).toBe(
      'SKIPPED',
    );
  });

  it('수신 거부 중에도 상태 전이는 계속되고 다시 켜면 이후 슬롯만 보낸다', async () => {
    const t = await registerWithRecipient();
    await t.identity.setNotificationEnabled(t.userId, false);
    t.clock.set(D3_AT);
    await t.trialTracking.dispatchDueNotifications({ trialRecordId: t.record.id });

    // 꺼 둔 동안에도 사유 선택 전이는 그대로 진행된다
    await t.trialTracking.startCancelAttempt({ ...t.ref, exitReason: 'PRICE_BURDEN' });
    expect(await t.trialTracking.getTrialRecord(t.ref)).toMatchObject({
      status: 'CANCEL_ATTEMPTED',
    });

    // 다시 켜면 이후 슬롯(D1 해지 확인)부터 나가고, 지나간 D3는 되살리지 않는다
    await t.identity.setNotificationEnabled(t.userId, true);
    t.clock.set('2026-12-03T01:00:00.000Z');
    await t.trialTracking.dispatchDueNotifications({ trialRecordId: t.record.id });

    expect(t.sender.calls.map((c) => c.notification.slot)).toEqual(['D1_CONFIRM']);
    expect(await slotStatusesOf(t.record.id)).toEqual([
      { slot: 'D1', status: 'CANCELED' },
      { slot: 'D1_CONFIRM', status: 'SENT' },
      { slot: 'D3', status: 'SKIPPED' },
    ]);
  });
});

describe('TT 발송 실패와 재시도 [S13][T17]', () => {
  it('발송 시점에 수신처를 쓸 수 없다고 확인되면(동의 철회) 재시도 없이 SKIPPED로 닫는다 [V-10][T34]', async () => {
    const t = await registerWithRecipient();
    t.clock.set(D3_AT);
    t.sender.failNext(1, new RecipientUnavailableError('동의 없음'));

    const result = await t.trialTracking.dispatchDueNotifications();

    expect(result).toMatchObject({ sent: 0, skipped: 1, retried: 0, failed: 0 });
    expect(await slotStatusesOf(t.record.id)).toEqual([
      { slot: 'D1', status: 'PENDING' },
      { slot: 'D3', status: 'SKIPPED' },
    ]);
    expect((await slotAttemptsOf(t.record.id, 'D3'))?.attempts).toBe(0);
    await t.trialTracking.dispatchDueNotifications();
    expect(t.sender.calls).toHaveLength(1);
  });

  it('실패하면 시도 횟수를 올려 PENDING으로 되돌리고 다음 실행이 다시 보낸다', async () => {
    const t = await registerWithRecipient();
    t.clock.set(D3_AT);
    t.sender.failNext(1);

    const first = await t.trialTracking.dispatchDueNotifications({ trialRecordId: t.record.id });

    expect(first).toMatchObject({ sent: 0, retried: 1 });
    expect(await slotAttemptsOf(t.record.id, 'D3')).toMatchObject({ attempts: 1 });
    expect((await slotStatusesOf(t.record.id)).find((s) => s.slot === 'D3')?.status).toBe(
      'PENDING',
    );

    const second = await t.trialTracking.dispatchDueNotifications({ trialRecordId: t.record.id });

    expect(second).toMatchObject({ sent: 1 });
    expect((await slotStatusesOf(t.record.id)).find((s) => s.slot === 'D3')?.status).toBe('SENT');
  });

  it('3회 실패하면 FAILED로 닫고 더 시도하지 않는다', async () => {
    const t = await registerWithRecipient();
    t.clock.set(D3_AT);
    t.sender.failNext(10);

    for (let i = 0; i < 3; i++) {
      await t.trialTracking.dispatchDueNotifications({ trialRecordId: t.record.id });
    }
    const afterThird = t.sender.calls.length;
    const fourth = await t.trialTracking.dispatchDueNotifications({ trialRecordId: t.record.id });

    expect(afterThird).toBe(3);
    expect(fourth).toMatchObject({ sent: 0, retried: 0, failed: 0 });
    expect(t.sender.calls).toHaveLength(3);
    expect(await slotAttemptsOf(t.record.id, 'D3')).toMatchObject({ attempts: 3 });
    expect((await slotStatusesOf(t.record.id)).find((s) => s.slot === 'D3')?.status).toBe('FAILED');
  });
});

describe('TT 발송 중(SENDING) 복구 [S13][T17]', () => {
  it('SENDING으로 15분 넘게 남은 행은 PENDING으로 되돌려 다시 보낸다 (중복 발송 가능성을 허용하는 유일한 경우)', async () => {
    const t = await registerWithRecipient();
    await markSending(t.record.id, 'D3', '2026-12-01T00:44:59.000Z'); // 15분 1초 전
    t.clock.set(D3_AT);

    const result = await t.trialTracking.dispatchDueNotifications({ trialRecordId: t.record.id });

    expect(result).toMatchObject({ reclaimed: 1, sent: 1 });
    expect(t.sender.calls.map((c) => c.notification.slot)).toEqual(['D3']);
  });

  it.each([
    ['14분', '2026-12-01T00:46:00.000Z'],
    ['정확히 15분 (SPEC §17 "15분 넘게")', '2026-12-01T00:45:00.000Z'],
  ])('%s 남은 SENDING 행은 다른 실행이 처리 중일 수 있어 건드리지 않는다', async (_label, at) => {
    const t = await registerWithRecipient();
    await markSending(t.record.id, 'D3', at);
    t.clock.set(D3_AT);

    const result = await t.trialTracking.dispatchDueNotifications({ trialRecordId: t.record.id });

    expect(result).toMatchObject({ reclaimed: 0, sent: 0 });
    expect(t.sender.calls).toEqual([]);
    expect((await slotStatusesOf(t.record.id)).find((s) => s.slot === 'D3')?.status).toBe(
      'SENDING',
    );
  });
});

describe('TT 의미를 잃은 알림 만료와 알림 종류별 발송 [S13][S31][T17]', () => {
  it('BillingDate가 지난 ESCAPE_ALERT는 보내지 않고 EXPIRED로 닫는다', async () => {
    const t = await registerWithRecipient();
    t.clock.set('2026-12-06T01:00:00.000Z'); // billingDate 12-05의 다음 날 10:00 KST. Cron이 오래 멈췄던 경우

    const result = await t.trialTracking.dispatchDueNotifications({ trialRecordId: t.record.id });

    expect(result).toMatchObject({ expired: 2, sent: 0 });
    expect(t.sender.calls).toEqual([]);
    expect(await slotStatusesOf(t.record.id)).toEqual([
      { slot: 'D1', status: 'EXPIRED' },
      { slot: 'D3', status: 'EXPIRED' },
    ]);
  });

  it('BillingDate 당일의 늦은 등록 알림은 보낸다 (경계는 당일 포함)', async () => {
    const { catalog, trialTracking, recipients, sender } = buildTrialTracking(NOON_KST_NOV_5);
    const item = await seedItem(catalog, 'PUBLISHED');
    const userId = await insertUser();
    recipients.set(userId, { channel: 'KAKAO_MEMO', accessToken: 'access-token' });
    // 30일 전에 시작해 오늘이 결제 예정일(11-05)
    const record = await trialTracking.createTrialRecord({
      userId,
      catalogItemId: item.id,
      startDate: '2026-10-06',
    });

    const result = await trialTracking.dispatchDueNotifications({ trialRecordId: record.id });

    expect(result).toMatchObject({ expired: 0, sent: 1 });
    expect(sender.calls.map((c) => c.notification)).toMatchObject([
      { slot: 'LATE_REGISTRATION', templateKey: 'ESCAPE_ALERT.LATE_BILLING_DAY.RETAIN_UNTIL_END' },
    ]);
  });

  it('기록이 TRACKING이 아니면 ESCAPE_ALERT는 EXPIRED다', async () => {
    const t = await registerWithRecipient();
    await forceMissedBilled(t.record.id, NOON_KST_NOV_5); // 알림 취소 없이 상태만 바뀐 경우
    t.clock.set(D3_AT);

    const result = await t.trialTracking.dispatchDueNotifications({ trialRecordId: t.record.id });

    // 아직 도래하지 않은 D1도 의미를 잃었으므로 함께 닫는다
    expect(result).toMatchObject({ expired: 2, sent: 0 });
    expect(t.sender.calls).toEqual([]);
    expect(await slotStatusesOf(t.record.id)).toEqual([
      { slot: 'D1', status: 'EXPIRED' },
      { slot: 'D3', status: 'EXPIRED' },
    ]);
  });

  it('기록이 CANCEL_ATTEMPTED가 아니면 CANCEL_CONFIRM_CHECK는 EXPIRED다', async () => {
    const t = await registerWithRecipient();
    await insertPendingSlot(t.record.id, 'D1_CONFIRM', '2026-12-04', D3_AT); // 기록은 TRACKING
    t.clock.set(D3_AT);

    await t.trialTracking.dispatchDueNotifications({ trialRecordId: t.record.id });

    expect(t.sender.calls.map((c) => c.notification.slot)).toEqual(['D3']);
    expect((await slotStatusesOf(t.record.id)).find((s) => s.slot === 'D1_CONFIRM')?.status).toBe(
      'EXPIRED',
    );
  });

  it('CANCEL_ATTEMPTED 기록의 해지 확인 알림은 해지 브릿지 링크로 보낸다', async () => {
    const t = await registerWithRecipient();
    await t.trialTracking.startCancelAttempt({ ...t.ref, exitReason: 'PRICE_BURDEN' });
    t.clock.set('2026-12-03T01:00:00.000Z');

    await t.trialTracking.dispatchDueNotifications({ trialRecordId: t.record.id });

    expect(t.sender.calls.map((c) => c.notification)).toMatchObject([
      {
        slot: 'D1_CONFIRM',
        templateKey: 'CANCEL_CONFIRM_CHECK.REGULAR',
        link: `/bridge/${t.record.id}`,
      },
    ]);
  });

  it('MISSED_BILLED 기록의 결제 확인 알림은 내 체험 상세 링크로 보낸다', async () => {
    const t = await registerWithRecipient();
    await forceMissedBilled(t.record.id, NOON_KST_NOV_5);
    await insertPendingSlot(t.record.id, 'BILLING_CHECK', '2026-12-04', D3_AT);
    t.clock.set(D3_AT);

    await t.trialTracking.dispatchDueNotifications({ trialRecordId: t.record.id });

    const billing = t.sender.calls.find((c) => c.notification.slot === 'BILLING_CHECK');
    expect(billing?.notification).toMatchObject({
      templateKey: 'BILLING_CHECK.REGULAR',
      link: `/trials/${t.record.id}`,
    });
  });

  it('기록이 MISSED_BILLED가 아니면 BILLING_CHECK는 EXPIRED다', async () => {
    const t = await registerWithRecipient();
    await insertPendingSlot(t.record.id, 'BILLING_CHECK', '2026-12-04', D3_AT); // 기록은 TRACKING
    t.clock.set(D3_AT);

    await t.trialTracking.dispatchDueNotifications({ trialRecordId: t.record.id });

    expect(t.sender.calls.map((c) => c.notification.slot)).toEqual(['D3']);
    expect(
      (await slotStatusesOf(t.record.id)).find((s) => s.slot === 'BILLING_CHECK')?.status,
    ).toBe('EXPIRED');
  });
});

describe('TT 발송 시각 설정 변경 [G5][T17]', () => {
  it('기존 PENDING 슬롯의 sendAt은 설정을 바꿔도 유지된다', async () => {
    const t = await registerWithRecipient(); // D3는 설정 10:00 기준으로 12-01 10:00 KST에 예약됨
    await setSendTimeSetting('"08:30"');

    t.clock.set('2026-12-01T00:00:00.000Z'); // 12-01 09:00 KST. 새 설정(08:30) 기준이었다면 이미 도래
    await t.trialTracking.dispatchDueNotifications({ trialRecordId: t.record.id });
    expect(t.sender.calls).toEqual([]);

    t.clock.set(D3_AT); // 12-01 10:00 KST: 예약 당시 시각
    await t.trialTracking.dispatchDueNotifications({ trialRecordId: t.record.id });
    expect(t.sender.calls.map((c) => c.notification.slot)).toEqual(['D3']);
  });
});

describe('TT 디스패치 범위 [T17]', () => {
  it('기록을 지정하면 그 기록의 슬롯만, 지정하지 않으면 도래한 모든 기록의 슬롯을 보낸다', async () => {
    const first = await registerWithRecipient();
    const second = await registerWithRecipient();
    first.clock.set(D3_AT);
    second.clock.set(D3_AT);

    await first.trialTracking.dispatchDueNotifications({ trialRecordId: first.record.id });
    expect(first.sender.calls.map((c) => c.notification.link)).toEqual([
      `/bridge/${first.record.id}`,
    ]);
    expect(await slotStatusesOf(second.record.id)).toEqual([
      { slot: 'D1', status: 'PENDING' },
      { slot: 'D3', status: 'PENDING' },
    ]);

    await second.trialTracking.dispatchDueNotifications();
    expect(second.sender.calls.map((c) => c.notification.link)).toEqual([
      `/bridge/${second.record.id}`,
    ]);
  });
});

/** SENT로 닫는 문장만 실패하는 D1. 발송은 끝났는데 기록이 남지 않는 장애를 흉내 낸다 */
function failingMarkSent(db: D1Database): D1Database {
  return new Proxy(db, {
    get(target, prop) {
      if (prop === 'prepare') {
        return (sql: string) => {
          if (sql.includes("status = 'SENT'")) throw new Error('D1 일시 오류');
          return target.prepare(sql);
        };
      }
      const value = Reflect.get(target, prop);
      return typeof value === 'function' ? value.bind(target) : value;
    },
  });
}

function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((r) => (resolve = r));
  return { promise, resolve };
}

describe('TT 발송 결과 기록의 정확성 [S13][T17]', () => {
  it('발송이 끝난 뒤 SENT 기록이 실패해도 재시도로 되돌리지 않는다 (중복은 15분 복구의 경우만 허용)', async () => {
    const t = await registerWithRecipient();
    const flaky = createTrialTrackingService({
      db: failingMarkSent(env.DB),
      clock: t.clock,
      catalog: t.catalog,
      identity: t.identity,
      sender: t.sender,
    });
    t.clock.set(D3_AT);

    const first = await flaky.dispatchDueNotifications({ trialRecordId: t.record.id });
    // 이미 보낸 슬롯이라 시도 횟수를 올리거나 PENDING으로 되돌리면 바로 다시 나간다
    await t.trialTracking.dispatchDueNotifications({ trialRecordId: t.record.id });

    expect(first).toMatchObject({ sent: 1, retried: 0, failed: 0 });
    expect(t.sender.calls).toHaveLength(1);
    expect(await slotAttemptsOf(t.record.id, 'D3')).toMatchObject({ attempts: 0 });
    expect((await slotStatusesOf(t.record.id)).find((s) => s.slot === 'D3')?.status).toBe(
      'SENDING',
    );
  });

  it('복구돼 다른 실행이 다시 선점한 슬롯을, 늦게 끝난 이전 실행의 결과가 덮지 않는다', async () => {
    const t = await registerWithRecipient();
    const gates = [deferred(), deferred()];
    t.sender.onSend = (callIndex) => gates[callIndex]!.promise;
    t.sender.failNext(1); // 첫 호출(이전 실행)만 실패한다
    const slotStatus = async () =>
      (await slotStatusesOf(t.record.id)).find((s) => s.slot === 'D3')?.status;

    t.clock.set(D3_AT);
    const stale = t.trialTracking.dispatchDueNotifications({ trialRecordId: t.record.id });
    await vi.waitFor(() => expect(t.sender.calls).toHaveLength(1));

    t.clock.set('2026-12-01T01:15:01.000Z'); // 15분이 넘어 복구 대상
    const fresh = t.trialTracking.dispatchDueNotifications({ trialRecordId: t.record.id });
    await vi.waitFor(() => expect(t.sender.calls).toHaveLength(2));

    gates[0]!.resolve(); // 이전 실행이 이제 실패로 끝난다. 이미 자기 소유가 아닌 행이다
    const staleResult = await stale;
    expect(await slotStatus()).toBe('SENDING');
    expect(staleResult).toMatchObject({ retried: 0, failed: 0 });
    expect(await slotAttemptsOf(t.record.id, 'D3')).toMatchObject({ attempts: 0 });

    gates[1]!.resolve();
    await fresh;
    expect(await slotStatus()).toBe('SENT');
  });
});

describe('TT 디스패치 시각·격리 경계 [S13][S31][T17]', () => {
  it('KST 00:00~08:59(UTC 전날)에도 오늘(KST)로 판정해 지난 BillingDate의 탈출 알림은 EXPIRED다', async () => {
    const t = await registerWithRecipient(); // billingDate 2026-12-05
    t.clock.set('2026-12-05T15:30:00.000Z'); // KST 12-06 00:30. UTC 날짜로 보면 아직 12-05

    const result = await t.trialTracking.dispatchDueNotifications({ trialRecordId: t.record.id });

    expect(result).toMatchObject({ expired: 2, sent: 0 });
    expect(t.sender.calls).toEqual([]);
  });

  it('한 슬롯의 발송이 실패해도 같은 회차의 다른 슬롯은 보낸다', async () => {
    const { catalog, trialTracking, recipients, sender, clock } =
      buildTrialTracking(NOON_KST_NOV_5);
    const item = await seedItem(catalog, 'PUBLISHED');
    const ids: string[] = [];
    for (let i = 0; i < 2; i++) {
      const userId = await insertUser();
      recipients.set(userId, { channel: 'KAKAO_MEMO', accessToken: 'access-token' });
      ids.push((await trialTracking.createTrialRecord({ userId, catalogItemId: item.id })).id);
    }
    clock.set(D3_AT);
    sender.failNext(1); // 첫 호출만 실패한다

    const result = await trialTracking.dispatchDueNotifications();

    expect(result).toMatchObject({ sent: 1, retried: 1, failed: 0 });
    const statuses = await Promise.all(
      ids.map(async (id) => (await slotStatusesOf(id)).find((s) => s.slot === 'D3')?.status),
    );
    expect([...statuses].sort()).toEqual(['PENDING', 'SENT']);
  });
});
