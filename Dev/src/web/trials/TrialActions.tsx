import { useState } from 'react';
import { Link } from 'react-router';
import buttons from '../ui/buttons.module.css';
import { canDirectCancel, presentActions, type ActionPresentation } from './actions';
import type { TrialRecordView } from './api';
import { ActionSheet } from './ActionSheet';
import { refundTemplatePath } from './refund-template';
import styles from './TrialActions.module.css';

type TrialActionsProps = {
  record: TrialRecordView;
  /** 상세 화면에서만: 해지 브릿지를 거치지 않고 직접 해지한 경우의 확정 진입점 (스토리 28) */
  allowDirectCancel?: boolean;
};

/** 서버가 정한 `actions`를 버튼으로 그리고, 명령 버튼은 확인 시트를 거쳐 실행한다 (SPEC §13) */
export function TrialActions({ record, allowDirectCancel = false }: TrialActionsProps) {
  const [pending, setPending] = useState<ActionPresentation | null>(null);

  const visible = presentActions(record.status, record.actions);
  const direct =
    allowDirectCancel && canDirectCancel(record.status)
      ? presentActions(record.status, ['CONFIRM_CANCEL'])[0]
      : undefined;
  if (visible.length === 0 && !direct) return null;

  const bridgePath = `/bridge/${encodeURIComponent(record.id)}`;

  return (
    <div className={styles.actions}>
      {visible.map((item) =>
        item.kind === 'bridge' || item.kind === 'refund' ? (
          <Link
            key={item.action}
            to={item.kind === 'bridge' ? bridgePath : refundTemplatePath(record.id)}
            className={item.primary ? buttons.primary : buttons.secondary}
          >
            {item.label}
          </Link>
        ) : (
          <button
            key={item.action}
            type="button"
            className={item.primary ? buttons.primary : buttons.secondary}
            onClick={() => setPending(item)}
          >
            {item.label}
          </button>
        ),
      )}
      {direct ? (
        <button type="button" className={styles.quiet} onClick={() => setPending(direct)}>
          이미 직접 해지했어요
        </button>
      ) : null}

      {pending?.confirm ? (
        <ActionSheet
          record={record}
          action={pending.action}
          confirm={pending.confirm}
          onClose={() => setPending(null)}
        />
      ) : null}
    </div>
  );
}
