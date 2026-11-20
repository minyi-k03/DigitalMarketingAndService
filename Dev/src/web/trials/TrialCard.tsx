import { Link } from 'react-router';
import { Badge, Logo } from '../catalog/parts';
import { TrialActions } from './TrialActions';
import type { TrialRecordView } from './api';
import { statusBadge } from './labels';
import { summaryLine } from './summary';
import styles from './TrialCard.module.css';

export function TrialCard({ record }: { record: TrialRecordView }) {
  const badge = statusBadge(record.status);
  const logo = {
    name: record.catalogItemName,
    ...(record.catalogItemLogoUrl !== undefined && { logoUrl: record.catalogItemLogoUrl }),
  };

  return (
    <li className={styles.card}>
      <Link to={`/trials/${encodeURIComponent(record.id)}`} className={styles.head}>
        <Logo item={logo} />
        <span className={styles.text}>
          <span className={styles.name}>{record.catalogItemName}</span>
          <Badge tone={badge.tone}>{badge.text}</Badge>
        </span>
        {record.dDayLabel ? <span className={styles.dday}>{record.dDayLabel}</span> : null}
      </Link>
      <p className={styles.summary}>{summaryLine(record)}</p>
      <TrialActions record={record} />
    </li>
  );
}
