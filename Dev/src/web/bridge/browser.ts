import { isMobileDevice, type EscapePlan } from './escape-plan';

/** 앱 딥링크가 열리면 이 시간 안에 화면이 가려진다(`visibilitychange`). 가려지지 않으면 앱이 없는 것으로 보고 대체 주소로 보낸다 */
const APP_OPEN_WAIT_MS = 1500;

export function currentDevice() {
  return {
    mobile: isMobileDevice({
      userAgent: navigator.userAgent,
      maxTouchPoints: navigator.maxTouchPoints,
    }),
  };
}

/** 대기 중인 앱 미설치 대체 이동. 한 번에 하나만 둔다 */
let cancelPending: (() => void) | null = null;

/**
 * 대기 중인 대체 이동을 취소한다. 새 이동을 시작할 때와 브릿지 화면을 떠날 때 부른다.
 * 앱 내 `<Link>` 이동은 `pagehide`·`visibilitychange`를 일으키지 않아 타이머가 남기 때문이다.
 */
export function cancelFallbackRedirect() {
  cancelPending?.();
}

export function openEscape(plan: Extract<EscapePlan, { kind: 'open' }>) {
  cancelFallbackRedirect();
  window.location.assign(plan.url);
  if (plan.fallbackUrl === undefined) return;
  const fallback: string = plan.fallbackUrl;

  const stop = () => {
    window.clearTimeout(timer);
    document.removeEventListener('visibilitychange', stop);
    window.removeEventListener('pagehide', stop);
    if (cancelPending === stop) cancelPending = null;
  };
  const timer = window.setTimeout(() => {
    stop();
    window.location.assign(fallback);
  }, APP_OPEN_WAIT_MS);
  // 앱이 열려 화면이 가려지면 대체 이동을 취소한다. 앱에서 돌아온 뒤 늦게 실행돼 설치 페이지로 보내면 안 된다
  document.addEventListener('visibilitychange', stop);
  window.addEventListener('pagehide', stop);
  cancelPending = stop;
}
