import type { components } from '../../shared/api-types';

type EscapePattern = components['schemas']['EscapePattern'];
type ForcedChannel = components['schemas']['ForcedChannel'];

/** 브릿지 조회(`BridgeView`)와 사유 선택 결과(`StartCancelAttemptResult`)가 함께 가진 필드 */
export type EscapeTarget = {
  escapeLink: string;
  escapeLinkFallbackUrl?: string;
  escapePattern: EscapePattern;
  forcedChannel?: ForcedChannel;
};

/**
 * `open`은 주소로 이동한다. `fallbackUrl`이 있으면 앱이 열리지 않은 경우에만 그 주소로 이동한다.
 * `copy`는 이동하지 않고 'PC에서 열어 주세요' 안내와 링크 복사를 보여 준다.
 */
export type EscapePlan =
  { kind: 'open'; url: string; fallbackUrl?: string } | { kind: 'copy'; url: string };

/** PC 웹에서만 해지되는 항목을 모바일에서 열었는가. 이때는 이동 대신 링크 복사를 안내한다 (SPEC §7) */
export function needsPcHandoff(
  target: Pick<EscapeTarget, 'escapePattern' | 'forcedChannel'>,
  device: { mobile: boolean },
): boolean {
  return (
    target.escapePattern === 'PC_OR_APP_FORCED' &&
    target.forcedChannel === 'PC_WEB' &&
    device.mobile
  );
}

/** SPEC §7 `EscapePattern`별 동작. 가이드 고정 표시는 화면 배치(`bridgeSections`)가 맡는다 */
export function planEscape(target: EscapeTarget, device: { mobile: boolean }): EscapePlan {
  if (needsPcHandoff(target, device)) return { kind: 'copy', url: target.escapeLink };
  // https 직링크는 브라우저(유니버설 링크)가 처리하므로 앱이 없을 때의 대체 이동은 커스텀 스킴에만 쓴다
  if (
    target.escapePattern === 'PC_OR_APP_FORCED' &&
    target.forcedChannel === 'APP' &&
    target.escapeLinkFallbackUrl !== undefined &&
    !/^https:/i.test(target.escapeLink)
  ) {
    return { kind: 'open', url: target.escapeLink, fallbackUrl: target.escapeLinkFallbackUrl };
  }
  return { kind: 'open', url: target.escapeLink };
}

/**
 * 모바일 브라우저인가. iPadOS는 Macintosh로 보이므로 터치 지점이 있을 때만 모바일로 본다.
 * Windows 터치 노트북은 `Windows`라서 데스크톱이다.
 */
export function isMobileDevice(env: { userAgent: string; maxTouchPoints: number }): boolean {
  if (/Android|iPhone|iPad|iPod|Mobile/i.test(env.userAgent)) return true;
  return /Macintosh/.test(env.userAgent) && env.maxTouchPoints > 1;
}
