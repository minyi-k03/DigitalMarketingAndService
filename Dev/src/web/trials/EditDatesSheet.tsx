import { useId, useState, type FormEvent } from 'react';
import { todayKst } from '../../shared/kst-date';
import { ApiRequestError } from '../api/client';
import { previewTrialPlan, startDateMessage } from '../catalog/trial-plan';
import sheet from '../ui/sheetForm.module.css';
import buttons from '../ui/buttons.module.css';
import { ErrorNotice } from '../ui/ErrorNotice';
import { Sheet } from '../ui/Sheet';
import { useRefreshTrials, useUpdateTrial, type TrialRecordView } from './api';
import { describeCommandError, type CommandFailure } from './command-error';
import { buildUpdateRequest } from './edit-request';

type EditDatesSheetProps = {
  record: TrialRecordView;
  onClose: () => void;
};

/** 시작일·체험 일수 수정 (스토리 42). 확정 날짜는 서버가 다시 계산하며 화면 값은 미리보기다 */
export function EditDatesSheet({ record, onClose }: EditDatesSheetProps) {
  const update = useUpdateTrial(record.id);
  const startId = useId();
  const daysId = useId();
  const errorId = useId();
  const daysErrorId = useId();
  const refresh = useRefreshTrials();
  const [startDate, setStartDate] = useState<string>(record.startDate);
  const [trialDays, setTrialDays] = useState(String(record.trialDays));
  const [failure, setFailure] = useState<CommandFailure | null>(null);
  const today = todayKst({ now: () => new Date() });

  const request = buildUpdateRequest(record, { startDate, trialDays });
  const daysValid = !(!request.ok && request.reason === 'TRIAL_DAYS_INVALID');
  const plan = daysValid
    ? previewTrialPlan({
        startDate,
        trialDays: Number(trialDays.trim()),
        bufferApplied: record.bufferApplied,
        today,
      })
    : null;
  // 이미 상태가 바뀐 뒤(stale)에는 다시 저장해도 같은 오류라 제출을 막는다
  const ready = request.ok && plan?.ok === true && !update.isPending && !failure?.stale;

  /** 상태가 어긋났다는 안내를 읽은 뒤 닫을 때 최신 상태를 불러온다 */
  function close() {
    if (failure?.stale) refresh();
    onClose();
  }

  function submit(e: FormEvent) {
    e.preventDefault();
    if (!request.ok || !ready) return;
    setFailure(null);
    update.mutate(request.body, {
      onSuccess: onClose,
      onError: (error) =>
        setFailure(
          error instanceof ApiRequestError
            ? describeCommandError(error.problem)
            : { title: '수정하지 못했어요', detail: '잠시 뒤 다시 시도해 주세요.', stale: false },
        ),
    });
  }

  return (
    <Sheet title="체험 날짜 수정" onClose={close}>
      <form className={sheet.form} onSubmit={submit} noValidate>
        <div className={sheet.field}>
          <label htmlFor={startId} className={sheet.label}>
            시작일
          </label>
          <input
            id={startId}
            className={sheet.input}
            type="date"
            value={startDate}
            max={today}
            required
            aria-invalid={plan?.ok === false}
            aria-describedby={plan?.ok === false ? errorId : undefined}
            onChange={(e) => setStartDate(e.target.value)}
          />
          {plan?.ok === false ? (
            <p id={errorId} className={sheet.fieldError} role="alert">
              {startDateMessage(plan.reason)}
            </p>
          ) : null}
        </div>

        <div className={sheet.field}>
          <label htmlFor={daysId} className={sheet.label}>
            체험 일수
          </label>
          <input
            id={daysId}
            className={sheet.input}
            type="text"
            inputMode="numeric"
            value={trialDays}
            aria-invalid={!daysValid}
            aria-describedby={daysValid ? undefined : daysErrorId}
            onChange={(e) => setTrialDays(e.target.value)}
          />
          {daysValid ? null : (
            <p id={daysErrorId} className={sheet.fieldError} role="alert">
              체험 일수는 1~365 사이 숫자로 입력해 주세요.
            </p>
          )}
        </div>

        {plan?.ok ? (
          <dl className={sheet.dates} aria-live="polite">
            <dt>결제 예정일</dt>
            <dd>{plan.billingDate}</dd>
            <dt>안전 만료일</dt>
            <dd>{plan.safeEndDate}</dd>
          </dl>
        ) : null}
        <p className={sheet.note}>저장하면 알림도 새 날짜에 맞춰 다시 잡혀요.</p>

        {failure ? <ErrorNotice title={failure.title} detail={failure.detail} /> : null}

        <div className={sheet.actions}>
          <button type="submit" className={buttons.primary} disabled={!ready}>
            {update.isPending ? '저장하는 중…' : '저장'}
          </button>
          <button type="button" className={buttons.utility} onClick={close}>
            {failure?.stale ? '닫기' : '취소'}
          </button>
        </div>
      </form>
    </Sheet>
  );
}
