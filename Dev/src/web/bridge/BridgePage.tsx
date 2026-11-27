import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router';
import { toApiError } from '../api/client';
import { Badge, Logo } from '../catalog/parts';
import buttons from '../ui/buttons.module.css';
import { ErrorNotice } from '../ui/ErrorNotice';
import skeleton from '../ui/skeleton.module.css';
import { useRefreshTrials } from '../trials/api';
import { EXIT_REASONS, exitReasonLabel, type ExitReason } from '../trials/labels';
import { useBridge, useReportBrokenLink, useSelectExitReason, type BridgeView } from './api';
import { cancelFallbackRedirect, currentDevice, openEscape } from './browser';
import {
  describeBridgeCommandError,
  describeBridgeLoadError,
  describeBrokenLinkReportError,
  type BridgeCommandFailure,
  type BrokenLinkReportFailure,
} from './bridge-error';
import {
  BROKEN_LINK_TARGETS,
  describeBrokenLinkReportSuccess,
  reportButtonLabel,
  type BrokenLinkTarget,
} from './broken-link-report';
import { CopyLink, EscapeLinkAction } from './EscapeLinkAction';
import { needsPcHandoff, planEscape, type EscapeTarget } from './escape-plan';
import { bridgeSections } from './sections';
import styles from './BridgePage.module.css';

const MODE_BADGE: Record<BridgeView['mode'], string> = {
  POLL: '해지 안내',
  REENTRY: '해지 진행 중',
  GUIDE_ONLY: '다음 달 결제 막기',
};

export function BridgePage() {
  const { trialRecordId = '' } = useParams();
  const query = useBridge(trialRecordId);
  const refresh = useRefreshTrials();
  const back = `/trials/${encodeURIComponent(trialRecordId)}`;

  // 해지 페이지에서 뒤로 돌아오면 브라우저가 이전 화면(사유 버튼)을 그대로 복원할 수 있다(bfcache).
  // 이미 CANCEL_ATTEMPTED가 됐는데 사유 버튼이 남아 409가 나지 않도록 복원될 때 새로 불러온다
  useEffect(() => {
    const onPageShow = (e: PageTransitionEvent) => {
      if (e.persisted) refresh();
    };
    window.addEventListener('pageshow', onPageShow);
    return () => window.removeEventListener('pageshow', onPageShow);
  }, [refresh]);

  // 앱 딥링크 뒤 대체 이동 타이머가 이 화면을 떠난 뒤에 실행되면 안 된다 (앱 내 이동은 pagehide가 없다)
  useEffect(() => cancelFallbackRedirect, []);

  const failure = query.isError ? describeBridgeLoadError(toApiError(query.error)) : null;
  // 이미 불러온 화면이 있으면 일시적인 오류(네트워크·서버)로 지우지 않는다. 없는 기록·끝난 체험은 바로 안내한다
  if (failure && (query.data === undefined || !failure.retry)) {
    return (
      <div className={styles.page}>
        <Link to="/trials" className={styles.back}>
          ← 내 체험
        </Link>
        <ErrorNotice
          title={failure.title}
          detail={failure.detail}
          {...(failure.retry && { onRetry: () => void query.refetch() })}
        />
      </div>
    );
  }
  if (query.data === undefined) {
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
  // 다른 체험으로 바뀌면 이전 체험의 오류 안내가 남지 않도록 새로 그린다
  return <BridgeBody key={query.data.trialRecordId} view={query.data} backTo={back} />;
}

/** 이용 종료 시점 안내. 문구는 SPEC §6 `ESCAPE_ALERT` 분기와 같은 뜻이다 */
function retentionNote(policy: BridgeView['accessRetentionPolicy']): string {
  return policy === 'RETAIN_UNTIL_END'
    ? '지금 해지해도 만료일까지는 이용할 수 있어요. 일찍 해지하는 걸 권해요.'
    : '해지하면 바로 이용이 끝나요. 필요한 자료를 먼저 백업한 뒤 해지해 주세요.';
}

/** 해지 방식별 안내 한 줄 (SPEC §7) */
function patternNote(view: BridgeView): string | null {
  if (view.escapePattern === 'SPA_MODAL_GUIDE') {
    return '해지 페이지로 이동한 뒤 아래 순서대로 눌러 주세요. 돌아오면 이 안내가 그대로 있어요.';
  }
  if (view.escapePattern === 'PC_OR_APP_FORCED') {
    if (view.forcedChannel === 'APP') {
      return '전용 앱에서만 해지할 수 있어요. 앱이 없으면 설치 페이지로 연결돼요.';
    }
    if (view.forcedChannel === 'PC_WEB') return 'PC 웹에서만 해지할 수 있어요.';
  }
  return null;
}

function BridgeBody({ view, backTo }: { view: BridgeView; backTo: string }) {
  const [failure, setFailure] = useState<BridgeCommandFailure | null>(null);
  // 모바일에서 PC 전용 항목의 사유를 고른 뒤 받은 링크. 새로 불러오기가 늦거나 실패해도 복사할 수 있게 쥐고 있는다
  const [handoffUrl, setHandoffUrl] = useState<string | null>(null);
  const logo = {
    name: view.catalogItemName,
    ...(view.catalogItemLogoUrl !== undefined && { logoUrl: view.catalogItemLogoUrl }),
  };
  const note = patternNote(view);

  return (
    <div className={styles.page}>
      <Link to={backTo} className={styles.back}>
        ← 체험 상세
      </Link>

      <header className={styles.head}>
        <Logo item={logo} size="lg" />
        <div className={styles.headText}>
          <h1 className={styles.name}>{view.catalogItemName}</h1>
          <Badge>{MODE_BADGE[view.mode]}</Badge>
        </div>
      </header>

      {view.mode === 'GUIDE_ONLY' ? (
        <p className={styles.callout}>
          다음 달 결제를 막기 위한 해지 방법이에요. 이 화면에서는 체험 기록이 바뀌지 않아요.
        </p>
      ) : null}
      <p className={styles.note}>{retentionNote(view.accessRetentionPolicy)}</p>

      {failure ? <ErrorNotice title={failure.title} detail={failure.detail} /> : null}

      {bridgeSections(view).map((section) => {
        if (section === 'backup') return <BackupSection key={section} view={view} />;
        if (section === 'guide') return <GuideSection key={section} view={view} note={note} />;
        const target = escapeTarget(view);
        if (view.mode === 'POLL') {
          return handoffUrl !== null ? (
            <section key={section} className={styles.section}>
              <CopyLink url={handoffUrl} />
            </section>
          ) : (
            <ReasonSection
              key={section}
              view={view}
              onFailure={setFailure}
              onHandoff={setHandoffUrl}
            />
          );
        }
        return (
          <section key={section} className={styles.section}>
            {target ? (
              <EscapeLinkAction target={target} />
            ) : (
              // 서버 계약상 이 모드에는 직링크가 오지만, 없으면 빈 주소로 이동하지 않고 안내만 남긴다
              <p className={styles.hint}>
                해지 페이지 링크를 지금은 열 수 없어요. 위 해지 방법을 참고해 주세요.
              </p>
            )}
            {view.mode === 'REENTRY' ? (
              <>
                <p className={styles.hint}>
                  해지를 마쳤다면 내 체험에서 &lsquo;해지 완료&rsquo;로 표시해 주세요.
                </p>
                <Link to={backTo} className={buttons.secondary}>
                  해지 완료 표시하러 가기
                </Link>
              </>
            ) : null}
          </section>
        );
      })}
      <BrokenLinkReportSection trialRecordId={view.trialRecordId} />
    </div>
  );
}

/** 직링크는 REENTRY·GUIDE_ONLY에서만 온다. POLL이거나 서버가 링크를 주지 않으면 `null` */
function escapeTarget(view: BridgeView): EscapeTarget | null {
  if (view.mode === 'POLL' || view.escapeLink === undefined) return null;
  return {
    escapeLink: view.escapeLink,
    escapePattern: view.escapePattern,
    ...(view.escapeLinkFallbackUrl !== undefined && {
      escapeLinkFallbackUrl: view.escapeLinkFallbackUrl,
    }),
    ...(view.forcedChannel !== undefined && { forcedChannel: view.forcedChannel }),
  };
}

function BackupSection({ view }: { view: BridgeView }) {
  return (
    <section className={styles.section}>
      <h2 className={styles.heading}>
        {view.backupFirst ? '해지하기 전에 먼저 백업하세요' : '미리 챙겨 두면 좋아요'}
      </h2>
      <ul className={styles.list}>
        {view.backupChecklist?.map((item, index) => (
          // 같은 문장이 반복될 수 있어 순서까지 키에 넣는다
          <li key={`${index}-${item}`}>{item}</li>
        ))}
      </ul>
    </section>
  );
}

function GuideSection({ view, note }: { view: BridgeView; note: string | null }) {
  return (
    <section className={styles.section}>
      <h2 className={styles.heading}>해지 방법</h2>
      {note ? <p className={styles.hint}>{note}</p> : null}
      <ol className={styles.steps}>
        {view.escapeGuideSteps.map((step, index) => (
          // 안내 문구는 같은 문장이 반복될 수 있어 순서까지 키에 넣는다
          <li key={`${index}-${step}`}>{step}</li>
        ))}
      </ol>
      <p className={styles.verified}>{view.lastVerifiedAt} 확인</p>
    </section>
  );
}

function ReasonSection({
  view,
  onFailure,
  onHandoff,
}: {
  view: BridgeView;
  onFailure: (failure: BridgeCommandFailure | null) => void;
  /** 이동하지 않고 링크 복사를 안내해야 할 때 응답의 직링크를 넘긴다 */
  onHandoff: (url: string) => void;
}) {
  const select = useSelectExitReason(view.trialRecordId);
  const refresh = useRefreshTrials();
  const reasons = view.exitReasons ?? EXIT_REASONS;
  const handoff = needsPcHandoff(view, currentDevice());

  function choose(reason: ExitReason) {
    onFailure(null);
    select.mutate(reason, {
      onSuccess: (result) => {
        // 상태가 CANCEL_ATTEMPTED로 바뀌었으니 화면은 재진입 모드가 된다. 이동 전에 먼저 새로 불러온다
        refresh();
        const plan = planEscape(result, currentDevice());
        if (plan.kind === 'open') openEscape(plan);
        else onHandoff(plan.url);
      },
      onError: (error) => {
        const failure = describeBridgeCommandError(toApiError(error));
        onFailure(failure);
        if (failure.refresh) refresh();
      },
    });
  }

  return (
    <section className={styles.section}>
      <h2 className={styles.heading}>왜 해지하려고 하세요?</h2>
      <p className={styles.hint}>
        {handoff
          ? '하나를 누르면 PC에서 열 수 있는 링크를 알려 드려요.'
          : '하나를 누르면 바로 해지 페이지로 이동해요.'}
      </p>
      <div className={styles.reasons} role="group" aria-label="해지하려는 이유">
        {reasons.map((reason) => (
          <button
            key={reason}
            type="button"
            className={styles.reason}
            // 성공한 뒤에는 새로 불러온 화면(재진입)으로 바뀔 때까지 다시 누를 수 없게 한다. 두 번 보내면 409가 난다
            disabled={select.isPending || select.isSuccess}
            onClick={() => choose(reason)}
          >
            {select.isPending && select.variables === reason
              ? '이동하는 중…'
              : exitReasonLabel(reason)}
          </button>
        ))}
      </div>
    </section>
  );
}

function BrokenLinkReportSection({ trialRecordId }: { trialRecordId: string }) {
  const report = useReportBrokenLink(trialRecordId);
  const [notice, setNotice] = useState<string | null>(null);
  const [failure, setFailure] = useState<BrokenLinkReportFailure | null>(null);

  function submit(target: BrokenLinkTarget) {
    setNotice(null);
    setFailure(null);
    report.mutate(target, {
      onSuccess: (receipt) => {
        setNotice(describeBrokenLinkReportSuccess(target, receipt));
      },
      onError: (error) => {
        setFailure(describeBrokenLinkReportError(toApiError(error)));
      },
    });
  }

  return (
    <section className={styles.section}>
      <h2 className={styles.heading}>경로가 달라졌나요?</h2>
      <p className={styles.hint}>
        링크가 열리지 않거나 안내 순서가 실제 화면과 다르면 알려 주세요.
      </p>
      {failure ? <ErrorNotice title={failure.title} detail={failure.detail} /> : null}
      <div className={styles.reportActions}>
        {BROKEN_LINK_TARGETS.map((target) => (
          <button
            key={target}
            type="button"
            className={buttons.utility}
            disabled={report.isPending}
            onClick={() => submit(target)}
          >
            {report.isPending && report.variables === target
              ? '보내는 중…'
              : reportButtonLabel(target)}
          </button>
        ))}
      </div>
      <p className={styles.reportState} role="status">
        {notice ?? ''}
      </p>
    </section>
  );
}
