import type { components } from '../../shared/api-types';

export type UpdateBody = components['schemas']['UpdateTrialRecordRequest'];

export type UpdateRequestResult =
  { ok: true; body: UpdateBody } | { ok: false; reason: 'UNCHANGED' | 'TRIAL_DAYS_INVALID' };

// 자릿수는 제한하지 않고 값의 범위로만 거른다(앞자리 0은 숫자 값으로 읽는다: '0365' = 365)
const TRIAL_DAYS_PATTERN = /^\d+$/;

/**
 * 기록 수정 본문(`PATCH /api/trials/{id}`)을 만든다. 바뀐 필드만 보낸다.
 * 서버는 빈 본문을 거부하므로 바뀐 것이 없으면 요청을 만들지 않는다 (SPEC §5, 스토리 42).
 */
export function buildUpdateRequest(
  record: { startDate: string; trialDays: number },
  input: { startDate: string; trialDays: string },
): UpdateRequestResult {
  const rawDays = input.trialDays.trim();
  if (!TRIAL_DAYS_PATTERN.test(rawDays)) return { ok: false, reason: 'TRIAL_DAYS_INVALID' };
  const trialDays = Number(rawDays);
  if (trialDays < 1 || trialDays > 365) return { ok: false, reason: 'TRIAL_DAYS_INVALID' };

  const body: UpdateBody = {
    ...(input.startDate !== record.startDate && { startDate: input.startDate }),
    ...(trialDays !== record.trialDays && { trialDays }),
  };
  if (Object.keys(body).length === 0) return { ok: false, reason: 'UNCHANGED' };
  return { ok: true, body };
}
