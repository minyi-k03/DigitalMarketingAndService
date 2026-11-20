import {
  RecipientUnavailableError,
  type NotificationSender,
  type OutgoingNotification,
} from '../ports/notification-sender';
import type { Recipient } from '../ports/recipient-resolver';

const MEMO_URL = 'https://kapi.kakao.com/v2/api/talk/memo/default/send';
const BUTTON_TITLE = '구독컷에서 확인하기';
/** 카카오 오류 코드: 동의하지 않은 동의 항목 (`talk_message`) */
const INSUFFICIENT_SCOPES = -402;

/**
 * 알림 문구 (architecture §5.5). 키는 `OutgoingNotification.templateKey`(`kind.variant[.retentionPolicy]`)다.
 * 알림톡과 같은 정보성 문구만 담고 `AlternativeMatch` 같은 추천·홍보 내용은 넣지 않는다 (SPEC FN §3).
 * 카카오 text 템플릿은 200자까지다.
 */
const MESSAGES: Record<string, (name: string) => string> = {
  'ESCAPE_ALERT.REGULAR.RETAIN_UNTIL_END': (name) =>
    `[구독컷] ${name} 무료체험이 곧 결제로 넘어가요. 지금 해지해도 체험 기간 끝까지 이용할 수 있으니 미리 해지하세요.`,
  'ESCAPE_ALERT.REGULAR.IMMEDIATE_TERMINATION': (name) =>
    `[구독컷] ${name} 무료체험이 곧 결제로 넘어가요. 해지하면 바로 이용이 끝나니 필요한 자료를 백업한 뒤 결제 전날까지 해지하세요.`,
  'ESCAPE_ALERT.LATE_BILLING_DAY.RETAIN_UNTIL_END': (name) =>
    `[구독컷] 오늘 ${name} 결제될 수 있어요. 지금 바로 해지하세요.`,
  'ESCAPE_ALERT.LATE_BILLING_DAY.IMMEDIATE_TERMINATION': (name) =>
    `[구독컷] 오늘 ${name} 결제될 수 있어요. 필요한 자료를 백업한 뒤 바로 해지하세요.`,
  'ESCAPE_ALERT.LATE_SAFE_END_DAY.RETAIN_UNTIL_END': (name) =>
    `[구독컷] 오늘이 ${name} 안전하게 해지할 수 있는 마지막 날이에요. 지금 해지하세요.`,
  'ESCAPE_ALERT.LATE_SAFE_END_DAY.IMMEDIATE_TERMINATION': (name) =>
    `[구독컷] 오늘이 ${name} 안전하게 해지할 수 있는 마지막 날이에요. 필요한 자료를 백업한 뒤 바로 해지하세요.`,
  'CANCEL_CONFIRM_CHECK.REGULAR': (name) =>
    `[구독컷] ${name} 해지를 마치셨나요? 확인하고 결과를 알려주세요.`,
  'CANCEL_CONFIRM_CHECK.SAME_DAY_DOMESTIC': (name) =>
    `[구독컷] ${name} 해지를 마치셨나요? 오늘이 결제 예정일이라 이미 결제됐을 수 있어요. 확인하고 결과를 알려주세요.`,
  'BILLING_CHECK.REGULAR': (name) =>
    `[구독컷] ${name} 결제 예정일이 지났어요. 결제됐는지, 결제 전에 해지했는지, 계속 쓰는지 구독컷에서 바로잡아 주세요.`,
};

/** 카카오 text 템플릿의 글자 수 한도 */
const MAX_TEXT_LENGTH = 200;

/**
 * 알림 링크의 도메인(origin)으로 쓸 수 있는 값인지 확인해 `https://host[:port]` 형태로 돌려준다. 끝 슬래시와
 * 경로는 버린다. `https:`만 허용하고, 로컬 개발의 `http://localhost`·`127.0.0.1`은 예외다. 쓸 수 없으면 `null`.
 */
export function parseAppOrigin(value: string): string | null {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return null;
  }
  const isLocal = url.hostname === 'localhost' || url.hostname === '127.0.0.1';
  const allowed = url.protocol === 'https:' || (url.protocol === 'http:' && isLocal);
  return allowed ? url.origin : null;
}

interface Options {
  /** 알림 링크의 도메인 (`https://…`). 카카오 앱의 Web 플랫폼 도메인에 등록돼 있어야 한다. `parseAppOrigin`으로 정규화한다 */
  appOrigin: string;
  fetch?: typeof fetch;
}

/**
 * `NOTIFICATION_MODE=kakao_memo` 어댑터 (D-16, 발표용). 수신자 본인의 '나와의 채팅'으로 text 템플릿과
 * 링크 버튼을 보낸다. 실패하면 던지고 재시도는 디스패처가 맡는다(SPEC §17).
 * 던지는 오류에는 상태 코드와 카카오 오류 코드만 담는다. 요청·응답 본문에 토큰이 있을 수 있다 (AGENTS §6).
 */
export class KakaoMemoNotificationSender implements NotificationSender {
  private readonly appOrigin: string;
  private readonly fetchImpl: typeof fetch;

  constructor({ appOrigin, fetch: fetchImpl }: Options) {
    const origin = parseAppOrigin(appOrigin);
    if (origin === null) throw new Error('kakao_memo 앱 주소가 올바른 origin이 아닙니다');
    this.appOrigin = origin;
    // 전역 fetch를 필드에 담아 this.fetchImpl()로 부르면 Workers에서 "Illegal invocation"이 난다
    this.fetchImpl = fetchImpl ?? ((input, init) => fetch(input, init));
  }

  async send({
    recipient,
    notification,
  }: {
    recipient: Recipient;
    notification: OutgoingNotification;
  }): Promise<void> {
    if (recipient.channel !== 'KAKAO_MEMO') {
      throw new Error(`kakao_memo 어댑터는 ${recipient.channel} 수신처를 처리하지 못합니다`);
    }
    const url = `${this.appOrigin}${notification.link}`;
    const template = {
      object_type: 'text',
      text: messageFor(notification),
      link: { web_url: url, mobile_web_url: url },
      button_title: BUTTON_TITLE,
    };
    const res = await this.fetchImpl(MEMO_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${recipient.accessToken}`,
        'Content-Type': 'application/x-www-form-urlencoded;charset=utf-8',
      },
      body: new URLSearchParams({ template_object: JSON.stringify(template) }).toString(),
    });
    if (!res.ok) {
      const code = await kakaoErrorCode(res);
      // 동의 항목 미동의: 카카오 쪽에서 동의를 철회한 사용자. 저장된 scopes에는 남아 있어 수신처 조회는 통과한다
      if (code === INSUFFICIENT_SCOPES) {
        throw new RecipientUnavailableError(`카카오 나에게 보내기 동의 없음: HTTP ${res.status}`);
      }
      throw new Error(
        `카카오 나에게 보내기 실패: HTTP ${res.status}${code === undefined ? '' : ` (code ${code})`}`,
      );
    }
    // 성공 응답은 `{"result_code":0}`다. 본문을 읽어 연결을 놓아 주고, 0이 아닌 값이 오면 실패로 본다.
    // 본문이 비었거나 JSON이 아니면 성공으로 본다(다시 보내면 중복 발송이 된다)
    const body = (await res.json().catch(() => null)) as { result_code?: unknown } | null;
    if (typeof body?.result_code === 'number' && body.result_code !== 0) {
      throw new Error(`카카오 나에게 보내기 실패: result_code ${body.result_code}`);
    }
  }
}

function messageFor(notification: OutgoingNotification): string {
  const build = MESSAGES[notification.templateKey];
  if (!build) throw new Error(`알림 문구가 없는 템플릿 키: ${notification.templateKey}`);
  return fitText(build, notification.catalogItemName);
}

/** 항목 이름이 길어 한도를 넘으면 이름만 말줄임(`…`)한다. 고정 문구는 줄이지 않는다 */
function fitText(build: (name: string) => string, name: string): string {
  const full = build(name);
  if (full.length <= MAX_TEXT_LENGTH) return full;
  const chars = Array.from(name);
  let keep = chars.length;
  while (keep > 1) {
    keep -= 1;
    const text = build(`${chars.slice(0, keep).join('')}…`);
    if (text.length <= MAX_TEXT_LENGTH) return text;
  }
  return build('…');
}

/** 카카오 오류 본문의 숫자 `code`만 꺼낸다. 본문이 JSON이 아니면 없다 */
async function kakaoErrorCode(res: Response): Promise<number | undefined> {
  const body = (await res.json().catch(() => null)) as { code?: unknown } | null;
  return typeof body?.code === 'number' ? body.code : undefined;
}
