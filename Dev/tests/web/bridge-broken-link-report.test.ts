import { describe, expect, it } from 'vitest';
import {
  BROKEN_LINK_TARGETS,
  describeBrokenLinkReportSuccess,
  reportButtonLabel,
} from '../../src/web/bridge/broken-link-report';

describe('해지 브릿지 경로 오류 제보 대상과 안내 [T28][S34]', () => {
  it('링크와 가이드 두 제보 대상을 순서대로 제공한다', () => {
    expect(BROKEN_LINK_TARGETS).toEqual(['ESCAPE_LINK', 'ESCAPE_GUIDE']);
  });

  it('제보 대상별 버튼 라벨을 돌려준다', () => {
    expect(reportButtonLabel('ESCAPE_LINK')).toBe('해지 링크가 안 열려요');
    expect(reportButtonLabel('ESCAPE_GUIDE')).toBe('해지 방법이 달라요');
  });

  it('새 제보는 대상별 접수 안내를, 24시간 내 중복 제보는 확인 중 안내를 돌려준다', () => {
    expect(describeBrokenLinkReportSuccess('ESCAPE_LINK', { id: 'r-1', duplicate: false })).toBe(
      '해지 링크 오류를 제보했어요. 확인 후 고칠게요.',
    );
    expect(describeBrokenLinkReportSuccess('ESCAPE_GUIDE', { id: 'r-2', duplicate: false })).toBe(
      '해지 방법 오류를 제보했어요. 확인 후 고칠게요.',
    );
    expect(describeBrokenLinkReportSuccess('ESCAPE_LINK', { id: 'r-1', duplicate: true })).toBe(
      '이미 최근 24시간 안에 같은 제보를 받았어요. 확인하고 있어요.',
    );
  });
});
