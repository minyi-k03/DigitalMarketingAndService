import { useState } from 'react';
import buttons from '../ui/buttons.module.css';
import { currentDevice, openEscape } from './browser';
import { planEscape, type EscapeTarget } from './escape-plan';
import styles from './BridgePage.module.css';

/** 재진입·안내 모드의 해지 링크 버튼. PC 웹 강제 항목을 모바일에서 열면 이동 대신 링크 복사를 안내한다 */
export function EscapeLinkAction({ target }: { target: EscapeTarget }) {
  const plan = planEscape(target, currentDevice());

  if (plan.kind === 'open') {
    return (
      <button type="button" className={buttons.primary} onClick={() => openEscape(plan)}>
        해지 페이지 열기
      </button>
    );
  }
  return <CopyLink url={plan.url} />;
}

/** 모바일에서 열 수 없는 PC 전용 해지 페이지의 링크 복사 안내 */
export function CopyLink({ url }: { url: string }) {
  const [state, setState] = useState<'idle' | 'copied' | 'failed'>('idle');

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setState('copied');
    } catch {
      // 권한이 없거나 http 환경이면 복사가 막힌다. 아래 주소를 직접 고르게 안내한다
      setState('failed');
    }
  }

  return (
    <div className={styles.handoff}>
      <p className={styles.handoffTitle}>PC에서 열어 주세요</p>
      <p className={styles.hint}>
        이 서비스는 PC 웹에서만 해지할 수 있어요. 링크를 복사해 PC에서 열어 주세요.
      </p>
      <input className={styles.url} readOnly value={url} aria-label="해지 페이지 주소" />
      <button type="button" className={buttons.primary} onClick={() => void copy()}>
        링크 복사
      </button>
      <p className={styles.copyState} role="status">
        {state === 'copied'
          ? '복사했어요. PC 브라우저 주소창에 붙여 넣어 주세요.'
          : state === 'failed'
            ? '복사하지 못했어요. 위 주소를 길게 눌러 직접 복사해 주세요.'
            : ''}
      </p>
    </div>
  );
}
