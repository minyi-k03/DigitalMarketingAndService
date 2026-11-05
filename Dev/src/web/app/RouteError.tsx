import styles from './PageMessage.module.css';
import { ErrorNotice } from '../ui/ErrorNotice';

/** 화면을 그리다 던져진 오류를 잡는다. 렌더링 중 던져진 내용은 사용자에게 그대로 보이지 않는다 */
export function RouteError() {
  return (
    <div className={styles.wrap}>
      <ErrorNotice
        title="화면을 불러오지 못했어요"
        detail="새로고침해도 계속되면 잠시 뒤 다시 시도해 주세요."
        onRetry={() => window.location.reload()}
      />
    </div>
  );
}
