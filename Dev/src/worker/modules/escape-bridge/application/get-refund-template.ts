import type { components } from '../../../../shared/api-types';
import { DomainError } from '../../../platform/errors';
import type { EscapeBridgeDeps } from '../deps';
import { buildRefundTemplate, isRefundTemplateAvailable } from '../domain/refund-template';

export type RefundTemplate = components['schemas']['RefundTemplate'];

export interface RefundTemplateQuery {
  userId: string;
  trialRecordId: string;
}

/**
 * 환불 요청 템플릿 (SPEC §9, 스토리 32). `MISSED_BILLED`·`BILLED_CONFIRMED` 기록에서만 주고
 * 그 밖의 상태는 `BRIDGE_NOT_AVAILABLE`(422)이다. 남의 기록은 TT가 `NOT_FOUND`로 거절한다.
 * 서비스명·고객센터는 조회 시점의 카탈로그 값을 쓴다 (SPEC §2).
 */
export async function getRefundTemplate(
  deps: EscapeBridgeDeps,
  query: RefundTemplateQuery,
): Promise<RefundTemplate> {
  const state = await deps.trialTracking.getBridgeState(query);
  if (!isRefundTemplateAvailable(state.status)) {
    throw new DomainError(
      'BRIDGE_NOT_AVAILABLE',
      '환불 요청 템플릿은 결제가 확인되었거나 결제 확인이 필요한 기록에서만 제공합니다',
    );
  }
  const content = await deps.catalog.getEscapeContent(state.catalogItemId);
  return buildRefundTemplate({
    name: content.name,
    startDate: state.startDate,
    supportContact: content.supportContact,
    referenceBillingDate: state.billingDate,
  });
}
