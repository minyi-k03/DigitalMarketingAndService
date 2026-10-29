import { env } from 'cloudflare:test';
import { describe, expect, it } from 'vitest';

const NOW = '2026-10-28T00:00:00.000Z';
type Row = Record<string, string | number | null>;

let seq = 0;
const uid = (prefix: string) => `${prefix}-${++seq}`;

async function insert(table: string, row: Row) {
  const cols = Object.keys(row);
  const placeholders = cols.map(() => '?').join(', ');
  return env.DB.prepare(`INSERT INTO ${table} (${cols.join(', ')}) VALUES (${placeholders})`)
    .bind(...Object.values(row))
    .run();
}

const userRow = (id: string, over: Row = {}): Row => ({
  id,
  kakao_id: `kakao-${id}`,
  notification_enabled: 1,
  role: 'USER',
  created_at: NOW,
  ...over,
});

const itemRow = (id: string, over: Row = {}): Row => ({
  id,
  kind: 'GUARDED_SERVICE',
  name: '테스트 서비스',
  publication_status: 'PUBLISHED',
  service_category: 'OTT',
  monthly_price: 10000,
  default_trial_days: 30,
  is_global_time_zone_buffer_required: 0,
  dark_pattern_scores: '{"menuDepth":0,"persuasionPopups":0,"forcedPcOrApp":0}',
  dark_pattern_level: 'LOW',
  escape_pattern: 'DIRECT_LINK',
  escape_guide_steps: '["설정에서 해지"]',
  escape_link: 'https://example.com/cancel',
  access_retention_policy: 'RETAIN_UNTIL_END',
  support_contact: '{}',
  last_verified_at: '2026-10-28',
  created_at: NOW,
  updated_at: NOW,
  ...over,
});

const trialRow = (id: string, userId: string, itemId: string, over: Row = {}): Row => ({
  id,
  user_id: userId,
  catalog_item_id: itemId,
  source: 'MANUAL_CATALOG_SELECT',
  start_date: '2026-10-28',
  trial_days: 30,
  buffer_applied: 0,
  billing_date: '2026-11-27',
  safe_end_date: '2026-11-27',
  status: 'TRACKING',
  status_changed_at: NOW,
  created_at: NOW,
  ...over,
});

const scheduleRow = (id: string, trialId: string, over: Row = {}): Row => ({
  id,
  trial_record_id: trialId,
  kind: 'ESCAPE_ALERT',
  slot: 'D3',
  variant: 'REGULAR',
  safe_end_date: '2026-11-27',
  send_at: '2026-11-24T01:00:00.000Z',
  status: 'PENDING',
  ...over,
});

async function seedUserAndItem(itemOver: Row = {}) {
  const userId = uid('user');
  const itemId = uid('item');
  await insert('users', userRow(userId));
  await insert('catalog_items', itemRow(itemId, itemOver));
  return { userId, itemId };
}

const CHECK = /CHECK constraint failed/i;
const UNIQUE = /UNIQUE constraint failed/i;
const FOREIGN_KEY = /FOREIGN KEY constraint failed/i;

describe('D1 스키마 0001_p0_init [T03]', () => {
  it('P0 테이블 12개가 모두 만들어진다', async () => {
    const { results } = await env.DB.prepare(
      "SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '_cf_%' AND name NOT LIKE 'd1_%'",
    ).all<{ name: string }>();

    expect(results.map((r) => r.name).sort()).toEqual(
      [
        'app_settings',
        'broken_link_reports',
        'catalog_change_logs',
        'catalog_items',
        'exit_poll_responses',
        'featured_events',
        'kakao_message_tokens',
        'notification_schedules',
        'partners',
        'sessions',
        'trial_records',
        'users',
      ].sort(),
    );
  });

  it('app_settings에 기본값이 들어 있다 (발송 시각 10:00, 기준표 2/4, 딥링크 스킴 [])', async () => {
    const { results } = await env.DB.prepare('SELECT key, value FROM app_settings').all<{
      key: string;
      value: string;
    }>();
    const settings = Object.fromEntries(results.map((r) => [r.key, JSON.parse(r.value)]));

    expect(settings).toEqual({
      'notification.sendTime': '10:00',
      'catalog.darkPatternRubric': { mediumMin: 2, highMin: 4 },
      'catalog.allowedDeepLinkSchemes': [],
    });
  });
});

describe('TT trial_records 제약 [S13][S26][T03]', () => {
  it('ExitPoll 불변식: TRACKING에 exit_reason이 있으면 거부한다', async () => {
    const { userId, itemId } = await seedUserAndItem();

    await expect(
      insert('trial_records', trialRow(uid('t'), userId, itemId, { exit_reason: 'PRICE_BURDEN' })),
    ).rejects.toThrow(CHECK);
  });

  it.each(['CANCEL_ATTEMPTED', 'CANCELED_CONFIRMED'])(
    'ExitPoll 불변식: %s에 exit_reason이 없으면 거부한다',
    async (status) => {
      const { userId, itemId } = await seedUserAndItem();

      await expect(
        insert('trial_records', trialRow(uid('t'), userId, itemId, { status })),
      ).rejects.toThrow(CHECK);
    },
  );

  it('exit_reason이 있는 CANCEL_ATTEMPTED와 없는 KEPT는 저장된다', async () => {
    const a = await seedUserAndItem();
    const b = await seedUserAndItem();

    await insert(
      'trial_records',
      trialRow(uid('t'), a.userId, a.itemId, {
        status: 'CANCEL_ATTEMPTED',
        exit_reason: 'COMPLEX_UX',
      }),
    );
    await insert('trial_records', trialRow(uid('t'), b.userId, b.itemId, { status: 'KEPT' }));
  });

  it('정의되지 않은 status와 exit_reason 값은 거부한다', async () => {
    const { userId, itemId } = await seedUserAndItem();

    await expect(
      insert('trial_records', trialRow(uid('t'), userId, itemId, { status: 'DONE' })),
    ).rejects.toThrow(CHECK);
    await expect(
      insert(
        'trial_records',
        trialRow(uid('t'), userId, itemId, { status: 'CANCEL_ATTEMPTED', exit_reason: 'OTHER' }),
      ),
    ).rejects.toThrow(CHECK);
  });

  it('같은 사용자·서비스의 진행 중 기록(TRACKING)은 중복 INSERT를 거부한다', async () => {
    const { userId, itemId } = await seedUserAndItem();
    await insert('trial_records', trialRow(uid('t'), userId, itemId));

    await expect(insert('trial_records', trialRow(uid('t'), userId, itemId))).rejects.toThrow(
      UNIQUE,
    );
  });

  it('CANCEL_ATTEMPTED도 진행 중이므로 같은 서비스의 새 TRACKING을 거부한다', async () => {
    const { userId, itemId } = await seedUserAndItem();
    await insert(
      'trial_records',
      trialRow(uid('t'), userId, itemId, {
        status: 'CANCEL_ATTEMPTED',
        exit_reason: 'PRICE_BURDEN',
      }),
    );

    await expect(insert('trial_records', trialRow(uid('t'), userId, itemId))).rejects.toThrow(
      UNIQUE,
    );
  });

  it('종료된 기록이 있어도 같은 서비스를 다시 등록할 수 있다', async () => {
    const { userId, itemId } = await seedUserAndItem();
    await insert('trial_records', trialRow(uid('t'), userId, itemId, { status: 'KEPT' }));

    await insert('trial_records', trialRow(uid('t'), userId, itemId));
  });

  it('다른 사용자는 같은 서비스를 동시에 추적할 수 있다', async () => {
    const { userId, itemId } = await seedUserAndItem();
    const otherUser = uid('user');
    await insert('users', userRow(otherUser));
    await insert('trial_records', trialRow(uid('t'), userId, itemId));

    await insert('trial_records', trialRow(uid('t'), otherUser, itemId));
  });

  it('존재하지 않는 사용자·서비스를 가리키는 기록은 거부한다', async () => {
    const { userId, itemId } = await seedUserAndItem();

    await expect(
      insert('trial_records', trialRow(uid('t'), 'no-such-user', itemId)),
    ).rejects.toThrow(FOREIGN_KEY);
    await expect(
      insert('trial_records', trialRow(uid('t'), userId, 'no-such-item')),
    ).rejects.toThrow(FOREIGN_KEY);
  });
});

describe('TT exit_poll_responses·notification_schedules 제약 [S13][T03]', () => {
  async function seedTrial() {
    const { userId, itemId } = await seedUserAndItem();
    const trialId = uid('t');
    await insert('trial_records', trialRow(trialId, userId, itemId));
    return { userId, itemId, trialId };
  }

  it('기록당 ExitPoll 응답은 1건만 허용한다 (PK)', async () => {
    const { itemId, trialId } = await seedTrial();
    const response = {
      trial_record_id: trialId,
      catalog_item_id: itemId,
      service_category: 'OTT',
      reason: 'PRICE_BURDEN',
      responded_at: NOW,
    };
    await insert('exit_poll_responses', response);

    await expect(
      insert('exit_poll_responses', { ...response, reason: 'COMPLEX_UX' }),
    ).rejects.toThrow(UNIQUE);
  });

  it('(trial_record_id, slot, safe_end_date) 중복 INSERT는 거부하고 날짜가 다르면 허용한다', async () => {
    const { trialId } = await seedTrial();
    await insert('notification_schedules', scheduleRow(uid('n'), trialId));

    await expect(insert('notification_schedules', scheduleRow(uid('n'), trialId))).rejects.toThrow(
      UNIQUE,
    );
    await insert(
      'notification_schedules',
      scheduleRow(uid('n'), trialId, { safe_end_date: '2026-11-28' }),
    );
  });

  it('종류와 맞지 않는 슬롯 조합은 거부한다', async () => {
    const { trialId } = await seedTrial();

    await expect(
      insert('notification_schedules', scheduleRow(uid('n'), trialId, { slot: 'D1_CONFIRM' })),
    ).rejects.toThrow(CHECK);
    await expect(
      insert(
        'notification_schedules',
        scheduleRow(uid('n'), trialId, { kind: 'BILLING_CHECK', slot: 'D1' }),
      ),
    ).rejects.toThrow(CHECK);
    await insert(
      'notification_schedules',
      scheduleRow(uid('n'), trialId, { kind: 'CANCEL_CONFIRM_CHECK', slot: 'D1_CONFIRM' }),
    );
  });

  it('체험 기록을 지우면 같은 모듈의 응답과 알림 스케줄이 함께 지워진다', async () => {
    const { itemId, trialId } = await seedTrial();
    await insert('exit_poll_responses', {
      trial_record_id: trialId,
      catalog_item_id: itemId,
      service_category: 'OTT',
      reason: 'PRICE_BURDEN',
      responded_at: NOW,
    });
    await insert('notification_schedules', scheduleRow(uid('n'), trialId));

    await env.DB.prepare('DELETE FROM trial_records WHERE id = ?').bind(trialId).run();

    const poll = await env.DB.prepare(
      'SELECT COUNT(*) AS c FROM exit_poll_responses WHERE trial_record_id = ?',
    )
      .bind(trialId)
      .first<{ c: number }>();
    const schedules = await env.DB.prepare(
      'SELECT COUNT(*) AS c FROM notification_schedules WHERE trial_record_id = ?',
    )
      .bind(trialId)
      .first<{ c: number }>();
    expect(poll?.c).toBe(0);
    expect(schedules?.c).toBe(0);
  });
});

describe('CM catalog_items 제약 [D-13][D-15][T03]', () => {
  const partnerRow = (id: string): Row => ({
    id,
    company_name: '가상 파트너',
    contact_email: 'partner@example.com',
    created_at: NOW,
  });

  it('SPONSORED_TRIAL은 signup_url과 owner_partner_id가 모두 있어야 한다', async () => {
    const partnerId = uid('partner');
    await insert('partners', partnerRow(partnerId));
    const sponsored = { kind: 'SPONSORED_TRIAL', publication_status: 'SUBMITTED' };

    await expect(insert('catalog_items', itemRow(uid('item'), sponsored))).rejects.toThrow(CHECK);
    await expect(
      insert('catalog_items', itemRow(uid('item'), { ...sponsored, owner_partner_id: partnerId })),
    ).rejects.toThrow(CHECK);
    await expect(
      insert(
        'catalog_items',
        itemRow(uid('item'), { ...sponsored, signup_url: 'https://example.com/signup' }),
      ),
    ).rejects.toThrow(CHECK);
    await insert(
      'catalog_items',
      itemRow(uid('item'), {
        ...sponsored,
        owner_partner_id: partnerId,
        signup_url: 'https://example.com/signup',
      }),
    );
  });

  it('PC_OR_APP_FORCED는 forced_channel이 필수이고 그 밖의 유형에는 허용하지 않는다', async () => {
    await expect(
      insert('catalog_items', itemRow(uid('item'), { escape_pattern: 'PC_OR_APP_FORCED' })),
    ).rejects.toThrow(CHECK);
    await expect(
      insert('catalog_items', itemRow(uid('item'), { forced_channel: 'PC_WEB' })),
    ).rejects.toThrow(CHECK);
    await insert(
      'catalog_items',
      itemRow(uid('item'), { escape_pattern: 'PC_OR_APP_FORCED', forced_channel: 'PC_WEB' }),
    );
  });

  it('forced_channel = APP이면 escape_link_fallback_url이 필수다', async () => {
    const forcedApp = { escape_pattern: 'PC_OR_APP_FORCED', forced_channel: 'APP' };

    await expect(insert('catalog_items', itemRow(uid('item'), forcedApp))).rejects.toThrow(CHECK);
    await insert(
      'catalog_items',
      itemRow(uid('item'), { ...forcedApp, escape_link_fallback_url: 'https://example.com/web' }),
    );
  });

  it('featured_order는 유일하고 NULL은 여러 건 허용한다', async () => {
    await insert('catalog_items', itemRow(uid('item'), { featured_order: 91 }));

    await expect(
      insert('catalog_items', itemRow(uid('item'), { featured_order: 91 })),
    ).rejects.toThrow(UNIQUE);
    await expect(
      insert('catalog_items', itemRow(uid('item'), { featured_order: 0 })),
    ).rejects.toThrow(CHECK);
    await insert('catalog_items', itemRow(uid('item')));
    await insert('catalog_items', itemRow(uid('item')));
  });

  it('정의되지 않은 kind·게시 상태·분야 값은 거부한다', async () => {
    await expect(insert('catalog_items', itemRow(uid('item'), { kind: 'AD' }))).rejects.toThrow(
      CHECK,
    );
    await expect(
      insert('catalog_items', itemRow(uid('item'), { publication_status: 'DRAFT' })),
    ).rejects.toThrow(CHECK);
    await expect(
      insert('catalog_items', itemRow(uid('item'), { service_category: 'GAME' })),
    ).rejects.toThrow(CHECK);
  });
});

describe('ID 계정·카카오 토큰·세션 [D-16][T03]', () => {
  it('kakao_id는 유일하다', async () => {
    const id = uid('user');
    await insert('users', userRow(id, { kakao_id: 'dup-kakao-id' }));

    await expect(
      insert('users', userRow(uid('user'), { kakao_id: 'dup-kakao-id' })),
    ).rejects.toThrow(UNIQUE);
  });

  it('role은 USER·OPERATOR·ADMIN만 허용한다', async () => {
    await expect(insert('users', userRow(uid('user'), { role: 'ROOT' }))).rejects.toThrow(CHECK);
  });

  it('사용자를 지우면 세션과 카카오 토큰이 함께 지워진다', async () => {
    const userId = uid('user');
    await insert('users', userRow(userId));
    await insert('sessions', {
      token_hash: uid('hash'),
      user_id: userId,
      expires_at: '2026-11-28T00:00:00.000Z',
      created_at: NOW,
    });
    await insert('kakao_message_tokens', {
      user_id: userId,
      refresh_token_encrypted: 'cipher',
      refresh_token_expires_at: '2026-12-28T00:00:00.000Z',
      scopes: '["talk_message"]',
      updated_at: NOW,
    });

    await env.DB.prepare('DELETE FROM users WHERE id = ?').bind(userId).run();

    const sessions = await env.DB.prepare('SELECT COUNT(*) AS c FROM sessions WHERE user_id = ?')
      .bind(userId)
      .first<{ c: number }>();
    const tokens = await env.DB.prepare(
      'SELECT COUNT(*) AS c FROM kakao_message_tokens WHERE user_id = ?',
    )
      .bind(userId)
      .first<{ c: number }>();
    expect(sessions?.c).toBe(0);
    expect(tokens?.c).toBe(0);
  });
});
