import { useLocation } from 'react-router';
import { buildLoginRedirect } from '../api/login-redirect';
import { useMe } from '../api/me';
import buttons from '../ui/buttons.module.css';
import { ErrorNotice } from '../ui/ErrorNotice';
import styles from './Home.module.css';

export function Home() {
  const location = useLocation();
  const me = useMe();

  return (
    <>
      <section className={styles.hero}>
        <div className={styles.heroInner}>
          <h1 className={styles.title}>무료체험, 결제되기 전에 끝내세요</h1>
          <p className={styles.lead}>
            카드 연동 없이 무료체험을 등록하면, 안전하게 해지할 수 있는 마지막 날을 알려드려요.
          </p>
          <div className={styles.actions}>
            {me.data === null ? (
              <a
                className={buttons.primary}
                href={buildLoginRedirect(undefined, location.pathname + location.search)}
              >
                카카오로 시작하기
              </a>
            ) : null}
            {me.data ? (
              <p className={styles.greeting}>{me.data.nickname ?? '회원'}님, 반가워요.</p>
            ) : null}
          </div>
        </div>
      </section>

      {me.isError ? (
        <div className={styles.notice}>
          <ErrorNotice
            title="계정 정보를 불러오지 못했어요"
            detail="네트워크 상태를 확인한 뒤 다시 시도해 주세요."
            onRetry={() => void me.refetch()}
          />
        </div>
      ) : null}
    </>
  );
}
