import { useState } from 'react';
import { Link, useParams } from 'react-router';
import { ApiRequestError } from '../api/client';
import buttons from '../ui/buttons.module.css';
import { ErrorNotice } from '../ui/ErrorNotice';
import { useCatalogItem, type CatalogItemPublicView, type TrialRecordView } from './api';
import { canStartTracking, categoryLabel, escapePatternText, retentionText } from './labels';
import { DifficultyBadge, Logo, won } from './parts';
import { TrackingPanel } from './TrackingPanel';
import styles from './CatalogDetail.module.css';

type Outcome =
  | { kind: 'registered'; record: TrialRecordView }
  | { kind: 'duplicate'; existingTrialRecordId: string | undefined }
  | null;

export function CatalogDetail() {
  const { catalogItemId = '' } = useParams();
  const query = useCatalogItem(catalogItemId);

  if (query.isPending) {
    return (
      <div className={styles.page}>
        <div className={styles.skeleton} aria-busy="true" aria-label="불러오는 중" />
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
            title="찾는 서비스가 없어요"
            detail="주소가 바뀌었거나 목록에서 빠진 서비스예요. 목록에서 다시 찾아보세요."
          />
        ) : (
          <ErrorNotice
            title="서비스 정보를 불러오지 못했어요"
            detail="네트워크 상태를 확인한 뒤 다시 시도해 주세요."
            onRetry={() => void query.refetch()}
          />
        )}
      </div>
    );
  }
  // 서비스가 바뀌면 이전 서비스의 등록 결과·시트 상태가 남지 않도록 새로 그린다
  return <DetailBody key={query.data.id} item={query.data} />;
}

function BackLink() {
  return (
    <Link to="/" className={styles.back}>
      ← 목록으로
    </Link>
  );
}

function DetailBody({ item }: { item: CatalogItemPublicView }) {
  const [outcome, setOutcome] = useState<Outcome>(null);
  const retention = retentionText(item.accessRetentionPolicy);
  const stopped = !canStartTracking(item);

  return (
    <div className={styles.page}>
      <BackLink />
      <div className={styles.layout}>
        <div className={styles.main}>
          {stopped ? (
            <div className={styles.banner} role="status">
              <p className={styles.bannerTitle}>게시가 중단된 서비스예요</p>
              <p>정보는 볼 수 있지만 새로 추적할 수 없어요.</p>
            </div>
          ) : null}
          <OutcomeBanner outcome={outcome} />

          <header className={styles.head}>
            <Logo item={item} size="lg" />
            <div className={styles.headText}>
              <h1 className={styles.title}>{item.name}</h1>
              <p className={styles.sub}>
                {categoryLabel(item.serviceCategory)} · 월 {won(item.monthlyPrice)} · 기본 무료체험{' '}
                {item.defaultTrialDays}일
              </p>
              <p className={styles.sub}>{item.lastVerifiedAt} 확인</p>
            </div>
          </header>

          <section className={styles.box} aria-labelledby="sec-difficulty">
            <h2 id="sec-difficulty" className={styles.boxTitle}>
              해지 난이도
            </h2>
            <div>
              <DifficultyBadge level={item.darkPatternLevel} />
            </div>
            <p>{escapePatternText(item)}</p>
          </section>

          <section className={styles.box} aria-labelledby="sec-retention">
            <h2 id="sec-retention" className={styles.boxTitle}>
              해지하면 어떻게 되나요
            </h2>
            <p className={styles.strong}>{retention.headline}</p>
            <p className={styles.muted}>{retention.advice}</p>
          </section>

          <section className={styles.box} aria-labelledby="sec-guide">
            <h2 id="sec-guide" className={styles.boxTitle}>
              해지 가이드 ({item.escapeGuideSteps.length}단계)
            </h2>
            <ol className={styles.steps}>
              {item.escapeGuideSteps.map((step) => (
                <li key={step}>{step}</li>
              ))}
            </ol>
            <p className={styles.muted}>해지 링크는 추적을 시작한 뒤 해지 화면에서 열려요.</p>
          </section>

          {item.backupChecklist && item.backupChecklist.length > 0 ? (
            <section className={styles.box} aria-labelledby="sec-backup">
              <h2 id="sec-backup" className={styles.boxTitle}>
                해지 전에 백업하세요
              </h2>
              <ul className={styles.checks}>
                {item.backupChecklist.map((entry) => (
                  <li key={entry}>{entry}</li>
                ))}
              </ul>
            </section>
          ) : null}

          {item.eduBenefit ? (
            <section className={styles.box} aria-labelledby="sec-edu">
              <h2 id="sec-edu" className={styles.boxTitle}>
                학생 혜택
              </h2>
              <p>{item.eduBenefit.description}</p>
              <a href={item.eduBenefit.url} target="_blank" rel="noopener noreferrer">
                혜택 자세히 보기
              </a>
            </section>
          ) : null}

          {item.isGlobalTimeZoneBufferRequired ? (
            <p className={styles.info}>해외 결제 서비스라 결제 예정일보다 하루 일찍 알려드려요.</p>
          ) : null}

          <p className={styles.muted}>
            고객센터 {item.supportContact.email ? <span>{item.supportContact.email}</span> : null}
            {item.supportContact.url ? (
              <a href={item.supportContact.url} target="_blank" rel="noopener noreferrer">
                {item.supportContact.email ? ' · 고객센터 페이지' : '고객센터 페이지'}
              </a>
            ) : null}
          </p>
        </div>

        <aside className={styles.aside} aria-label="체험 추적">
          <TrackingPanel
            item={item}
            onRegistered={(record) => {
              setOutcome({ kind: 'registered', record });
              window.scrollTo({ top: 0 });
            }}
            onDuplicate={(existingTrialRecordId) => {
              setOutcome({ kind: 'duplicate', existingTrialRecordId });
              window.scrollTo({ top: 0 });
            }}
          />
        </aside>
      </div>
    </div>
  );
}

function OutcomeBanner({ outcome }: { outcome: Outcome }) {
  if (!outcome) return null;
  if (outcome.kind === 'duplicate') {
    return (
      <div className={styles.banner} role="status">
        <p className={styles.bannerTitle}>이미 추적 중인 서비스예요</p>
        <p>같은 서비스는 한 번만 추적할 수 있어요.</p>
        <div className={styles.bannerActions}>
          <Link to="/trials" className={buttons.utility}>
            내 체험에서 보기
          </Link>
        </div>
      </div>
    );
  }
  const { record } = outcome;
  return (
    <div className={styles.bannerOk} role="status">
      <p className={styles.bannerTitle}>추적을 시작했어요</p>
      <dl className={styles.dates}>
        <dt>시작일</dt>
        <dd>{record.startDate}</dd>
        <dt>결제 예정일</dt>
        <dd>{record.billingDate}</dd>
        <dt>안전 만료일</dt>
        <dd>{record.safeEndDate}</dd>
      </dl>
      <p>안전 만료일까지 해지하면 결제를 피할 수 있어요.</p>
      <div className={styles.bannerActions}>
        <Link to="/trials" className={buttons.primary}>
          내 체험 보기
        </Link>
        <Link to="/" className={buttons.secondary}>
          계속 둘러보기
        </Link>
      </div>
    </div>
  );
}
