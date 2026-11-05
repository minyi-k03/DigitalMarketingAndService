import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Link, Outlet, useLocation } from 'react-router';
import { apiFetch } from '../api/client';
import { buildLoginRedirect } from '../api/login-redirect';
import { ME_QUERY_KEY, useMe } from '../api/me';
import buttons from '../ui/buttons.module.css';
import styles from './Layout.module.css';

export function Layout() {
  const location = useLocation();
  const queryClient = useQueryClient();
  const me = useMe();
  const logout = useMutation({
    mutationFn: () => apiFetch<void>('/auth/logout', { method: 'POST' }),
    onSuccess: () => queryClient.setQueryData(ME_QUERY_KEY, null),
  });

  return (
    <div className={styles.page}>
      <header className={styles.nav}>
        <div className={styles.navInner}>
          <Link to="/" className={styles.wordmark}>
            구독컷
          </Link>
          <nav className={styles.actions} aria-label="계정">
            {me.data ? (
              <>
                <span className={styles.nickname}>{me.data.nickname ?? '회원'}</span>
                <button
                  type="button"
                  className={buttons.utility}
                  disabled={logout.isPending}
                  onClick={() => logout.mutate()}
                >
                  로그아웃
                </button>
              </>
            ) : me.data === null ? (
              <a
                className={buttons.utility}
                href={buildLoginRedirect(undefined, location.pathname + location.search)}
              >
                로그인
              </a>
            ) : null}
          </nav>
        </div>
      </header>

      <main className={styles.main}>
        <Outlet />
      </main>

      <footer className={styles.footer}>
        <div className={styles.footerInner}>카드 정보는 받지 않아요.</div>
      </footer>
    </div>
  );
}
