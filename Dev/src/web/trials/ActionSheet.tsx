import { useState, type FormEvent } from 'react';
import { ApiRequestError } from '../api/client';
import buttons from '../ui/buttons.module.css';
import { ErrorNotice } from '../ui/ErrorNotice';
import { Sheet } from '../ui/Sheet';
import { exitReasonRequired, type ActionConfirm, type TrialAction } from './actions';
import { useRefreshTrials, useTrialCommand, type TrialRecordView } from './api';
import { describeCommandError, type CommandFailure } from './command-error';
import { EXIT_REASONS, exitReasonLabel, type ExitReason } from './labels';
import styles from './ActionSheet.module.css';

type ActionSheetProps = {
  record: TrialRecordView;
  action: TrialAction;
  confirm: ActionConfirm;
  onClose: () => void;
};

/**
 * 유지·등록 취소·해지 확정·결제 확인 정정이 함께 쓰는 확인 시트.
 * 기록에 ExitPoll 응답이 없는 해지 확정은 사유 한 가지를 고르게 한다 (스토리 28·31).
 */
export function ActionSheet({ record, action, confirm, onClose }: ActionSheetProps) {
  const command = useTrialCommand(record.id);
  const needsReason = exitReasonRequired(action, record);
  const [reason, setReason] = useState<ExitReason | null>(null);
  const [failure, setFailure] = useState<CommandFailure | null>(null);
  const refresh = useRefreshTrials();

  // 이미 상태가 바뀐 뒤(stale)에는 같은 명령을 다시 보내도 같은 오류라 제출을 막는다
  const ready = !command.isPending && !failure?.stale && (!needsReason || reason !== null);

  /** 상태가 어긋났다는 안내를 읽은 뒤 닫을 때 최신 상태를 불러온다 */
  function close() {
    if (failure?.stale) refresh();
    onClose();
  }

  function submit(e: FormEvent) {
    e.preventDefault();
    if (!ready) return;
    setFailure(null);
    command.mutate(
      { action, ...(needsReason && reason !== null && { exitReason: reason }) },
      {
        onSuccess: onClose,
        onError: (error) =>
          setFailure(
            error instanceof ApiRequestError
              ? describeCommandError(error.problem)
              : { title: '처리하지 못했어요', detail: '잠시 뒤 다시 시도해 주세요.', stale: false },
          ),
      },
    );
  }

  return (
    <Sheet title={confirm.title} onClose={close}>
      <form className={styles.form} onSubmit={submit}>
        <p className={styles.detail}>{confirm.detail}</p>

        {needsReason ? (
          <fieldset className={styles.reasons}>
            <legend className={styles.legend}>왜 해지했는지 한 가지만 골라 주세요</legend>
            {EXIT_REASONS.map((value) => (
              <label key={value} className={styles.reason}>
                <input
                  type="radio"
                  name="exitReason"
                  value={value}
                  checked={reason === value}
                  onChange={() => setReason(value)}
                />
                <span>{exitReasonLabel(value)}</span>
              </label>
            ))}
          </fieldset>
        ) : null}

        {failure ? <ErrorNotice title={failure.title} detail={failure.detail} /> : null}

        <div className={styles.actions}>
          <button type="submit" className={buttons.primary} disabled={!ready}>
            {command.isPending ? '처리하는 중…' : confirm.button}
          </button>
          <button type="button" className={buttons.utility} onClick={close}>
            {failure?.stale ? '닫기' : '취소'}
          </button>
        </div>
      </form>
    </Sheet>
  );
}
