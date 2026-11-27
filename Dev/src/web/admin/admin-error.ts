import type { ApiError } from '../api/response';
import { mapServerFieldErrors, type FormErrors } from './item-form';

export type AdminFailure = {
  title: string;
  detail: string;
  /** 서버가 칸별로 알려 준 입력 오류 */
  fieldErrors: FormErrors;
  /** 서버의 최신 상태와 어긋났다는 뜻이다. 화면은 목록·상세를 새로 불러온다 */
  stale: boolean;
};

/** 관리 API가 실패했을 때 화면에 보일 안내. 서버 내부 문구(`title`·`detail`)는 노출하지 않는다 */
export function describeAdminError(error: ApiError): AdminFailure {
  const base = { fieldErrors: {}, stale: false };
  switch (error.code) {
    case 'FORBIDDEN':
      return {
        ...base,
        title: '운영자 권한이 필요해요',
        detail: '권한이 있는 계정으로 로그인했는지 확인해 주세요.',
      };
    case 'INVALID_TRANSITION':
    case 'CONFLICT':
      return {
        ...base,
        stale: true,
        title: '이미 상태가 바뀐 항목이에요',
        detail: '다른 운영자가 먼저 처리했어요. 최신 상태를 다시 불러올게요.',
      };
    case 'VALIDATION_FAILED':
      return {
        ...base,
        fieldErrors: mapServerFieldErrors(error.errors),
        title: '입력을 확인해 주세요',
        detail: '표시된 칸을 고친 뒤 다시 저장해 주세요.',
      };
    case 'NOT_FOUND':
      return {
        ...base,
        title: '항목을 찾을 수 없어요',
        detail: '이미 삭제됐거나 주소가 바뀌었어요. 목록에서 다시 확인해 주세요.',
      };
    default:
      return { ...base, title: '처리하지 못했어요', detail: '잠시 뒤 다시 시도해 주세요.' };
  }
}

export type LoadFailure = { title: string; detail: string; retryable: boolean };

/**
 * 목록·상세를 불러오다 실패했을 때의 안내. 권한이 없으면(403, 로그인 뒤 역할이 회수된 경우 등)
 * 네트워크 문구 대신 권한 안내를 보이고, 그 밖의 실패는 화면 고유 문구와 다시 시도를 유지한다.
 */
export function describeLoadError(
  error: ApiError,
  fallback: { title: string; detail: string },
): LoadFailure {
  if (error.code === 'FORBIDDEN') {
    const { title, detail } = describeAdminError(error);
    return { title, detail, retryable: false };
  }
  return { ...fallback, retryable: true };
}
