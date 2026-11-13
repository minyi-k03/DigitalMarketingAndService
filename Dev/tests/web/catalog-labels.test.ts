import { describe, expect, it } from 'vitest';
import {
  canStartTracking,
  categoryLabel,
  difficultyLabel,
  escapePatternText,
  retentionText,
} from '../../src/web/catalog/labels';

describe('카탈로그 표시 문구 [T26][S4][S6]', () => {
  it('다크패턴 난이도는 상·중·하로 보이고 색에만 의존하지 않는다 (S4)', () => {
    expect(difficultyLabel('HIGH')).toEqual({ text: '상', tone: 'bad' });
    expect(difficultyLabel('MEDIUM')).toEqual({ text: '중', tone: 'warn' });
    expect(difficultyLabel('LOW')).toEqual({ text: '하', tone: 'good' });
  });

  it('분야 7개 모두 한국어 이름이 있다 (S2)', () => {
    expect(
      (['BIGTECH', 'AI', 'DELIVERY', 'OTT', 'CLOUD', 'LEARNING', 'ETC'] as const).map(
        categoryLabel,
      ),
    ).toEqual(['빅테크', 'AI', '배달', 'OTT', '클라우드', '학습', '기타']);
  });

  it('잔여 기간 유지 정책마다 목록용 한 줄과 상세용 안내가 다르다 (S6)', () => {
    expect(retentionText('RETAIN_UNTIL_END')).toEqual({
      short: '해지해도 만료일까지 이용',
      headline: '만료일까지 계속 쓸 수 있어요',
      advice: '일찍 해지해도 손해가 없어요.',
    });
    expect(retentionText('IMMEDIATE_TERMINATION')).toEqual({
      short: '해지하면 바로 이용 종료',
      headline: '해지하는 즉시 이용이 끝나요',
      advice: '백업을 먼저 하고 안전 만료일에 맞춰 해지하세요.',
    });
  });

  describe('해지 방식 안내 (D-15 forcedChannel 반영)', () => {
    it('DIRECT_LINK는 계정 설정에서 바로 해지한다고 안내한다', () => {
      expect(escapePatternText({ escapePattern: 'DIRECT_LINK' })).toBe(
        '계정 설정에서 바로 해지할 수 있어요',
      );
    });

    it('SPA_MODAL_GUIDE는 가이드를 따라 하라고 안내한다', () => {
      expect(escapePatternText({ escapePattern: 'SPA_MODAL_GUIDE' })).toBe(
        '메뉴 안쪽 팝업을 거쳐야 해요. 가이드를 따라 하세요',
      );
    });

    it('PC_OR_APP_FORCED는 forcedChannel에 따라 앱 또는 PC 웹으로 안내한다', () => {
      expect(escapePatternText({ escapePattern: 'PC_OR_APP_FORCED', forcedChannel: 'APP' })).toBe(
        '전용 앱에서만 해지할 수 있어요',
      );
      expect(
        escapePatternText({ escapePattern: 'PC_OR_APP_FORCED', forcedChannel: 'PC_WEB' }),
      ).toBe('PC 웹에서만 해지할 수 있어요');
    });
  });

  describe('등록 가능 여부 (D-13, V-08)', () => {
    it('게시 중인 항목만 새 추적을 시작할 수 있다', () => {
      expect(canStartTracking({ publicationStatus: 'PUBLISHED' })).toBe(true);
    });

    it('게시 중단 항목은 새 추적을 시작할 수 없다', () => {
      expect(canStartTracking({ publicationStatus: 'UNPUBLISHED' })).toBe(false);
    });
  });
});
