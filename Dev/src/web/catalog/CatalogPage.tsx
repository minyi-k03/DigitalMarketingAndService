import { useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useSearchParams } from 'react-router';
import { loginErrorNotice } from '../api/login-error';
import { buildLoginRedirect } from '../api/login-redirect';
import { useMe } from '../api/me';
import buttons from '../ui/buttons.module.css';
import { ErrorNotice } from '../ui/ErrorNotice';
import { useCatalogList, type CatalogItemPublicView } from './api';
import { filterCatalog, reconcileQuery, type CategoryFilter, type ServiceCategory } from './filter';
import { categoryLabel, retentionText } from './labels';
import { Badge, DifficultyBadge, Logo, won } from './parts';
import styles from './CatalogPage.module.css';

const CATEGORIES: ServiceCategory[] = [
  'BIGTECH',
  'AI',
  'DELIVERY',
  'OTT',
  'CLOUD',
  'LEARNING',
  'ETC',
];

function readCategory(value: string | null): CategoryFilter {
  return CATEGORIES.find((c) => c === value) ?? 'ALL';
}

export function CatalogPage() {
  const location = useLocation();
  const me = useMe();
  const catalog = useCatalogList();
  const [params, setParams] = useSearchParams();
  const category = readCategory(params.get('category'));
  // IME 입력 중 글자가 흔들리지 않도록 입력값은 따로 들고, 주소에는 뒤따라 반영한다.
  // 홈 링크·뒤로가기로 주소의 검색어가 달라지면 입력값도 따라간다
  const urlQuery = params.get('q') ?? '';
  const [query, setQuery] = useState(urlQuery);
  useEffect(() => {
    setQuery((current) => reconcileQuery(current, urlQuery));
  }, [urlQuery]);
  const loginError = me.data ? null : loginErrorNotice(location.search);

  const visible = useMemo(
    () => filterCatalog(catalog.data ?? [], { category, query }),
    [catalog.data, category, query],
  );

  function update(next: { category?: CategoryFilter; q?: string }) {
    const nextParams = new URLSearchParams(params);
    const nextCategory = next.category ?? category;
    const nextQuery = next.q ?? query;
    if (nextCategory === 'ALL') nextParams.delete('category');
    else nextParams.set('category', nextCategory);
    if (nextQuery.trim() === '') nextParams.delete('q');
    else nextParams.set('q', nextQuery);
    setParams(nextParams, { replace: true });
  }

  return (
    <>
      {me.data === null ? (
        <section className={styles.intro} aria-label="구독컷 소개">
          <div className={styles.introInner}>
            <div className={styles.introText}>
              <h1 className={styles.introTitle}>무료체험, 결제되기 전에 끝내세요</h1>
              <p className={styles.introLead}>
                카드 연동 없이 안전하게 해지할 마지막 날을 알려드려요.
              </p>
            </div>
            <a
              className={buttons.primary}
              href={buildLoginRedirect(undefined, location.pathname + location.search)}
            >
              카카오로 시작하기
            </a>
          </div>
        </section>
      ) : null}

      <div className={styles.page}>
        {loginError ? <ErrorNotice title={loginError.title} detail={loginError.detail} /> : null}
        {me.isError ? (
          <ErrorNotice
            title="계정 정보를 불러오지 못했어요"
            detail="네트워크 상태를 확인한 뒤 다시 시도해 주세요."
            onRetry={() => void me.refetch()}
          />
        ) : null}

        <div className={styles.filters}>
          <h2 className={styles.heading}>무료체험 서비스</h2>
          <div className={styles.search}>
            <label htmlFor="catalog-search" className={styles.visuallyHidden}>
              서비스 이름 검색
            </label>
            <input
              id="catalog-search"
              className={styles.input}
              type="search"
              placeholder="서비스 이름 검색"
              autoComplete="off"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                update({ q: e.target.value });
              }}
            />
          </div>
          <div className={styles.chips} role="group" aria-label="분야">
            {(['ALL', ...CATEGORIES] as CategoryFilter[]).map((c) => (
              <button
                key={c}
                type="button"
                className={styles.chip}
                aria-pressed={category === c}
                onClick={() => update({ category: c })}
              >
                {c === 'ALL' ? '전체' : categoryLabel(c)}
              </button>
            ))}
          </div>
        </div>

        {catalog.isPending ? (
          <ul className={styles.grid} aria-label="불러오는 중" aria-busy="true">
            {[0, 1, 2].map((i) => (
              <li key={i} className={styles.skeleton} />
            ))}
          </ul>
        ) : catalog.isError ? (
          <ErrorNotice
            title="목록을 불러오지 못했어요"
            detail="네트워크 상태를 확인한 뒤 다시 시도해 주세요."
            onRetry={() => void catalog.refetch()}
          />
        ) : visible.length === 0 ? (
          <p className={styles.empty}>
            {catalog.data.length === 0
              ? '아직 등록된 서비스가 없어요.'
              : '검색 결과가 없어요. 다른 이름이나 분야로 찾아보세요.'}
          </p>
        ) : (
          <>
            <p className={styles.count} aria-live="polite">
              서비스 {visible.length}개
            </p>
            <ul className={styles.grid}>
              {visible.map((item) => (
                <li key={item.id}>
                  <CatalogCard item={item} />
                </li>
              ))}
            </ul>
          </>
        )}
      </div>
    </>
  );
}

function CatalogCard({ item }: { item: CatalogItemPublicView }) {
  const stopped = item.publicationStatus === 'UNPUBLISHED';
  return (
    <Link
      to={`/catalog/${encodeURIComponent(item.id)}`}
      className={stopped ? styles.cardStopped : styles.card}
    >
      <div className={styles.cardHead}>
        <Logo item={item} />
        <div className={styles.cardTitle}>
          <p className={styles.name}>{item.name}</p>
          <p className={styles.sub}>
            {categoryLabel(item.serviceCategory)} · 월 {won(item.monthlyPrice)}
          </p>
        </div>
      </div>
      {stopped ? (
        <div className={styles.badges}>
          <Badge>게시 중단</Badge>
          <span className={styles.note}>새로 추적할 수 없어요</span>
        </div>
      ) : (
        <>
          <div className={styles.badges}>
            <DifficultyBadge level={item.darkPatternLevel} />
            <Badge>{`무료체험 ${item.defaultTrialDays}일`}</Badge>
          </div>
          <p className={styles.note}>{retentionText(item.accessRetentionPolicy).short}</p>
        </>
      )}
    </Link>
  );
}
