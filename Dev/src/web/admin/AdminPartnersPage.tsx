import { useState, type FormEvent } from 'react';
import { toApiError } from '../api/client';
import buttons from '../ui/buttons.module.css';
import { ErrorNotice } from '../ui/ErrorNotice';
import skeleton from '../ui/skeleton.module.css';
import sheet from '../ui/sheetForm.module.css';
import { describeAdminError, type AdminFailure } from './admin-error';
import { useCreatePartner, usePartners } from './api';
import styles from './admin.module.css';
import type { FormErrors } from './item-form';
import { LoadErrorNotice } from './LoadErrorNotice';
import { buildPartnerRequest, emptyPartnerForm, type PartnerForm } from './partner-form';

/** 파트너 목록과 최소 등록 (D-17). 수정·삭제는 발표 뒤 T41에서 다룬다 */
export function AdminPartnersPage() {
  const query = usePartners();
  const create = useCreatePartner();
  const [form, setForm] = useState<PartnerForm>(emptyPartnerForm);
  const [errors, setErrors] = useState<FormErrors>({});
  const [failure, setFailure] = useState<AdminFailure | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  function submit(e: FormEvent) {
    e.preventDefault();
    setMessage(null);
    const request = buildPartnerRequest(form);
    if (!request.ok) {
      setErrors(request.errors);
      setFailure(null);
      return;
    }
    setErrors({});
    setFailure(null);
    create.mutate(request.body, {
      onSuccess: (partner) => {
        setForm(emptyPartnerForm());
        setMessage(`${partner.companyName}을(를) 등록했어요.`);
      },
      onError: (error) => {
        const next = describeAdminError(toApiError(error));
        setFailure(next);
        setErrors(next.fieldErrors);
      },
    });
  }

  return (
    <>
      <h2 className={styles.sectionTitle}>파트너</h2>
      <p className={styles.lead}>
        체험을 제공하는 파트너예요. 파트너 체험을 대신 제출할 때 소유 파트너로 골라요. 발표용 시연
        데이터는 실존 회사가 아닌 가상 이름으로 등록해 주세요.
      </p>

      <form className={sheet.form} onSubmit={submit} noValidate>
        <div className={styles.formGrid}>
          <div className={sheet.field}>
            <label htmlFor="partner-name" className={sheet.label}>
              회사명
            </label>
            <input
              id="partner-name"
              className={sheet.input}
              value={form.companyName}
              aria-invalid={errors.companyName ? true : undefined}
              aria-describedby={errors.companyName ? 'partner-name-error' : undefined}
              onChange={(e) => setForm((p) => ({ ...p, companyName: e.target.value }))}
            />
            {errors.companyName ? (
              <p id="partner-name-error" className={sheet.fieldError} role="alert">
                {errors.companyName}
              </p>
            ) : null}
          </div>
          <div className={sheet.field}>
            <label htmlFor="partner-email" className={sheet.label}>
              담당자 이메일
            </label>
            <input
              id="partner-email"
              className={sheet.input}
              type="email"
              inputMode="email"
              value={form.contactEmail}
              aria-invalid={errors.contactEmail ? true : undefined}
              aria-describedby={errors.contactEmail ? 'partner-email-error' : undefined}
              onChange={(e) => setForm((p) => ({ ...p, contactEmail: e.target.value }))}
            />
            {errors.contactEmail ? (
              <p id="partner-email-error" className={sheet.fieldError} role="alert">
                {errors.contactEmail}
              </p>
            ) : null}
          </div>
        </div>
        {failure ? <ErrorNotice title={failure.title} detail={failure.detail} /> : null}
        {message ? (
          <p className={styles.success} role="status">
            {message}
          </p>
        ) : null}
        <div className={styles.buttonRow}>
          <button type="submit" className={buttons.primary} disabled={create.isPending}>
            {create.isPending ? '등록하는 중…' : '파트너 등록'}
          </button>
        </div>
      </form>

      <h3 className={`${styles.sectionTitle} ${styles.listHeading}`}>
        등록된 파트너{query.data ? ` ${query.data.length}` : ''}
      </h3>

      {query.isPending ? (
        <div className={styles.list} aria-busy="true" aria-label="불러오는 중">
          <div className={`${skeleton.block} ${styles.skeleton}`} />
        </div>
      ) : query.isError ? (
        <LoadErrorNotice
          error={query.error}
          fallback={{
            title: '파트너 목록을 불러오지 못했어요',
            detail: '네트워크 상태를 확인한 뒤 다시 시도해 주세요.',
          }}
          onRetry={() => void query.refetch()}
        />
      ) : query.data.length === 0 ? (
        <div className={styles.empty}>
          <p className={styles.sectionTitle}>아직 등록한 파트너가 없어요</p>
          <p className={styles.lead}>위 양식으로 첫 파트너를 등록해 주세요.</p>
        </div>
      ) : (
        <ul className={styles.list}>
          {query.data.map((partner) => (
            <li key={partner.id} className={styles.row}>
              <div className={styles.rowMain}>
                <span className={styles.rowName}>{partner.companyName}</span>
                <span className={styles.meta}>{partner.contactEmail}</span>
              </div>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
