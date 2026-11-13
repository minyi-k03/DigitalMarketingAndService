import { Link } from 'react-router';
import buttons from '../ui/buttons.module.css';
import styles from './PageMessage.module.css';

type ComingSoonProps = {
  title: string;
  detail: string;
};

/** 아직 만들지 않은 화면(T27 내 체험, T28 해지 브릿지)으로 가는 링크가 막다른 길이 되지 않게 하는 임시 화면 */
export function ComingSoon({ title, detail }: ComingSoonProps) {
  return (
    <div className={styles.wrap}>
      <h1 className={styles.title}>{title}</h1>
      <p className={styles.detail}>{detail}</p>
      <Link to="/" className={buttons.primary}>
        서비스 목록으로
      </Link>
    </div>
  );
}
