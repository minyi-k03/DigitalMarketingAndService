import { Link, useLocation } from 'react-router';
import { won } from '../catalog/parts';
import { ErrorNotice } from '../ui/ErrorNotice';
import skeleton from '../ui/skeleton.module.css';
import buttons from '../ui/buttons.module.css';
import { useTrials } from './api';
import { parseTab, tabSearch, type TrialsTab } from './tab';
import { TrialCard } from './TrialCard';
import styles from './TrialsPage.module.css';

const TABS: { tab: TrialsTab; label: string }[] = [
  { tab: 'ACTIVE', label: '진행 중' },
  { tab: 'PAST', label: '지난 체험' },
];

export function TrialsPage() {
  const { search } = useLocation();
  const tab = parseTab(search);
  const query = useTrials(tab);

  return (
    <div className={styles.page}>
      <h1 className={styles.heading}>내 체험</h1>

      {query.data ? (
        <section className={styles.summary} aria-label="요약">
          <div className={styles.saved}>
            <span className={styles.label}>누적 방어 금액</span>
            <span className={styles.amount}>{won(query.data.savedAmountTotal)}</span>
          </div>
          <div className={styles.active}>
            <span className={styles.label}>진행 중</span>
            <span className={styles.count}>{query.data.activeCount}건</span>
          </div>
        </section>
      ) : null}

      <nav className={styles.tabs} aria-label="체험 구분">
        {TABS.map((item) => (
          <Link
            key={item.tab}
            replace
            to={{ search: tabSearch(item.tab) }}
            className={styles.tab}
            aria-current={item.tab === tab ? 'page' : undefined}
          >
            {item.label}
          </Link>
        ))}
      </nav>

      {query.isPending ? (
        <div className={styles.list} aria-busy="true" aria-label="불러오는 중">
          <div className={`${skeleton.block} ${styles.skeletonCard}`} />
          <div className={`${skeleton.block} ${styles.skeletonCard}`} />
        </div>
      ) : query.isError ? (
        <ErrorNotice
          title="내 체험을 불러오지 못했어요"
          detail="네트워크 상태를 확인한 뒤 다시 시도해 주세요."
          onRetry={() => void query.refetch()}
        />
      ) : query.data.items.length === 0 ? (
        <div className={styles.empty}>
          <p className={styles.emptyTitle}>
            {tab === 'ACTIVE' ? '추적 중인 체험이 없어요' : '아직 끝난 체험이 없어요'}
          </p>
          {tab === 'ACTIVE' ? (
            <>
              <p className={styles.emptyDetail}>
                무료체험을 시작했다면 서비스를 골라 추적을 시작해 보세요.
              </p>
              <Link to="/" className={buttons.primary}>
                서비스 둘러보기
              </Link>
            </>
          ) : null}
        </div>
      ) : (
        <ul className={styles.list}>
          {query.data.items.map((record) => (
            <TrialCard key={record.id} record={record} />
          ))}
        </ul>
      )}
    </div>
  );
}
