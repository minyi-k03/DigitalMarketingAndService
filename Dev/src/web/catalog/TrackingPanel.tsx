import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router';
import { todayKst } from '../../shared/kst-date';
import { ApiRequestError } from '../api/client';
import { buildLoginRedirect } from '../api/login-redirect';
import { useMe } from '../api/me';
import buttons from '../ui/buttons.module.css';
import { ErrorNotice } from '../ui/ErrorNotice';
import { Sheet } from '../ui/Sheet';
import { useCreateTrial, type CatalogItemPublicView, type TrialRecordView } from './api';
import { canStartTracking } from './labels';
import { describeRegisterError } from './register-error';
import { StartDateSheet, type StartDateMode } from './StartDateSheet';
import styles from './TrackingPanel.module.css';

type TrackingPanelProps = {
  item: CatalogItemPublicView;
  onRegistered: (record: TrialRecordView) => void;
  onDuplicate: (existingTrialRecordId: string | undefined) => void;
};

type Notice = { title: string; detail: string };
type SheetState = 'login' | StartDateMode | null;

/**
 * 상세 화면의 등록 영역: 1회 클릭 등록(S8), 시작일 바꾸기, '이미 가입했어요'(S46).
 * 게시 중단 항목은 어떤 경로의 버튼도 만들지 않는다 (D-13, V-08).
 */
export function TrackingPanel({ item, onRegistered, onDuplicate }: TrackingPanelProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const me = useMe();
  const create = useCreateTrial();
  const [sheet, setSheet] = useState<SheetState>(null);
  const [failure, setFailure] = useState<Notice | null>(null);
  const today = todayKst({ now: () => new Date() });

  if (!canStartTracking(item)) {
    return (
      <div className={styles.stopped} role="status">
        <p className={styles.stoppedTitle}>게시가 중단된 서비스예요</p>
        <p className={styles.note}>새로 추적할 수 없어요. 이미 추적 중이면 알림은 계속 받아요.</p>
      </div>
    );
  }

  const needsLogin = me.data === null;

  function open(next: Exclude<SheetState, null>) {
    setFailure(null);
    create.reset();
    setSheet(needsLogin ? 'login' : next);
  }

  function register(mode: 'quick' | StartDateMode, startDate?: string) {
    setFailure(null);
    create.mutate(
      { catalogItemId: item.id, ...(startDate ? { startDate } : {}) },
      {
        onSuccess: (record) => {
          setSheet(null);
          if (mode === 'already') navigate(`/bridge/${encodeURIComponent(record.id)}`);
          else onRegistered(record);
        },
        onError: (error) => {
          if (!(error instanceof ApiRequestError)) {
            setFailure({ title: '등록하지 못했어요', detail: '잠시 뒤 다시 시도해 주세요.' });
            return;
          }
          const result = describeRegisterError(error.problem);
          if (result.kind === 'duplicate') {
            setSheet(null);
            // '이미 가입했어요'는 기존 기록의 해지 브릿지로 바로 이어 준다 (S46)
            if (mode === 'already' && result.existingTrialRecordId) {
              navigate(`/bridge/${encodeURIComponent(result.existingTrialRecordId)}`);
            } else {
              onDuplicate(result.existingTrialRecordId);
            }
            return;
          }
          setFailure({ title: result.title, detail: result.detail });
        },
      },
    );
  }

  return (
    <div className={styles.panel}>
      <button
        type="button"
        className={buttons.primary}
        disabled={create.isPending}
        onClick={() => (needsLogin ? open('login') : register('quick'))}
      >
        {create.isPending && sheet === null ? '등록하는 중…' : '무료체험 시작했어요 · 추적 시작'}
      </button>
      <p className={styles.startLine}>
        <span>시작일 오늘 ({today})</span>
        <button type="button" className={styles.link} onClick={() => open('date')}>
          시작일 바꾸기
        </button>
      </p>
      <button type="button" className={buttons.secondary} onClick={() => open('already')}>
        이미 가입했어요 · 해지하러 가기
      </button>
      {needsLogin ? <p className={styles.note}>카카오 로그인 후 추적이 시작돼요.</p> : null}
      {failure && sheet === null ? (
        <ErrorNotice title={failure.title} detail={failure.detail} />
      ) : null}

      {sheet === 'login' ? (
        <Sheet title="카카오 로그인이 필요해요" onClose={() => setSheet(null)}>
          <p className={styles.note}>
            로그인하면 지금 보던 화면으로 돌아와요. 카드 정보는 받지 않아요.
          </p>
          <a
            className={buttons.primary}
            href={buildLoginRedirect(undefined, location.pathname + location.search)}
          >
            카카오로 로그인하고 돌아오기
          </a>
          <button type="button" className={buttons.utility} onClick={() => setSheet(null)}>
            취소
          </button>
        </Sheet>
      ) : null}

      {sheet === 'date' || sheet === 'already' ? (
        <StartDateSheet
          item={item}
          mode={sheet}
          today={today}
          pending={create.isPending}
          failure={failure}
          onSubmit={(startDate) => register(sheet, startDate)}
          onClose={() => {
            setSheet(null);
            setFailure(null);
          }}
        />
      ) : null}
    </div>
  );
}
