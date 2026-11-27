import type { CatalogService } from '../catalog';
import type { TrialTrackingService } from '../trial-tracking';

export interface EscapeBridgeDeps {
  /** 기록 상태는 Trial Tracking의 공개 조회(`getBridgeState`)로만 읽고, 사유 선택의 전이는 공개 명령(`startCancelAttempt`)에 맡긴다 (architecture §3.2) */
  trialTracking: Pick<TrialTrackingService, 'getBridgeState' | 'startCancelAttempt'>;
  /** 해지 안내 내용(직링크 포함)은 카탈로그의 공개 조회로만 읽는다. 로고는 `getTrackingTerms`가 준다 */
  catalog: Pick<CatalogService, 'getEscapeContent' | 'getTrackingTerms'>;
}
