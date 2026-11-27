import { useEffect } from 'react';
import { Link, Outlet, useLocation } from 'react-router';
import { buildLoginRedirect } from '../api/login-redirect';
import { useMe } from '../api/me';
import pageMessage from '../app/PageMessage.module.css';
import buttons from '../ui/buttons.module.css';
import { ErrorNotice } from '../ui/ErrorNotice';
import skeleton from '../ui/skeleton.module.css';
import { adminAccess } from './access';
import styles from './admin.module.css';
import { adminTabOf } from './tabs';

const TABS = [
  { tab: 'catalog', to: '/admin', label: '서비스' },
  { tab: 'partners', to: '/admin/partners', label: '파트너' },
  { tab: 'reports', to: '/admin/reports', label: '경로 오류 제보' },
] as const;

/**
 * `/admin*` 공통 틀. 운영자(OPERATOR)·관리자(ADMIN)만 안쪽 화면을 본다.
 * 화면 분기일 뿐이고 실제 권한은 서버의 `/api/admin*`가 검사한다 (SPEC §16).
 */
export function AdminLayout() {
  const me = useMe();
  const { pathname, search } = useLocation();
  const access = me.isError ? 'ERROR' : adminAccess(me.data);
  // 등록·수정 화면에서도 '서비스' 탭이 선택돼 지금 위치를 알 수 있게 한다
  const currentTab = adminTabOf(pathname);

  useEffect(() => {
    if (access === 'LOGIN')
      window.location.assign(buildLoginRedirect(undefined, pathname + search));
  }, [access, pathname, search]);

  if (access === 'ERROR') {
    return (
      <div className={pageMessage.wrap}>
        <ErrorNotice
          title="내 정보를 불러오지 못했어요"
          detail="네트워크 상태를 확인한 뒤 다시 시도해 주세요."
          onRetry={() => void me.refetch()}
        />
      </div>
    );
  }
  if (access === 'LOADING' || access === 'LOGIN') {
    return (
      <div className={styles.page} aria-busy="true" aria-label="불러오는 중">
        <div className={`${skeleton.block} ${styles.skeleton}`} />
      </div>
    );
  }
  if (access === 'FORBIDDEN') {
    return (
      <div className={pageMessage.wrap}>
        <h1 className={pageMessage.title}>운영자만 볼 수 있어요</h1>
        <p className={pageMessage.detail}>
          이 화면은 서비스 운영 담당자용이에요. 권한이 필요하면 관리자에게 요청해 주세요.
        </p>
        <Link to="/" className={buttons.primary}>
          홈으로 가기
        </Link>
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <h1 className={styles.heading}>관리 콘솔</h1>
      <nav className={styles.tabs} aria-label="관리 메뉴">
        {TABS.map(({ tab, to, label }) => (
          <Link
            key={tab}
            to={to}
            className={styles.tab}
            aria-current={tab === currentTab ? 'page' : undefined}
          >
            {label}
          </Link>
        ))}
      </nav>
      <Outlet />
    </div>
  );
}
