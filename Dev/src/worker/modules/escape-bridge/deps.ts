import type { Clock } from '../../platform/clock';
import type { CatalogService } from '../catalog';
import type { TrialTrackingService } from '../trial-tracking';

export interface EscapeBridgeDeps {
  /** 자기 소유 테이블(`broken_link_reports`)만 읽고 쓴다 (architecture §2) */
  db: D1Database;
  /** 제보 시각·24시간 중복 판정 기준. `Date.now()`는 쓰지 않는다 */
  clock: Clock;
  /** 기록 상태는 Trial Tracking의 공개 조회(`getBridgeState`)로만 읽고, 사유 선택의 전이는 공개 명령(`startCancelAttempt`)에 맡긴다 (architecture §3.2) */
  trialTracking: Pick<TrialTrackingService, 'getBridgeState' | 'startCancelAttempt'>;
  /** 해지 안내 내용(직링크 포함)은 카탈로그의 공개 조회로만 읽는다. 로고는 `getTrackingTerms`가 준다 */
  catalog: Pick<CatalogService, 'getEscapeContent' | 'getTrackingTerms'>;
}
