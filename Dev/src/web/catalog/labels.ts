import type { components } from '../../shared/api-types';
import type { ServiceCategory } from './filter';

type PublicView = components['schemas']['CatalogItemPublicView'];

const CATEGORY_LABELS: Record<ServiceCategory, string> = {
  BIGTECH: '빅테크',
  AI: 'AI',
  DELIVERY: '배달',
  OTT: 'OTT',
  CLOUD: '클라우드',
  LEARNING: '학습',
  ETC: '기타',
};

export function categoryLabel(category: ServiceCategory): string {
  return CATEGORY_LABELS[category];
}

export type Tone = 'good' | 'warn' | 'bad';

const DIFFICULTY: Record<PublicView['darkPatternLevel'], { text: string; tone: Tone }> = {
  HIGH: { text: '상', tone: 'bad' },
  MEDIUM: { text: '중', tone: 'warn' },
  LOW: { text: '하', tone: 'good' },
};

/** 해지 난이도. 색뿐 아니라 글자(상·중·하)로도 구분한다 */
export function difficultyLabel(level: PublicView['darkPatternLevel']) {
  return DIFFICULTY[level];
}

const RETENTION: Record<
  PublicView['accessRetentionPolicy'],
  { short: string; headline: string; advice: string }
> = {
  RETAIN_UNTIL_END: {
    short: '해지해도 만료일까지 이용',
    headline: '만료일까지 계속 쓸 수 있어요',
    advice: '일찍 해지해도 손해가 없어요.',
  },
  IMMEDIATE_TERMINATION: {
    short: '해지하면 바로 이용 종료',
    headline: '해지하는 즉시 이용이 끝나요',
    advice: '백업을 먼저 하고 안전 만료일에 맞춰 해지하세요.',
  },
};

export function retentionText(policy: PublicView['accessRetentionPolicy']) {
  return RETENTION[policy];
}

/** 해지 방식 안내. `PC_OR_APP_FORCED`는 `forcedChannel`로 앱·PC 웹을 가른다 (D-15) */
export function escapePatternText(
  item: Pick<PublicView, 'escapePattern' | 'forcedChannel'>,
): string {
  if (item.escapePattern === 'DIRECT_LINK') return '계정 설정에서 바로 해지할 수 있어요';
  if (item.escapePattern === 'SPA_MODAL_GUIDE') {
    return '메뉴 안쪽 팝업을 거쳐야 해요. 가이드를 따라 하세요';
  }
  return item.forcedChannel === 'APP'
    ? '전용 앱에서만 해지할 수 있어요'
    : 'PC 웹에서만 해지할 수 있어요';
}

/** 새 체험 기록을 만들 수 있는 항목인가. 게시 중단 항목은 어느 경로로도 불가하다 (D-13, V-08) */
export function canStartTracking(item: Pick<PublicView, 'publicationStatus'>): boolean {
  return item.publicationStatus === 'PUBLISHED';
}
