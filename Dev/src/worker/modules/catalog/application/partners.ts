import type { components } from '../../../../shared/api-types';
import { toUtcInstant } from '../../../../shared/kst-date';
import { DomainError } from '../../../platform/errors';
import { newId } from '../../../platform/id';
import type { CatalogDeps } from '../deps';
import {
  insertPartner,
  listPartners as listPartnerRows,
  type Partner,
} from '../infra/catalog-repo';

type PartnerInput = components['schemas']['PartnerInput'];

// 형식만 보는 느슨한 검사다. 실제 수신 여부는 확인하지 않는다
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** 파트너 최소 등록(발표용 D-17). 회사명·담당자 이메일만 받고, 어긋나면 VALIDATION_FAILED를 던진다 */
export async function createPartner(deps: CatalogDeps, input: PartnerInput): Promise<Partner> {
  const companyName = input.companyName.trim();
  const contactEmail = input.contactEmail.trim();

  const errors: { field: string; message: string }[] = [];
  if (companyName === '') errors.push({ field: 'companyName', message: '회사명을 입력해 주세요' });
  if (!EMAIL_PATTERN.test(contactEmail)) {
    errors.push({ field: 'contactEmail', message: '이메일 형식이 올바르지 않습니다' });
  }
  if (errors.length > 0) {
    throw new DomainError('VALIDATION_FAILED', '파트너 정보가 올바르지 않습니다', { errors });
  }

  const partner: Partner = {
    id: newId(),
    companyName,
    contactEmail,
    createdAt: toUtcInstant(deps.clock.now()),
  };
  await insertPartner(deps.db, partner);
  return partner;
}

export async function listPartners(deps: CatalogDeps): Promise<Partner[]> {
  return listPartnerRows(deps.db);
}
