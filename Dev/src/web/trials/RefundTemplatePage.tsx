import { useState } from 'react';
import { Link, useParams } from 'react-router';
import { toApiError } from '../api/client';
import buttons from '../ui/buttons.module.css';
import { ErrorNotice } from '../ui/ErrorNotice';
import skeleton from '../ui/skeleton.module.css';
import { useRefundTemplate } from './api';
import { describeRefundTemplateError } from './refund-template';
import styles from './RefundTemplatePage.module.css';

export function RefundTemplatePage() {
  const { trialRecordId = '' } = useParams();
  const query = useRefundTemplate(trialRecordId);
  const back = `/trials/${encodeURIComponent(trialRecordId)}`;

  if (query.isPending) {
    return (
      <div className={styles.page}>
        <div
          className={`${skeleton.block} ${styles.skeleton}`}
          aria-busy="true"
          aria-label="불러오는 중"
        />
      </div>
    );
  }
  if (query.isError) {
    const failure = describeRefundTemplateError(toApiError(query.error));
    return (
      <div className={styles.page}>
        <Link to="/trials" className={styles.back}>
          ← 내 체험
        </Link>
        <ErrorNotice
          title={failure.title}
          detail={failure.detail}
          {...(failure.retry && { onRetry: () => void query.refetch() })}
        />
      </div>
    );
  }

  const { ko, en, referenceBillingDate } = query.data;
  return (
    <div className={styles.page}>
      <Link to={back} className={styles.back}>
        ← 체험 상세
      </Link>
      <h1 className={styles.title}>환불 요청 템플릿</h1>
      <p className={styles.note}>
        서비스 이름·체험 시작일·고객센터는 채워 두었어요. 대괄호 [ ] 안의 실제 결제일, 결제 금액,
        이름만 직접 적어서 고객센터에 보내 주세요. 구독컷이 대신 보내 주지는 않아요.
      </p>
      <p className={styles.reference}>
        공식 결제 예정일(참고): <time dateTime={referenceBillingDate}>{referenceBillingDate}</time>.
        실제로 결제된 날짜와 다를 수 있어 템플릿에는 넣지 않았어요.
      </p>

      <TemplateBlock heading="한국어" lang="ko" text={ko} primary />
      <TemplateBlock heading="English" lang="en" text={en} />
    </div>
  );
}

/** `primary`는 화면의 유일한 파란 버튼이다 (DESIGN-notion). 두 번째 복사 버튼은 보조 버튼으로 둔다 */
function TemplateBlock({
  heading,
  lang,
  text,
  primary = false,
}: {
  heading: string;
  lang: string;
  text: string;
  primary?: boolean;
}) {
  const [state, setState] = useState<'idle' | 'copied' | 'failed'>('idle');

  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      setState('copied');
    } catch {
      // 권한이 없거나 http 환경이면 복사가 막힌다. 본문을 직접 고르게 안내한다
      setState('failed');
    }
  }

  return (
    <section className={styles.section}>
      <h2 className={styles.heading}>{heading}</h2>
      <pre className={styles.text} lang={lang} tabIndex={0}>
        {text}
      </pre>
      <button
        type="button"
        className={primary ? buttons.primary : buttons.secondary}
        onClick={() => void copy()}
      >
        {heading} 복사
      </button>
      <p className={styles.copyState} role="status">
        {state === 'copied'
          ? '복사했어요. 빈칸을 채워서 보내 주세요.'
          : state === 'failed'
            ? '복사하지 못했어요. 위 글을 길게 눌러 직접 복사해 주세요.'
            : ''}
      </p>
    </section>
  );
}
