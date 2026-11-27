import type { components } from '../../../../shared/api-types';
import type { KstDate } from '../../../../shared/kst-date';

type TrialStatus = components['schemas']['TrialStatus'];
type SupportContact = components['schemas']['SupportContact'];
type RefundTemplate = components['schemas']['RefundTemplate'];

/** 환불 요청 템플릿을 제공하는 상태 (SPEC §9). 그 밖의 상태는 제공하지 않는다 */
export function isRefundTemplateAvailable(status: TrialStatus): boolean {
  return status === 'MISSED_BILLED' || status === 'BILLED_CONFIRMED';
}

export interface RefundTemplateInput {
  name: string;
  startDate: KstDate;
  supportContact: SupportContact;
  /** 공식 결제 예정일. 본문 결제일 빈칸에는 넣지 않고 참고 정보로만 내린다 (SPEC §9, ADR-0002) */
  referenceBillingDate: KstDate;
}

// 실제 결제일·결제 금액·이름은 사용자가 직접 채우는 빈칸이다
const BLANK = '[    ]';

interface ContactLabels {
  email: string;
  page: string;
}

/** 이메일과 문의 페이지 URL 중 있는 것만 라벨을 달아 한 줄씩 낸다 (SPEC §2 "하나 이상") */
function contactLines(contact: SupportContact, labels: ContactLabels): string[] {
  const { email, url } = contact;
  return [
    ...(email !== undefined && email !== '' ? [`${labels.email} ${email}`] : []),
    ...(url !== undefined && url !== '' ? [`${labels.page} ${url}`] : []),
  ];
}

/**
 * 국문·영문 환불 요청 템플릿 (SPEC §9, 스토리 32). 서비스명·체험 시작일·고객센터를 채우고
 * 실제 결제일·결제 금액·이름은 빈칸으로 둔다. 복사 가능한 텍스트일 뿐 발송을 대행하지 않는다.
 */
export function buildRefundTemplate(input: RefundTemplateInput): RefundTemplate {
  const { name, startDate, supportContact, referenceBillingDate } = input;
  const ko = [
    `${name} 고객센터 담당자님께`,
    '',
    `${startDate}에 ${name} 무료체험을 시작했고, 이후 결제가 이루어진 것을 확인했습니다.`,
    '아래 내용을 확인해 주시고, 청약철회 및 결제 금액 환불을 요청드립니다.',
    '',
    `- 서비스명: ${name}`,
    `- 체험 시작일: ${startDate}`,
    `- 실제 결제일: ${BLANK}`,
    `- 결제 금액: ${BLANK}`,
    `- 신청자 이름: ${BLANK}`,
    '',
    ...contactLines(supportContact, { email: '고객센터 이메일:', page: '고객센터 문의 페이지:' }),
    '',
    '확인 후 처리 결과를 회신해 주시기 바랍니다. 감사합니다.',
  ].join('\n');
  const en = [
    `To the ${name} Support Team,`,
    '',
    `I started a free trial of ${name} on ${startDate} and have since been charged for the subscription.`,
    'Please review the details below and process a withdrawal of the subscription and a refund of the charged amount.',
    '',
    `- Service: ${name}`,
    `- Trial start date: ${startDate}`,
    `- Actual charge date: ${BLANK}`,
    `- Amount charged: ${BLANK}`,
    `- Name: ${BLANK}`,
    '',
    ...contactLines(supportContact, { email: 'Support email:', page: 'Support page:' }),
    '',
    'Please reply with the result. Thank you.',
  ].join('\n');
  return { ko, en, referenceBillingDate };
}
