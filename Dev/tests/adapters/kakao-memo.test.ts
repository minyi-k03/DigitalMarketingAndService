import { describe, expect, it } from 'vitest';
import { KakaoMemoNotificationSender } from '../../src/worker/adapters/kakao-memo';
import {
  templateKeyFor,
  type NotificationTemplate,
} from '../../src/worker/modules/trial-tracking/domain/notification-planner';
import {
  RecipientUnavailableError,
  type OutgoingNotification,
} from '../../src/worker/ports/notification-sender';

interface Captured {
  url: string;
  method: string;
  authorization: string | null;
  contentType: string | null;
  form: URLSearchParams;
}

/** fetch를 모의한다 (V-10: 외부 HTTP 어댑터 단위 테스트만 허용되는 예외) */
function mockFetch(respond: (req: Captured) => Response | Promise<Response>) {
  const calls: Captured[] = [];
  const fetchImpl = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const req: Captured = {
      url: String(input),
      method: init?.method ?? 'GET',
      authorization: new Headers(init?.headers).get('Authorization'),
      contentType: new Headers(init?.headers).get('Content-Type'),
      form: new URLSearchParams(typeof init?.body === 'string' ? init.body : ''),
    };
    calls.push(req);
    return respond(req);
  }) as typeof fetch;
  return { fetchImpl, calls };
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

const ORIGIN = 'https://subcut.test';
const recipient = { channel: 'KAKAO_MEMO', accessToken: 'secret-access-token' } as const;

const base: OutgoingNotification = {
  kind: 'ESCAPE_ALERT',
  slot: 'D3',
  variant: 'REGULAR',
  templateKey: 'ESCAPE_ALERT.REGULAR.RETAIN_UNTIL_END',
  catalogItemName: '시연용 OTT',
  link: '/bridge/trial-1',
};

function build(
  respond: (req: Captured) => Response | Promise<Response> = () => json({ result_code: 0 }),
) {
  const { fetchImpl, calls } = mockFetch(respond);
  const sender = new KakaoMemoNotificationSender({ appOrigin: ORIGIN, fetch: fetchImpl });
  return { sender, calls };
}

function templateOf(call: Captured) {
  return JSON.parse(call.form.get('template_object') ?? '{}') as {
    object_type: string;
    text: string;
    link: { web_url: string; mobile_web_url: string };
    button_title: string;
  };
}

describe('kakao-memo 알림 어댑터: 요청 형식 [S13][V-10][T34]', () => {
  it("'나에게 보내기' 기본 템플릿 API에 access token과 text 템플릿을 form으로 보낸다", async () => {
    const { sender, calls } = build();

    await sender.send({ recipient, notification: base });

    expect(calls).toHaveLength(1);
    const [call] = calls;
    expect(call!.url).toBe('https://kapi.kakao.com/v2/api/talk/memo/default/send');
    expect(call!.method).toBe('POST');
    expect(call!.authorization).toBe('Bearer secret-access-token');
    expect(call!.contentType).toBe('application/x-www-form-urlencoded;charset=utf-8');
    const template = templateOf(call!);
    expect(template.object_type).toBe('text');
    expect(template.text).toContain('시연용 OTT');
  });

  it('링크 버튼은 앱 주소에 기록 ID만 담은 내부 경로를 붙인다 (ADR-0001)', async () => {
    const { sender, calls } = build();

    await sender.send({ recipient, notification: base });
    await sender.send({
      recipient,
      notification: { ...base, kind: 'BILLING_CHECK', link: '/trials/trial-9' },
    });

    expect(templateOf(calls[0]!).link).toEqual({
      web_url: 'https://subcut.test/bridge/trial-1',
      mobile_web_url: 'https://subcut.test/bridge/trial-1',
    });
    expect(templateOf(calls[1]!).link.web_url).toBe('https://subcut.test/trials/trial-9');
  });
});

describe('kakao-memo 알림 어댑터: 실패 [S13][V-10][T34]', () => {
  it('카카오가 오류 상태를 돌려주면 던진다 (디스패처가 재시도·FAILED를 정한다)', async () => {
    const { sender } = build(() => json({ msg: 'insufficient scopes', code: -402 }, 403));

    await expect(sender.send({ recipient, notification: base })).rejects.toThrow();
  });

  it('오류 메시지에는 상태 코드와 카카오 오류 코드만 담고 토큰·응답 본문은 담지 않는다 (AGENTS §6)', async () => {
    const { sender } = build(() =>
      json({ msg: 'token secret-access-token is invalid', code: -401 }, 401),
    );

    const error = await sender.send({ recipient, notification: base }).catch((e: unknown) => e);

    expect(error).toBeInstanceOf(Error);
    const message = (error as Error).message;
    expect(message).toContain('401');
    expect(message).toContain('-401');
    expect(message).not.toContain('secret-access-token');
    expect(message).not.toContain('invalid');
  });

  it('동의 항목 미동의(code -402)는 수신처를 쓸 수 없는 오류로 던진다 (재시도해도 회복되지 않는다)', async () => {
    const { sender } = build(() => json({ msg: 'insufficient scopes', code: -402 }, 403));

    const error = await sender.send({ recipient, notification: base }).catch((e: unknown) => e);

    expect(error).toBeInstanceOf(RecipientUnavailableError);
    expect((error as Error).message).not.toContain('insufficient');
  });

  it('그 밖의 오류 코드(-401 토큰 무효, 5xx)는 수신처 문제로 단정하지 않는다', async () => {
    for (const res of [json({ code: -401 }, 401), json({ code: -500 }, 500)]) {
      const { sender } = build(() => res);

      const error = await sender.send({ recipient, notification: base }).catch((e: unknown) => e);

      expect(error).toBeInstanceOf(Error);
      expect(error).not.toBeInstanceOf(RecipientUnavailableError);
    }
  });

  it('200이어도 result_code가 0이 아니면 보내지 못한 것으로 보고 던진다', async () => {
    const { sender } = build(() => json({ result_code: -1 }));

    await expect(sender.send({ recipient, notification: base })).rejects.toThrow('result_code');
  });

  it('200 응답의 본문이 비었거나 JSON이 아니면 성공으로 본다 (다시 보내 중복 발송하지 않는다)', async () => {
    for (const res of [new Response(null, { status: 200 }), new Response('ok', { status: 200 })]) {
      const { sender } = build(() => res);

      await expect(sender.send({ recipient, notification: base })).resolves.toBeUndefined();
    }
  });

  it('성공 응답의 본문도 읽어 연결을 놓아 준다 (Workers 연결 점유 방지)', async () => {
    const res = json({ result_code: 0 });
    const { sender } = build(() => res);

    await sender.send({ recipient, notification: base });

    expect(res.bodyUsed).toBe(true);
  });

  it('오류 본문이 JSON이 아니어도 상태 코드로 던진다', async () => {
    const { sender } = build(() => new Response('<html>bad gateway</html>', { status: 502 }));

    await expect(sender.send({ recipient, notification: base })).rejects.toThrow('502');
  });

  it('네트워크 오류는 그대로 던진다', async () => {
    const { sender } = build(() => {
      throw new TypeError('network down');
    });

    await expect(sender.send({ recipient, notification: base })).rejects.toThrow('network down');
  });

  it('알림톡 수신처가 오면 보내지 않고 던진다 (어댑터와 수신 채널이 어긋난 조립 오류)', async () => {
    const { sender, calls } = build();

    await expect(
      sender.send({
        recipient: { channel: 'ALIMTALK', phoneNumber: '01012345678' },
        notification: base,
      }),
    ).rejects.toThrow();
    expect(calls).toHaveLength(0);
  });

  it('문구가 없는 템플릿 키는 빈 메시지를 보내지 않고 던진다', async () => {
    const { sender, calls } = build();

    await expect(
      sender.send({ recipient, notification: { ...base, templateKey: 'UNKNOWN.REGULAR' } }),
    ).rejects.toThrow('UNKNOWN.REGULAR');
    expect(calls).toHaveLength(0);
  });
});

describe('kakao-memo 알림 어댑터: 문구 [S6][S14][S15][T34]', () => {
  const policies = ['RETAIN_UNTIL_END', 'IMMEDIATE_TERMINATION'] as const;
  const templates: NotificationTemplate[] = [
    { kind: 'ESCAPE_ALERT', variant: 'REGULAR' },
    { kind: 'ESCAPE_ALERT', variant: 'LATE_BILLING_DAY' },
    { kind: 'ESCAPE_ALERT', variant: 'LATE_SAFE_END_DAY' },
    { kind: 'CANCEL_CONFIRM_CHECK', variant: 'REGULAR' },
    { kind: 'CANCEL_CONFIRM_CHECK', variant: 'SAME_DAY_DOMESTIC' },
    { kind: 'BILLING_CHECK', variant: 'REGULAR' },
  ];
  // Trial Tracking의 계획기가 만들 수 있는 모든 키 (architecture §5.5: 9종)
  const keys = [...new Set(templates.flatMap((t) => policies.map((p) => templateKeyFor(t, p))))];

  async function textFor(templateKey: string, catalogItemName = '시연용 OTT') {
    const { sender, calls } = build();
    await sender.send({ recipient, notification: { ...base, templateKey, catalogItemName } });
    return templateOf(calls[0]!).text;
  }

  it('계획기가 만드는 모든 템플릿 키에 문구가 있다', async () => {
    expect(keys).toHaveLength(9);
    for (const key of keys) {
      const text = await textFor(key);
      expect(text, key).toContain('시연용 OTT');
      expect(text.length, key).toBeLessThanOrEqual(200);
    }
  });

  it('ESCAPE_ALERT는 잔여 기간 유지 정책별로 안내가 다르다 (조기 해지 권장 / 백업 후 해지)', async () => {
    const retain = await textFor('ESCAPE_ALERT.REGULAR.RETAIN_UNTIL_END');
    const immediate = await textFor('ESCAPE_ALERT.REGULAR.IMMEDIATE_TERMINATION');

    expect(retain).toContain('체험 기간 끝까지 이용');
    expect(retain).not.toContain('백업');
    expect(immediate).toContain('백업');
    expect(immediate).toContain('결제 전날');
  });

  it('늦은 등록 경고: 결제 당일은 오늘 결제 경고, 즉시 종료형은 백업 후 바로 해지다', async () => {
    const day = await textFor('ESCAPE_ALERT.LATE_BILLING_DAY.RETAIN_UNTIL_END');
    const dayImmediate = await textFor('ESCAPE_ALERT.LATE_BILLING_DAY.IMMEDIATE_TERMINATION');
    const last = await textFor('ESCAPE_ALERT.LATE_SAFE_END_DAY.RETAIN_UNTIL_END');
    const lastImmediate = await textFor('ESCAPE_ALERT.LATE_SAFE_END_DAY.IMMEDIATE_TERMINATION');

    expect(day).toContain('오늘');
    expect(day).toContain('결제될 수 있어요');
    expect(dayImmediate).toContain('백업한 뒤 바로 해지');
    expect(last).toContain('마지막 날');
    expect(lastImmediate).toContain('백업한 뒤 바로 해지');
  });

  it('국내 항목의 당일 해지 확인 알림에는 이미 결제됐을 수 있다는 안내가 있다', async () => {
    const regular = await textFor('CANCEL_CONFIRM_CHECK.REGULAR');
    const sameDay = await textFor('CANCEL_CONFIRM_CHECK.SAME_DAY_DOMESTIC');

    expect(regular).toContain('해지를 마치셨나요?');
    expect(regular).not.toContain('이미 결제됐을 수 있어요');
    expect(sameDay).toContain('오늘이 결제 예정일이라 이미 결제됐을 수 있어요');
  });

  it('결제 확인 알림은 세 가지 정정 선택지(결제됨·결제 전 해지·계속 사용)를 안내한다', async () => {
    const text = await textFor('BILLING_CHECK.REGULAR');

    expect(text).toContain('결제됐는지');
    expect(text).toContain('결제 전에 해지했는지');
    expect(text).toContain('계속 쓰는지');
  });
});

describe('kakao-memo 알림 어댑터: 입력 보정 [T34]', () => {
  it('앱 주소 끝에 슬래시가 있어도 링크에 슬래시가 겹치지 않는다', async () => {
    const { fetchImpl, calls } = mockFetch(() => json({ result_code: 0 }));
    const sender = new KakaoMemoNotificationSender({
      appOrigin: 'https://subcut.test/',
      fetch: fetchImpl,
    });

    await sender.send({ recipient, notification: base });

    expect(templateOf(calls[0]!).link.web_url).toBe('https://subcut.test/bridge/trial-1');
  });

  it('유효한 origin이 아닌 앱 주소로는 만들 수 없다', () => {
    for (const appOrigin of [
      '',
      '/',
      '   ',
      'subcut.workers.dev',
      'http://subcut.test',
      'ftp://x.test',
    ]) {
      expect(() => new KakaoMemoNotificationSender({ appOrigin }), appOrigin).toThrow();
    }
  });

  it('항목 이름이 길어도 문구는 카카오 text 한도(200자)를 넘지 않고 이름만 말줄임한다', async () => {
    const longName = '가'.repeat(300);
    const { sender, calls } = build();

    await sender.send({
      recipient,
      notification: {
        ...base,
        templateKey: 'ESCAPE_ALERT.REGULAR.IMMEDIATE_TERMINATION',
        catalogItemName: longName,
      },
    });

    const { text } = templateOf(calls[0]!);
    expect(text.length).toBe(200);
    expect(text).toContain('가가가…');
    expect(text.startsWith('[구독컷] 가')).toBe(true);
    expect(text.endsWith('결제 전날까지 해지하세요.')).toBe(true);
  });

  it('한도 안의 이름은 그대로 쓴다', async () => {
    const { sender, calls } = build();

    await sender.send({ recipient, notification: { ...base, catalogItemName: '가'.repeat(60) } });

    expect(templateOf(calls[0]!).text).toContain('가'.repeat(60));
    expect(templateOf(calls[0]!).text).not.toContain('…');
  });
});
