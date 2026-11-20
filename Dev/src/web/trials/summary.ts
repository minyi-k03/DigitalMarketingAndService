import type { components } from '../../shared/api-types';
import { won } from '../ui/money';

type TrialRecordView = components['schemas']['TrialRecordView'];

/** 카드에 한 줄로 보여 줄 날짜·금액 안내 (SPEC §13) */
export function summaryLine(
  record: Pick<
    TrialRecordView,
    'status' | 'startDate' | 'billingDate' | 'safeEndDate' | 'savedAmount'
  >,
): string {
  switch (record.status) {
    case 'TRACKING':
    case 'CANCEL_ATTEMPTED':
      return `안전 만료일 ${record.safeEndDate}`;
    case 'MISSED_BILLED':
      return `결제 예정일(${record.billingDate})이 지났어요. 실제로 어떻게 됐는지 알려 주세요.`;
    case 'CANCELED_CONFIRMED':
      // 0원 항목도 기한 안에 확정하면 0이 저장된다(monthlyPrice ≥ 0, SPEC §8). 없음(null)과 구분한다
      return record.savedAmount === null
        ? '안전 만료일 뒤에 해지를 확정했어요'
        : `${won(record.savedAmount)}을 지켰어요`;
    default:
      return `시작일 ${record.startDate}`;
  }
}
