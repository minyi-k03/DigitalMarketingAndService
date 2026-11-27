import { Link } from 'react-router';
import { categoryLabel } from '../catalog/labels';
import { won } from '../ui/money';
import buttons from '../ui/buttons.module.css';
import skeleton from '../ui/skeleton.module.css';
import { useAdminItems } from './api';
import styles from './admin.module.css';
import { LoadErrorNotice } from './LoadErrorNotice';
import { publicationLabel, type PublicationStatus } from './publication';

const STATUS_CLASS: Record<PublicationStatus, string> = {
  PUBLISHED: styles.statusPublished!,
  SUBMITTED: styles.statusSubmitted!,
  UNPUBLISHED: styles.statusUnpublished!,
  REJECTED: '',
};

/** 관리용 카탈로그 목록 (모든 게시 상태, S38·S47) */
export function AdminCatalogPage() {
  const query = useAdminItems();

  return (
    <>
      <div className={styles.headRow}>
        <h2 className={styles.sectionTitle}>등록된 서비스</h2>
        <Link to="/admin/catalog/new" className={buttons.primary}>
          새 서비스 등록
        </Link>
      </div>

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
      ) : query.data.length === 0 ? (
        <div className={styles.empty}>
          <p className={styles.sectionTitle}>아직 등록한 서비스가 없어요</p>
          <p className={styles.lead}>직접 해지 경로를 확인한 서비스부터 등록해 주세요.</p>
        </div>
      ) : (
        <ul className={styles.list}>
          {query.data.map((item) => (
            <li key={item.id} className={styles.row}>
              <Link to={`/admin/catalog/${encodeURIComponent(item.id)}`} className={styles.rowMain}>
                <span className={styles.rowName}>{item.name}</span>
                <span className={styles.meta}>
                  {categoryLabel(item.serviceCategory)} · 월 {won(item.monthlyPrice)} · 체험{' '}
                  {item.defaultTrialDays}일 · 경로 확인 {item.lastVerifiedAt}
                </span>
              </Link>
              <span className={`${styles.status} ${STATUS_CLASS[item.publicationStatus]}`}>
                {publicationLabel(item.publicationStatus)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
