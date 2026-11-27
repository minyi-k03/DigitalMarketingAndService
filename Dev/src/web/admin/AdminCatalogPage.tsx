import { Link, useLocation } from 'react-router';
import { categoryLabel } from '../catalog/labels';
import { won } from '../ui/money';
import buttons from '../ui/buttons.module.css';
import skeleton from '../ui/skeleton.module.css';
import { useAdminItems, usePartners } from './api';
import styles from './admin.module.css';
import { LoadErrorNotice } from './LoadErrorNotice';
import {
  countAwaitingReview,
  filterByPublication,
  publicationLabel,
  type PublicationFilter,
  type PublicationStatus,
} from './publication';

const STATUS_CLASS: Record<PublicationStatus, string> = {
  PUBLISHED: styles.statusPublished!,
  SUBMITTED: styles.statusSubmitted!,
  UNPUBLISHED: styles.statusUnpublished!,
  REJECTED: '',
};

/** `?status=SUBMITTED`이면 검수 대기만, 그 밖에는 전체 */
function parseFilter(search: string): PublicationFilter {
  return new URLSearchParams(search).get('status') === 'SUBMITTED' ? 'SUBMITTED' : 'ALL';
}

/** 관리용 카탈로그 목록 (모든 게시 상태, S35·S38·S47). 파트너 제출 건은 ‘검수 대기’로 모아 본다 */
export function AdminCatalogPage() {
  const { search } = useLocation();
  const filter = parseFilter(search);
  const query = useAdminItems();
  const partners = usePartners();

  const awaiting = query.data ? countAwaitingReview(query.data) : 0;
  const visible = query.data ? filterByPublication(query.data, filter) : [];
  const partnerName = (id: string | undefined) =>
    id === undefined ? undefined : partners.data?.find((p) => p.id === id)?.companyName;

  return (
    <>
      <div className={styles.headRow}>
        <h2 className={styles.sectionTitle}>등록된 서비스</h2>
        <div className={styles.buttonRow}>
          <Link to="/admin/catalog/new-sponsored" className={buttons.utility}>
            파트너 체험 제출
          </Link>
          <Link to="/admin/catalog/new" className={buttons.primary}>
            새 서비스 등록
          </Link>
        </div>
      </div>

      {/* 상단 탭(이동)과 모양을 달리해 '지금 보는 목록을 거르는 것'임이 보이게 한다 */}
      <nav className={styles.filters} aria-label="게시 상태">
        <Link
          replace
          to={{ search: '' }}
          className={styles.filter}
          aria-current={filter === 'ALL' ? 'page' : undefined}
        >
          전체
        </Link>
        <Link
          replace
          to={{ search: '?status=SUBMITTED' }}
          className={styles.filter}
          aria-current={filter === 'SUBMITTED' ? 'page' : undefined}
        >
          검수 대기
          {query.data ? (
            <span className={awaiting > 0 ? styles.countAlert : styles.count}>{awaiting}</span>
          ) : null}
        </Link>
      </nav>

      {query.isPending ? (
        <div className={styles.list} aria-busy="true" aria-label="불러오는 중">
          <div className={`${skeleton.block} ${styles.skeleton}`} />
          <div className={`${skeleton.block} ${styles.skeleton}`} />
        </div>
      ) : query.isError ? (
        <LoadErrorNotice
          error={query.error}
          fallback={{
            title: '서비스 목록을 불러오지 못했어요',
            detail: '네트워크 상태를 확인한 뒤 다시 시도해 주세요.',
          }}
          onRetry={() => void query.refetch()}
        />
      ) : visible.length === 0 ? (
        <div className={styles.empty}>
          {filter === 'SUBMITTED' ? (
            <>
              <p className={styles.sectionTitle}>검수를 기다리는 제출이 없어요</p>
              <p className={styles.lead}>파트너 체험을 제출하면 여기에 나타나요.</p>
            </>
          ) : (
            <>
              <p className={styles.sectionTitle}>아직 등록한 서비스가 없어요</p>
              <p className={styles.lead}>직접 해지 경로를 확인한 서비스부터 등록해 주세요.</p>
            </>
          )}
        </div>
      ) : (
        <ul className={styles.list}>
          {visible.map((item) => {
            const owner = partnerName(item.ownerPartnerId);
            return (
              <li key={item.id} className={styles.row}>
                <Link
                  to={`/admin/catalog/${encodeURIComponent(item.id)}`}
                  className={styles.rowMain}
                >
                  <span className={styles.rowName}>
                    {item.name}
                    {item.kind === 'SPONSORED_TRIAL' ? (
                      <span className={styles.kind}>파트너 체험</span>
                    ) : null}
                  </span>
                  <span className={styles.meta}>
                    {categoryLabel(item.serviceCategory)} · 월 {won(item.monthlyPrice)} · 체험{' '}
                    {item.defaultTrialDays}일 · 경로 확인 {item.lastVerifiedAt}
                    {owner ? ` · 제공 ${owner}` : ''}
                  </span>
                </Link>
                <span className={`${styles.status} ${STATUS_CLASS[item.publicationStatus]}`}>
                  {publicationLabel(item.publicationStatus)}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
