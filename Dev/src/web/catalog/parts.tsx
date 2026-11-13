import { difficultyLabel } from './labels';
import type { CatalogItemPublicView } from './api';
import styles from './parts.module.css';

type LogoProps = {
  item: Pick<CatalogItemPublicView, 'name' | 'logoUrl'>;
  size?: 'md' | 'lg';
};

/** 로고 파일이 없으면 서비스 이름의 첫 글자로 대신한다 (로고 업로드 T11은 발표 범위에서 보류) */
export function Logo({ item, size = 'md' }: LogoProps) {
  const className = size === 'lg' ? styles.logoLg : styles.logo;
  if (item.logoUrl) {
    return <img className={className} src={item.logoUrl} alt="" />;
  }
  return (
    <span className={className} aria-hidden="true">
      {item.name.charAt(0)}
    </span>
  );
}

export function DifficultyBadge({ level }: { level: CatalogItemPublicView['darkPatternLevel'] }) {
  const { text, tone } = difficultyLabel(level);
  return <span className={`${styles.badge} ${styles[tone]}`}>해지 난이도 {text}</span>;
}

export function Badge({ children }: { children: string }) {
  return <span className={`${styles.badge} ${styles.plain}`}>{children}</span>;
}

export function won(amount: number): string {
  return `${amount.toLocaleString('ko-KR')}원`;
}
