import { useState } from 'react';
import { Link, useParams } from 'react-router';
import { ApiRequestError } from '../api/client';
import { Badge, Logo } from '../catalog/parts';
import buttons from '../ui/buttons.module.css';
import { won } from '../ui/money';
import { ErrorNotice } from '../ui/ErrorNotice';
import skeleton from '../ui/skeleton.module.css';
import { canEdit } from './actions';
import { useTrial, type TrialRecordView } from './api';
import { EditDatesSheet } from './EditDatesSheet';
import { statusBadge } from './labels';
import { TrialActions } from './TrialActions';
import styles from './TrialDetail.module.css';

function BackLink() {
  return (
    <Link to="/trials" className={styles.back}>
      ← 내 체험
    </Link>
  );
}

export function TrialDetail() {
  const { trialRecordId = '' } = useParams();
  const query = useTrial(trialRecordId);

  if (query.isPending) {
    return (
      <div className={styles.page}>
        <div
          className={`${skeleton.block} ${styles.skeleton}`}
          aria-busy="true"
          aria-label="불러오는 중"
        />
      </div>
    );
  }
  if (query.isError) {
    const notFound =
      query.error instanceof ApiRequestError && query.error.problem.code === 'NOT_FOUND';
    return (
      <div className={styles.page}>
        <BackLink />
        {notFound ? (
          <ErrorNotice
            title="체험을 찾을 수 없어요"
            detail="이미 삭제됐거나 주소가 바뀌었어요. 내 체험 목록에서 다시 확인해 주세요."
          />
        ) : (
          <ErrorNotice
            title="체험 정보를 불러오지 못했어요"
            detail="네트워크 상태를 확인한 뒤 다시 시도해 주세요."
            onRetry={() => void query.refetch()}
          />
        )}
      </div>
    );
  }
  // 다른 체험으로 바뀌면 이전 체험의 수정 시트 상태가 남지 않도록 새로 그린다
  return <DetailBody key={query.data.id} record={query.data} />;
}

function DetailBody({ record }: { record: TrialRecordView }) {
  const [editing, setEditing] = useState(false);
  const badge = statusBadge(record.status);
  const logo = {
    name: record.catalogItemName,
    ...(record.catalogItemLogoUrl !== undefined && { logoUrl: record.catalogItemLogoUrl }),
  };

  return (
    <div className={styles.page}>
      <BackLink />

      <header className={styles.head}>
        <Logo item={logo} size="lg" />
        <div className={styles.headText}>
          <h1 className={styles.name}>{record.catalogItemName}</h1>
          <Badge tone={badge.tone}>{badge.text}</Badge>
        </div>
        {record.dDayLabel ? <span className={styles.dday}>{record.dDayLabel}</span> : null}
      </header>

      {record.status === 'MISSED_BILLED' ? (
        <p className={styles.callout}>
          결제 예정일이 지났어요. 실제로 결제가 됐는지 알려 주면 그에 맞는 안내를 드려요.
        </p>
      ) : null}

      <dl className={styles.facts}>
        <dt>시작일</dt>
        <dd>{record.startDate}</dd>
        <dt>체험 일수</dt>
        <dd>{record.trialDays}일</dd>
        <dt>결제 예정일</dt>
        <dd>{record.billingDate}</dd>
        <dt>안전 만료일</dt>
        <dd>
          {record.safeEndDate}
          {record.bufferApplied ? (
            <span className={styles.hint}>결제 예정일보다 하루 앞서요</span>
          ) : null}
        </dd>
        {record.savedAmount !== null ? (
          <>
            <dt>방어한 금액</dt>
            <dd>{won(record.savedAmount)}</dd>
          </>
        ) : null}
      </dl>

      <TrialActions record={record} allowDirectCancel />

      {canEdit(record.status) ? (
        <button type="button" className={buttons.secondary} onClick={() => setEditing(true)}>
          날짜 수정
        </button>
      ) : null}

      {editing ? <EditDatesSheet record={record} onClose={() => setEditing(false)} /> : null}
    </div>
  );
}
