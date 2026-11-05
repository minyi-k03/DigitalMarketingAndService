import { Link } from 'react-router';
import buttons from '../ui/buttons.module.css';
import styles from './PageMessage.module.css';

export function NotFound() {
  return (
    <div className={styles.wrap}>
      <h1 className={styles.title}>찾는 화면이 없어요</h1>
      <p className={styles.detail}>주소가 바뀌었거나 없어진 화면이에요. 홈에서 다시 찾아보세요.</p>
      <Link to="/" className={buttons.primary}>
        홈으로 가기
      </Link>
    </div>
  );
}
