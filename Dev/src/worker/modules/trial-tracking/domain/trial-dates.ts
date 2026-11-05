import { addDays, type KstDate } from '../../../../shared/kst-date';

/** 공식 결제 예정일과 안전 만료일 (SPEC §4, architecture §5.1) */
export function computeTrialDates(startDate: KstDate, trialDays: number, bufferApplied: boolean) {
  const billingDate = addDays(startDate, trialDays);
  const safeEndDate = bufferApplied ? addDays(billingDate, -1) : billingDate;
  return { billingDate, safeEndDate };
}
