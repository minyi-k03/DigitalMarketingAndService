import buttons from './buttons.module.css';
import styles from './ErrorNotice.module.css';

type ErrorNoticeProps = {
  title: string;
  /** 무엇이 잘못됐고 어떻게 하면 되는지 */
  detail?: string;
  onRetry?: () => void;
};

export function ErrorNotice({ title, detail, onRetry }: ErrorNoticeProps) {
  return (
    <div className={styles.notice} role="alert">
      <span className={styles.dot} aria-hidden="true" />
      <div className={styles.text}>
        <p className={styles.title}>{title}</p>
        {detail ? <p className={styles.detail}>{detail}</p> : null}
        {onRetry ? (
          <button type="button" className={buttons.utility} onClick={onRetry}>
            다시 시도
          </button>
        ) : null}
      </div>
    </div>
  );
}
