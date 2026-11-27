import type { components } from '../../shared/api-types';
import type { FormErrors } from './item-form';

export type Partner = components['schemas']['Partner'];
type PartnerInput = components['schemas']['PartnerInput'];

export type PartnerForm = { companyName: string; contactEmail: string };

export const emptyPartnerForm = (): PartnerForm => ({ companyName: '', contactEmail: '' });

// 서버와 같은 느슨한 형식 검사다. 서버가 다시 검사한다
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export type PartnerRequest = { ok: true; body: PartnerInput } | { ok: false; errors: FormErrors };

/** 파트너 최소 등록 본문 (발표용 D-17: 회사명·담당자 이메일만) */
export function buildPartnerRequest(form: PartnerForm): PartnerRequest {
  const companyName = form.companyName.trim();
  const contactEmail = form.contactEmail.trim();
  const errors: FormErrors = {};
  if (companyName === '') errors.companyName = '회사명을 입력해 주세요.';
  if (!EMAIL_PATTERN.test(contactEmail)) errors.contactEmail = '이메일 형식을 확인해 주세요.';
  if (Object.keys(errors).length > 0) return { ok: false, errors };
  return { ok: true, body: { companyName, contactEmail } };
}
