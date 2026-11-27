import { useState } from 'react';
import { Link, useLocation } from 'react-router';
import { toApiError } from '../api/client';
import { kstDateOf, type UtcInstant } from '../../shared/kst-date';
import buttons from '../ui/buttons.module.css';
import { ErrorNotice } from '../ui/ErrorNotice';
import skeleton from '../ui/skeleton.module.css';
import { describeAdminError, type AdminFailure } from './admin-error';
import { LoadErrorNotice } from './LoadErrorNotice';
import { useAdminItems, useAdminReports, useResolveReport } from './api';
import styles from './admin.module.css';
import {
  parseReportStatusFilter,
  REPORT_FILTERS,
  reportActions,
  reportFilterLabel,
  reportStatusLabel,
  reportTargetLabel,
} from './reports';

/** 경로 오류 제보 목록과 처리 (S40). 제보자 정보는 보여 주지 않는다 */
export function AdminReportsPage() {
  const { search } = useLocation();
  const filter = parseReportStatusFilter(search);
  const reports = useAdminReports(filter);
  const items = useAdminItems();
  const resolve = useResolveReport();
  const [failure, setFailure] = useState<AdminFailure | null>(null);

  // 서비스 목록을 아직 못 받았으면 '알 수 없는 서비스'가 잠깐 비치지 않게 자리만 둔다
  const nameOf = (catalogItemId: string) =>
    items.data
      ? (items.data.find((item) => item.id === catalogItemId)?.name ?? '알 수 없는 서비스')
      : '서비스 이름을 불러오는 중…';

  return (
    <>
      <h2 className={styles.sectionTitle}>경로 오류 제보</h2>
      <p className={styles.lead}>
        사용자가 해지 링크나 가이드가 잘못됐다고 알려 준 건이에요. 서비스 화면에서 고친 뒤 ‘수정
        완료’로 처리해 주세요.
      </p>

      <nav className={styles.tabs} aria-label="처리 상태">
        {REPORT_FILTERS.map((f) => (
          <Link
            key={f}
            replace
            to={{ search: f === 'OPEN' ? '' : `?status=${f}` }}
            className={styles.tab}
            aria-current={f === filter ? 'page' : undefined}
          >
            {reportFilterLabel(f)}
          </Link>
        ))}
      </nav>

      {failure ? <ErrorNotice title={failure.title} detail={failure.detail} /> : null}

      {reports.isPending ? (
        <div className={styles.list} aria-busy="true" aria-label="불러오는 중">
          <div className={`${skeleton.block} ${styles.skeleton}`} />
          <div className={`${skeleton.block} ${styles.skeleton}`} />
        </div>
      ) : reports.isError ? (
        <LoadErrorNotice
          error={reports.error}
          fallback={{
            title: '제보 목록을 불러오지 못했어요',
            detail: '네트워크 상태를 확인한 뒤 다시 시도해 주세요.',
          }}
          onRetry={() => void reports.refetch()}
        />
      ) : reports.data.length === 0 ? (
        <div className={styles.empty}>
          <p className={styles.sectionTitle}>
            {filter === 'OPEN' ? '처리할 제보가 없어요' : '해당하는 제보가 없어요'}
          </p>
        </div>
      ) : (
        <ul className={styles.list}>
          {reports.data.map((report) => {
            const actions = reportActions(report.status);
            return (
              <li key={report.id} className={styles.row}>
                <Link
                  to={`/admin/catalog/${encodeURIComponent(report.catalogItemId)}`}
                  className={styles.rowMain}
                >
                  <span className={styles.rowName}>{nameOf(report.catalogItemId)}</span>
                  <span className={styles.meta}>
                    {reportTargetLabel(report.target)} · {kstDateOf(report.createdAt as UtcInstant)}{' '}
                    접수
                  </span>
                </Link>
                {actions.length > 0 ? (
                  <div className={styles.buttonRow}>
                    {actions.map((action) => (
                      <button
                        key={action.status}
                        type="button"
                        className={buttons.utility}
                        disabled={resolve.isPending}
                        onClick={() => {
                          setFailure(null);
                          resolve.mutate(
                            { reportId: report.id, status: action.status },
                            {
                              onError: (error) => {
                                const next = describeAdminError(toApiError(error));
                                setFailure(next);
                                // 이미 처리됐다는 응답이면 목록이 낡았으므로 최신으로 다시 받는다
                                if (next.stale) void reports.refetch();
                              },
                            },
                          );
                        }}
                      >
                        {action.label}
                      </button>
                    ))}
                  </div>
                ) : (
                  <span className={styles.status}>{reportStatusLabel(report.status)}</span>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
