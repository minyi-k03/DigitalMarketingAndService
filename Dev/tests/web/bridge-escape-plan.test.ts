import { describe, expect, it } from 'vitest';
import { isMobileDevice, needsPcHandoff, planEscape } from '../../src/web/bridge/escape-plan';

const PC = { mobile: false };
const MOBILE = { mobile: true };

describe('PC 전용 항목 핸드오프 판단 [T28][S19]', () => {
  it('PC 웹 강제 항목을 모바일에서 열었을 때만 핸드오프가 필요하다', () => {
    const pcWeb = { escapePattern: 'PC_OR_APP_FORCED', forcedChannel: 'PC_WEB' } as const;
    expect(needsPcHandoff(pcWeb, MOBILE)).toBe(true);
    expect(needsPcHandoff(pcWeb, PC)).toBe(false);
  });

  it('전용 앱 강제·다른 해지 방식·채널 누락은 모바일이어도 핸드오프하지 않는다', () => {
    expect(
      needsPcHandoff({ escapePattern: 'PC_OR_APP_FORCED', forcedChannel: 'APP' }, MOBILE),
    ).toBe(false);
    expect(needsPcHandoff({ escapePattern: 'DIRECT_LINK' }, MOBILE)).toBe(false);
    expect(needsPcHandoff({ escapePattern: 'PC_OR_APP_FORCED' }, MOBILE)).toBe(false);
  });
});

describe('해지 링크 이동 방식의 경계 [T28][S19]', () => {
  it('강제 채널이 빠진 PC_OR_APP_FORCED는 대체 URL이 있어도 직링크로만 이동한다', () => {
    const target = {
      escapeLink: 'myapp://settings',
      escapeLinkFallbackUrl: 'https://example.com/get-app',
      escapePattern: 'PC_OR_APP_FORCED',
    } as const;
    expect(planEscape(target, MOBILE)).toEqual({ kind: 'open', url: 'myapp://settings' });
  });

  it('전용 앱 강제 항목은 PC에서 열어도 딥링크와 대체 URL을 함께 준다', () => {
    const target = {
      escapeLink: 'myapp://settings',
      escapeLinkFallbackUrl: 'https://example.com/get-app',
      escapePattern: 'PC_OR_APP_FORCED',
      forcedChannel: 'APP',
    } as const;
    expect(planEscape(target, PC)).toEqual({
      kind: 'open',
      url: 'myapp://settings',
      fallbackUrl: 'https://example.com/get-app',
    });
  });

  it('스킴은 대소문자를 가리지 않는다: HTTPS 직링크에는 대체 URL을 쓰지 않는다', () => {
    const target = {
      escapeLink: 'HTTPS://example.com/app-link',
      escapeLinkFallbackUrl: 'https://example.com/get-app',
      escapePattern: 'PC_OR_APP_FORCED',
      forcedChannel: 'APP',
    } as const;
    expect(planEscape(target, MOBILE)).toEqual({
      kind: 'open',
      url: 'HTTPS://example.com/app-link',
    });
  });
});

describe('해지 링크 이동 방식 [T28][S17][S18][S19]', () => {
  it('DIRECT_LINK는 기기와 상관없이 직링크로 바로 이동한다', () => {
    const target = {
      escapeLink: 'https://example.com/cancel',
      escapePattern: 'DIRECT_LINK',
    } as const;
    expect(planEscape(target, PC)).toEqual({ kind: 'open', url: 'https://example.com/cancel' });
    expect(planEscape(target, MOBILE)).toEqual({ kind: 'open', url: 'https://example.com/cancel' });
  });

  it('SPA_MODAL_GUIDE도 직링크로 이동한다 (가이드는 화면에 고정해 두는 것으로 처리)', () => {
    const target = {
      escapeLink: 'https://example.com/account',
      escapePattern: 'SPA_MODAL_GUIDE',
    } as const;
    expect(planEscape(target, MOBILE)).toEqual({
      kind: 'open',
      url: 'https://example.com/account',
    });
  });

  it('PC 웹 강제 항목은 PC에서 열면 바로 이동한다', () => {
    const target = {
      escapeLink: 'https://example.com/pc-cancel',
      escapePattern: 'PC_OR_APP_FORCED',
      forcedChannel: 'PC_WEB',
    } as const;
    expect(planEscape(target, PC)).toEqual({ kind: 'open', url: 'https://example.com/pc-cancel' });
  });

  it('PC 웹 강제 항목은 모바일에서 열면 이동하지 않고 링크 복사를 안내한다', () => {
    const target = {
      escapeLink: 'https://example.com/pc-cancel',
      escapePattern: 'PC_OR_APP_FORCED',
      forcedChannel: 'PC_WEB',
    } as const;
    expect(planEscape(target, MOBILE)).toEqual({
      kind: 'copy',
      url: 'https://example.com/pc-cancel',
    });
  });

  it('전용 앱 강제 항목은 앱 딥링크로 이동하고, 앱이 없을 때를 위해 대체 URL을 함께 준다', () => {
    const target = {
      escapeLink: 'myapp://settings/subscription',
      escapeLinkFallbackUrl: 'https://example.com/get-app',
      escapePattern: 'PC_OR_APP_FORCED',
      forcedChannel: 'APP',
    } as const;
    expect(planEscape(target, MOBILE)).toEqual({
      kind: 'open',
      url: 'myapp://settings/subscription',
      fallbackUrl: 'https://example.com/get-app',
    });
  });

  it('전용 앱 강제 항목의 직링크가 https이면 브라우저가 처리하므로 대체 URL을 쓰지 않는다', () => {
    const target = {
      escapeLink: 'https://example.com/app-link',
      escapeLinkFallbackUrl: 'https://example.com/get-app',
      escapePattern: 'PC_OR_APP_FORCED',
      forcedChannel: 'APP',
    } as const;
    expect(planEscape(target, MOBILE)).toEqual({
      kind: 'open',
      url: 'https://example.com/app-link',
    });
  });

  it('대체 URL이 없으면 딥링크만 열고 대체 이동은 만들지 않는다', () => {
    const target = {
      escapeLink: 'myapp://settings/subscription',
      escapePattern: 'PC_OR_APP_FORCED',
      forcedChannel: 'APP',
    } as const;
    expect(planEscape(target, MOBILE)).toEqual({
      kind: 'open',
      url: 'myapp://settings/subscription',
    });
  });

  it('앱 강제가 아닌 항목에 대체 URL이 와도 쓰지 않는다', () => {
    const target = {
      escapeLink: 'https://example.com/cancel',
      escapeLinkFallbackUrl: 'https://example.com/other',
      escapePattern: 'DIRECT_LINK',
    } as const;
    expect(planEscape(target, PC)).toEqual({ kind: 'open', url: 'https://example.com/cancel' });
  });
});

describe('모바일 기기 판별 [T28][S19]', () => {
  it('안드로이드·아이폰 브라우저는 모바일이다', () => {
    expect(
      isMobileDevice({
        userAgent:
          'Mozilla/5.0 (Linux; Android 14; SM-S918N) AppleWebKit/537.36 Chrome/120.0 Mobile Safari/537.36',
        maxTouchPoints: 5,
      }),
    ).toBe(true);
    expect(
      isMobileDevice({
        userAgent:
          'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148',
        maxTouchPoints: 5,
      }),
    ).toBe(true);
  });

  it('iPadOS는 Macintosh로 보이지만 터치가 있으면 모바일이다', () => {
    expect(
      isMobileDevice({
        userAgent:
          'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 Version/17.0 Safari/605.1.15',
        maxTouchPoints: 5,
      }),
    ).toBe(true);
  });

  it('Macintosh인데 터치 지점이 1개뿐이면 모바일이 아니다 (iPadOS는 2개 이상)', () => {
    const macUserAgent =
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 Version/17.0 Safari/605.1.15';
    expect(isMobileDevice({ userAgent: macUserAgent, maxTouchPoints: 1 })).toBe(false);
    expect(isMobileDevice({ userAgent: macUserAgent, maxTouchPoints: 2 })).toBe(true);
  });

  it('Windows·Mac 데스크톱 브라우저는 모바일이 아니다 (터치 노트북 포함)', () => {
    expect(
      isMobileDevice({
        userAgent:
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0 Safari/537.36',
        maxTouchPoints: 10,
      }),
    ).toBe(false);
    expect(
      isMobileDevice({
        userAgent:
          'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 Version/17.0 Safari/605.1.15',
        maxTouchPoints: 0,
      }),
    ).toBe(false);
  });
});
