import type { components } from '../../../../shared/api-types';

export type DarkPatternScores = components['schemas']['DarkPatternScores'];
export type DarkPatternLevel = components['schemas']['DarkPatternLevel'];

/** 등급 경계값. `app_settings`의 `catalog.darkPatternRubric`과 같은 모양이다 (SPEC §2) */
export interface DarkPatternRubric {
  /** 합산 점수가 이 값 이상이면 MEDIUM */
  mediumMin: number;
  /** 합산 점수가 이 값 이상이면 HIGH */
  highMin: number;
}

/** 세 항목 원점수를 합산해 등급을 정한다. 경계값은 호출자가 주입한다 (SPEC §2 기준표) */
export function computeDarkPatternLevel(
  scores: DarkPatternScores,
  rubric: DarkPatternRubric,
): DarkPatternLevel {
  const total = scores.menuDepth + scores.persuasionPopups + scores.forcedPcOrApp;
  if (total >= rubric.highMin) return 'HIGH';
  if (total >= rubric.mediumMin) return 'MEDIUM';
  return 'LOW';
}
