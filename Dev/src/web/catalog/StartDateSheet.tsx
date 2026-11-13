import { useId, useState, type FormEvent } from 'react';
import type { KstDate } from '../../shared/kst-date';
import buttons from '../ui/buttons.module.css';
import { ErrorNotice } from '../ui/ErrorNotice';
import { Sheet } from '../ui/Sheet';
import type { CatalogItemPublicView } from './api';
import { previewTrialPlan, startDateMessage } from './trial-plan';
import styles from './StartDateSheet.module.css';

export type StartDateMode = 'date' | 'already';

type StartDateSheetProps = {
  item: CatalogItemPublicView;
  mode: StartDateMode;
  today: KstDate;
  pending: boolean;
  /** 서버가 등록을 거부했을 때 시트 안에 보이는 안내 */
  failure: { title: string; detail: string } | null;
  onSubmit: (startDate: string) => void;
  onClose: () => void;
};

/** 시작일 바꾸기(S8)와 '이미 가입했어요'(S46)가 함께 쓰는 시작일 확인 시트 */
export function StartDateSheet({
  item,
  mode,
  today,
  pending,
  failure,
  onSubmit,
  onClose,
}: StartDateSheetProps) {
  const fieldId = useId();
  const errorId = useId();
  const [startDate, setStartDate] = useState<string>(today);
  const already = mode === 'already';
  const plan = previewTrialPlan({
    startDate,
    trialDays: item.defaultTrialDays,
    bufferApplied: item.isGlobalTimeZoneBufferRequired,
    today,
  });

  function submit(e: FormEvent) {
    e.preventDefault();
    if (plan.ok && !pending) onSubmit(startDate);
  }

  return (
    <Sheet title={already ? '언제 가입했나요?' : '체험을 언제 시작했나요?'} onClose={onClose}>
      <form className={styles.form} onSubmit={submit} noValidate>
        <div className={styles.field}>
          <label htmlFor={fieldId} className={styles.label}>
            시작일
          </label>
          <input
            id={fieldId}
            className={styles.input}
            type="date"
            value={startDate}
            max={today}
            required
            aria-invalid={!plan.ok}
            aria-describedby={plan.ok ? undefined : errorId}
            onChange={(e) => setStartDate(e.target.value)}
          />
          {plan.ok ? null : (
            <p id={errorId} className={styles.fieldError} role="alert">
              {startDateMessage(plan.reason)}
            </p>
          )}
        </div>

        <p className={styles.note}>체험 일수 {item.defaultTrialDays}일 (이 서비스의 기본값)</p>

        {plan.ok ? (
          <dl className={styles.dates} aria-live="polite">
            <dt>결제 예정일</dt>
            <dd>{plan.billingDate}</dd>
            <dt>안전 만료일</dt>
            <dd>{plan.safeEndDate}</dd>
          </dl>
        ) : null}

        {failure ? <ErrorNotice title={failure.title} detail={failure.detail} /> : null}

        <div className={styles.actions}>
          <button type="submit" className={buttons.primary} disabled={!plan.ok || pending}>
            {pending ? '등록하는 중…' : already ? '추적하고 해지하러 가기' : '추적 시작'}
          </button>
          <button type="button" className={buttons.utility} onClick={onClose}>
            취소
          </button>
        </div>
      </form>
    </Sheet>
  );
}
