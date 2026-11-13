import type { components } from '../../../../shared/api-types';
import { kstDateOf, type KstDate, type UtcInstant } from '../../../../shared/kst-date';

type TrialStatus = components['schemas']['TrialStatus'];

/**
 * CANCELED_CONFIRMED로 확정할 때 저장할 방어 금액 (SPEC §8, architecture §5.8).
 * TRACKING·CANCEL_ATTEMPTED에서 SafeEndDate 당일 23:59:59 KST까지 확정했을 때만 그 시점의 월 요금이고,
 * MISSED_BILLED에서 정정한 확정과 그 밖의 경우는 `null`이다.
 */
export function savedAmountOnConfirm(
  from: TrialStatus,
  safeEndDate: KstDate,
  confirmedAt: UtcInstant,
  monthlyPrice: number,
): number | null {
  const beforeBilling = from === 'TRACKING' || from === 'CANCEL_ATTEMPTED';
  return beforeBilling && kstDateOf(confirmedAt) <= safeEndDate ? monthlyPrice : null;
}
