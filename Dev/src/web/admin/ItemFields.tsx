import type { ReactNode } from 'react';
import { Link } from 'react-router';
import { categoryLabel } from '../catalog/labels';
import sheet from '../ui/sheetForm.module.css';
import styles from './admin.module.css';
import type {
  AccessRetentionPolicy,
  EscapePattern,
  FormErrors,
  ItemForm,
  ServiceCategory,
} from './item-form';
import { LoadErrorNotice } from './LoadErrorNotice';
import type { Partner } from './partner-form';

const CATEGORIES: ServiceCategory[] = [
  'BIGTECH',
  'AI',
  'DELIVERY',
  'OTT',
  'CLOUD',
  'LEARNING',
  'ETC',
];

const PATTERNS: Record<EscapePattern, string> = {
  DIRECT_LINK: '계정 설정에서 바로 해지',
  SPA_MODAL_GUIDE: '메뉴·팝업을 거쳐 해지 (가이드 필요)',
  PC_OR_APP_FORCED: 'PC 웹 또는 전용 앱에서만 해지',
};

const RETENTION: Record<AccessRetentionPolicy, string> = {
  RETAIN_UNTIL_END: '해지해도 만료일까지 이용',
  IMMEDIATE_TERMINATION: '해지하면 즉시 이용 종료',
};

type FieldProps = {
  id: string;
  label: string;
  error?: string | undefined;
  hint?: string;
  wide?: boolean;
  /** 입력 요소가 없는 상태(불러오는 중·목록 없음·오류)에서는 false. 연결할 대상이 없는 `label for`를 만들지 않는다 */
  hasControl?: boolean;
  children: (describedBy: string | undefined) => ReactNode;
};

/** 라벨·도움말·오류를 한 칸으로 묶는다. 입력 요소는 `aria-describedby`에 연결할 id를 받는다 */
function Field({ id, label, error, hint, wide, hasControl = true, children }: FieldProps) {
  const describedBy = [error ? `${id}-error` : null, hint ? `${id}-hint` : null]
    .filter(Boolean)
    .join(' ');
  return (
    <div className={`${sheet.field} ${wide ? styles.span : ''}`}>
      {hasControl ? (
        <label htmlFor={id} className={sheet.label}>
          {label}
        </label>
      ) : (
        <span className={sheet.label}>{label}</span>
      )}
      {children(describedBy || undefined)}
      {hint ? (
        <p id={`${id}-hint`} className={sheet.note}>
          {hint}
        </p>
      ) : null}
      {error ? (
        <p id={`${id}-error`} className={sheet.fieldError} role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}

/** 파트너 목록을 불러오지 못했을 때의 안내와 다시 시도 */
export type PartnersFailure = { error: unknown; onRetry: () => void };

type ItemFieldsProps = {
  form: ItemForm;
  errors: FormErrors;
  onChange: (patch: Partial<ItemForm>) => void;
  /** 수정 화면에서만 진행 중 기록 안내를 보인다 */
  editing: boolean;
  /** SPONSORED_TRIAL의 소유 파트너 후보. 아직 불러오는 중이면 undefined */
  partners?: Partner[] | undefined;
  /** 파트너 목록 조회가 실패했으면 불러오는 중 문구 대신 오류와 다시 시도를 보인다 */
  partnersFailure?: PartnersFailure | undefined;
};

const SCORE_OPTIONS = [0, 1, 2] as const;

/** 카탈로그 항목 입력 칸 전체 (SPEC §2). 값 검사는 `item-form`과 서버가 맡는다 */
export function ItemFields({
  form,
  errors,
  onChange,
  editing,
  partners,
  partnersFailure,
}: ItemFieldsProps) {
  const invalid = (key: string) => (errors[key] ? true : undefined);

  return (
    <div className={styles.formGrid}>
      <Field id="item-name" label="서비스명" error={errors.name}>
        {(d) => (
          <input
            id="item-name"
            className={sheet.input}
            value={form.name}
            aria-invalid={invalid('name')}
            aria-describedby={d}
            onChange={(e) => onChange({ name: e.target.value })}
          />
        )}
      </Field>

      {form.kind === 'SPONSORED_TRIAL' ? (
        <>
          <Field
            id="item-partner"
            label="소유 파트너"
            error={errors.ownerPartnerId}
            hasControl={
              partnersFailure === undefined && partners !== undefined && partners.length > 0
            }
            hint={
              partners?.length === 0
                ? undefined
                : '체험을 제공하는 파트너예요. 목록에 없으면 파트너 메뉴에서 먼저 등록해 주세요.'
            }
          >
            {(d) =>
              partnersFailure ? (
                <LoadErrorNotice
                  error={partnersFailure.error}
                  fallback={{
                    title: '파트너 목록을 불러오지 못했어요',
                    detail: '네트워크 상태를 확인한 뒤 다시 시도해 주세요.',
                  }}
                  onRetry={partnersFailure.onRetry}
                />
              ) : partners === undefined ? (
                <p className={sheet.note} role="status">
                  파트너를 불러오는 중…
                </p>
              ) : partners.length === 0 ? (
                <p className={sheet.note}>
                  등록된 파트너가 없어요. <Link to="/admin/partners">파트너를 먼저 등록</Link>해
                  주세요.
                </p>
              ) : (
                <select
                  id="item-partner"
                  className={styles.select}
                  value={form.ownerPartnerId}
                  aria-invalid={invalid('ownerPartnerId')}
                  aria-describedby={d}
                  onChange={(e) => onChange({ ownerPartnerId: e.target.value })}
                >
                  <option value="">파트너를 골라 주세요</option>
                  {partners.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.companyName}
                    </option>
                  ))}
                </select>
              )
            }
          </Field>

          <Field
            id="item-signup-url"
            label="가입 페이지 URL"
            error={errors.signupUrl}
            hint="https 주소만 쓸 수 있어요. 사용자가 ‘가입하러 가기’를 누르면 이 주소로 이동해요."
            wide
          >
            {(d) => (
              <input
                id="item-signup-url"
                className={sheet.input}
                type="url"
                inputMode="url"
                value={form.signupUrl}
                aria-invalid={invalid('signupUrl')}
                aria-describedby={d}
                onChange={(e) => onChange({ signupUrl: e.target.value })}
              />
            )}
          </Field>
        </>
      ) : null}

      <Field id="item-category" label="분야">
        {() => (
          <select
            id="item-category"
            className={styles.select}
            value={form.serviceCategory}
            onChange={(e) => onChange({ serviceCategory: e.target.value as ServiceCategory })}
          >
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {categoryLabel(c)}
              </option>
            ))}
          </select>
        )}
      </Field>

      <Field id="item-price" label="월 가격 (원)" error={errors.monthlyPrice}>
        {(d) => (
          <input
            id="item-price"
            className={sheet.input}
            type="text"
            inputMode="numeric"
            value={form.monthlyPrice}
            aria-invalid={invalid('monthlyPrice')}
            aria-describedby={d}
            onChange={(e) => onChange({ monthlyPrice: e.target.value })}
          />
        )}
      </Field>

      <Field id="item-days" label="기본 체험 일수" error={errors.defaultTrialDays}>
        {(d) => (
          <input
            id="item-days"
            className={sheet.input}
            type="text"
            inputMode="numeric"
            value={form.defaultTrialDays}
            aria-invalid={invalid('defaultTrialDays')}
            aria-describedby={d}
            onChange={(e) => onChange({ defaultTrialDays: e.target.value })}
          />
        )}
      </Field>

      <div className={styles.span}>
        <label className={styles.check}>
          <input
            type="checkbox"
            checked={form.isGlobalTimeZoneBufferRequired}
            onChange={(e) => onChange({ isGlobalTimeZoneBufferRequired: e.target.checked })}
          />
          <span>
            글로벌 서비스라 시차 버퍼가 필요해요 (안전 만료일을 하루 앞당겨요)
            {editing ? (
              <>
                <br />
                <span className={sheet.note}>
                  바꿔도 이미 등록된 진행 중 기록에는 반영되지 않고, 새로 등록하는 체험부터
                  적용돼요.
                </span>
              </>
            ) : null}
          </span>
        </label>
      </div>

      <Field id="item-retention" label="해지 후 이용" wide>
        {() => (
          <select
            id="item-retention"
            className={styles.select}
            value={form.accessRetentionPolicy}
            onChange={(e) =>
              onChange({ accessRetentionPolicy: e.target.value as AccessRetentionPolicy })
            }
          >
            {(Object.keys(RETENTION) as AccessRetentionPolicy[]).map((p) => (
              <option key={p} value={p}>
                {RETENTION[p]}
              </option>
            ))}
          </select>
        )}
      </Field>

      <fieldset className={`${styles.panel} ${styles.span}`}>
        <legend className={sheet.label}>다크패턴 원점수 (등급은 서버가 계산해요)</legend>
        <div className={styles.formGrid}>
          <Field id="item-menu-depth" label="메뉴 깊이" error={errors.darkPatternScores}>
            {(d) => (
              <select
                id="item-menu-depth"
                className={styles.select}
                value={form.menuDepth}
                aria-invalid={invalid('darkPatternScores')}
                aria-describedby={d}
                onChange={(e) => onChange({ menuDepth: Number(e.target.value) as 0 | 1 | 2 })}
              >
                {SCORE_OPTIONS.map((n) => (
                  <option key={n} value={n}>
                    {n}점
                  </option>
                ))}
              </select>
            )}
          </Field>
          <Field id="item-popups" label="설득 팝업">
            {() => (
              <select
                id="item-popups"
                className={styles.select}
                value={form.persuasionPopups}
                onChange={(e) =>
                  onChange({ persuasionPopups: Number(e.target.value) as 0 | 1 | 2 })
                }
              >
                {SCORE_OPTIONS.map((n) => (
                  <option key={n} value={n}>
                    {n}점
                  </option>
                ))}
              </select>
            )}
          </Field>
          <Field id="item-forced" label="PC·앱 강제">
            {() => (
              <select
                id="item-forced"
                className={styles.select}
                value={form.forcedPcOrApp}
                onChange={(e) => onChange({ forcedPcOrApp: Number(e.target.value) as 0 | 2 })}
              >
                <option value={0}>0점</option>
                <option value={2}>2점</option>
              </select>
            )}
          </Field>
        </div>
      </fieldset>

      <Field id="item-pattern" label="해지 방식" wide>
        {() => (
          <select
            id="item-pattern"
            className={styles.select}
            value={form.escapePattern}
            onChange={(e) => onChange({ escapePattern: e.target.value as EscapePattern })}
          >
            {(Object.keys(PATTERNS) as EscapePattern[]).map((p) => (
              <option key={p} value={p}>
                {PATTERNS[p]}
              </option>
            ))}
          </select>
        )}
      </Field>

      {form.escapePattern === 'PC_OR_APP_FORCED' ? (
        <Field id="item-channel" label="강제 접속 채널" error={errors.forcedChannel} wide>
          {(d) => (
            <select
              id="item-channel"
              className={styles.select}
              value={form.forcedChannel}
              aria-invalid={invalid('forcedChannel')}
              aria-describedby={d}
              onChange={(e) =>
                onChange({ forcedChannel: e.target.value as ItemForm['forcedChannel'] })
              }
            >
              <option value="">선택해 주세요</option>
              <option value="APP">전용 앱</option>
              <option value="PC_WEB">PC 웹</option>
            </select>
          )}
        </Field>
      ) : null}

      <Field
        id="item-link"
        label="해지 링크"
        hint="https:// 주소만 쓸 수 있어요. 전용 앱이면 등록된 앱 주소(딥링크)도 돼요."
        error={errors.escapeLink}
        wide
      >
        {(d) => (
          <input
            id="item-link"
            className={sheet.input}
            type="text"
            inputMode="url"
            value={form.escapeLink}
            aria-invalid={invalid('escapeLink')}
            aria-describedby={d}
            onChange={(e) => onChange({ escapeLink: e.target.value })}
          />
        )}
      </Field>

      <Field
        id="item-fallback"
        label="앱이 없을 때 대체 URL"
        hint="전용 앱 해지 항목은 필수예요. https:// 주소만 쓸 수 있어요."
        error={errors.escapeLinkFallbackUrl}
        wide
      >
        {(d) => (
          <input
            id="item-fallback"
            className={sheet.input}
            type="text"
            inputMode="url"
            value={form.escapeLinkFallbackUrl}
            aria-invalid={invalid('escapeLinkFallbackUrl')}
            aria-describedby={d}
            onChange={(e) => onChange({ escapeLinkFallbackUrl: e.target.value })}
          />
        )}
      </Field>

      <fieldset className={`${styles.panel} ${styles.span}`}>
        <legend className={sheet.label}>해지 가이드 (1~3단계)</legend>
        {form.escapeGuideSteps.map((step, index) => (
          <Field key={index} id={`item-step-${index}`} label={`${index + 1}단계`}>
            {() => (
              <input
                id={`item-step-${index}`}
                className={sheet.input}
                value={step}
                aria-invalid={invalid('escapeGuideSteps')}
                aria-describedby={errors.escapeGuideSteps ? 'item-steps-error' : undefined}
                onChange={(e) =>
                  onChange({
                    escapeGuideSteps: form.escapeGuideSteps.map((s, i) =>
                      i === index ? e.target.value : s,
                    ),
                  })
                }
              />
            )}
          </Field>
        ))}
        {errors.escapeGuideSteps ? (
          <p id="item-steps-error" className={sheet.fieldError} role="alert">
            {errors.escapeGuideSteps}
          </p>
        ) : null}
      </fieldset>

      <Field
        id="item-backup"
        label="해지 전 백업 체크리스트"
        hint="한 줄에 하나씩 적어 주세요. 없으면 비워 둬요."
        wide
      >
        {(d) => (
          <textarea
            id="item-backup"
            className={styles.textarea}
            value={form.backupChecklist}
            aria-describedby={d}
            onChange={(e) => onChange({ backupChecklist: e.target.value })}
          />
        )}
      </Field>

      <fieldset className={`${styles.panel} ${styles.span}`}>
        <legend className={sheet.label}>학생 혜택 (없으면 비워 둬요)</legend>
        <div className={styles.formGrid}>
          <Field id="item-edu-desc" label="혜택 설명">
            {() => (
              <input
                id="item-edu-desc"
                className={sheet.input}
                value={form.eduDescription}
                aria-invalid={invalid('eduBenefit')}
                aria-describedby={errors.eduBenefit ? 'item-edu-error' : undefined}
                onChange={(e) => onChange({ eduDescription: e.target.value })}
              />
            )}
          </Field>
          <Field id="item-edu-url" label="혜택 안내 URL">
            {() => (
              <input
                id="item-edu-url"
                className={sheet.input}
                type="text"
                inputMode="url"
                value={form.eduUrl}
                aria-invalid={invalid('eduBenefit')}
                aria-describedby={errors.eduBenefit ? 'item-edu-error' : undefined}
                onChange={(e) => onChange({ eduUrl: e.target.value })}
              />
            )}
          </Field>
        </div>
        {errors.eduBenefit ? (
          <p id="item-edu-error" className={sheet.fieldError} role="alert">
            {errors.eduBenefit}
          </p>
        ) : null}
      </fieldset>

      <fieldset className={`${styles.panel} ${styles.span}`}>
        <legend className={sheet.label}>고객센터 (하나 이상)</legend>
        <div className={styles.formGrid}>
          <Field id="item-support-email" label="이메일">
            {() => (
              <input
                id="item-support-email"
                className={sheet.input}
                type="text"
                inputMode="email"
                value={form.supportEmail}
                aria-invalid={invalid('supportContact')}
                aria-describedby={errors.supportContact ? 'item-support-error' : undefined}
                onChange={(e) => onChange({ supportEmail: e.target.value })}
              />
            )}
          </Field>
          <Field id="item-support-url" label="문의 페이지 URL">
            {() => (
              <input
                id="item-support-url"
                className={sheet.input}
                type="text"
                inputMode="url"
                value={form.supportUrl}
                aria-invalid={invalid('supportContact')}
                aria-describedby={errors.supportContact ? 'item-support-error' : undefined}
                onChange={(e) => onChange({ supportUrl: e.target.value })}
              />
            )}
          </Field>
        </div>
        {errors.supportContact ? (
          <p id="item-support-error" className={sheet.fieldError} role="alert">
            {errors.supportContact}
          </p>
        ) : null}
      </fieldset>
    </div>
  );
}
