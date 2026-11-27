import { toApiError } from '../api/client';
import { ErrorNotice } from '../ui/ErrorNotice';
import { describeLoadError } from './admin-error';

type LoadErrorNoticeProps = {
  error: unknown;
  /** 권한 문제가 아닌 실패(네트워크 등)에 보일 문구 */
  fallback: { title: string; detail: string };
  onRetry: () => void;
};

/** 관리 화면의 불러오기 실패 안내. 권한이 없으면 권한 안내를 보이고 다시 시도는 숨긴다 */
export function LoadErrorNotice({ error, fallback, onRetry }: LoadErrorNoticeProps) {
  const { title, detail, retryable } = describeLoadError(toApiError(error), fallback);
  return <ErrorNotice title={title} detail={detail} {...(retryable && { onRetry })} />;
}
