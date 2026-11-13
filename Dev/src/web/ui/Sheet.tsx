import { useEffect, useId, useRef, type ReactNode } from 'react';
import styles from './Sheet.module.css';

type SheetProps = {
  title: string;
  onClose: () => void;
  children: ReactNode;
};

/**
 * 모바일에서는 아래에서 올라오는 시트, PC에서는 가운데 대화상자.
 * 렌더링되는 동안 열려 있고, 닫으려면 부모가 렌더링을 멈춘다.
 * 네이티브 `<dialog>`라 포커스 가두기·Esc 닫기를 브라우저가 처리한다.
 */
export function Sheet({ title, onClose, children }: SheetProps) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  useEffect(() => {
    const dialog = ref.current;
    if (dialog && !dialog.open) dialog.showModal();
  }, []);

  return (
    <dialog
      ref={ref}
      className={styles.sheet}
      aria-labelledby={titleId}
      onClose={onClose}
      onClick={(e) => {
        // 안쪽 영역은 .body가 덮고 있어, 대화상자 자체를 누른 것은 바깥(배경)을 누른 것이다
        if (e.target === ref.current) onClose();
      }}
    >
      <div className={styles.body}>
        <h2 id={titleId} className={styles.title}>
          {title}
        </h2>
        {children}
      </div>
    </dialog>
  );
}
