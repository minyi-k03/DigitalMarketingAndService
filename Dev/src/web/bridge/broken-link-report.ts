import type { components } from '../../shared/api-types';

export type BrokenLinkTarget = components['schemas']['BrokenLinkReport']['target'];
export type BrokenLinkReportReceipt = components['schemas']['BrokenLinkReportReceipt'];

export const BROKEN_LINK_TARGETS: readonly BrokenLinkTarget[] = ['ESCAPE_LINK', 'ESCAPE_GUIDE'];

const TARGET_LABELS: Record<BrokenLinkTarget, string> = {
  ESCAPE_LINK: '해지 링크가 안 열려요',
  ESCAPE_GUIDE: '해지 방법이 달라요',
};

export function reportButtonLabel(target: BrokenLinkTarget): string {
  return TARGET_LABELS[target];
}

/** 24시간 내 같은 사용자·항목·대상 제보는 서버가 duplicate=true로 알려 준다 (SPEC §10) */
export function describeBrokenLinkReportSuccess(
  target: BrokenLinkTarget,
  receipt: BrokenLinkReportReceipt,
): string {
  if (receipt.duplicate) {
    return '이미 최근 24시간 안에 같은 제보를 받았어요. 확인하고 있어요.';
  }
  return target === 'ESCAPE_LINK'
    ? '해지 링크 오류를 제보했어요. 확인 후 고칠게요.'
    : '해지 방법 오류를 제보했어요. 확인 후 고칠게요.';
}
