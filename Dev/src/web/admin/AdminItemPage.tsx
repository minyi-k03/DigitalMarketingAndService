import { useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { ApiRequestError, toApiError } from '../api/client';
import buttons from '../ui/buttons.module.css';
import { ErrorNotice } from '../ui/ErrorNotice';
import { Sheet } from '../ui/Sheet';
import skeleton from '../ui/skeleton.module.css';
import sheet from '../ui/sheetForm.module.css';
import { describeAdminError, type AdminFailure } from './admin-error';
import {
  useAdminItem,
  useChangePublication,
  useCreateItem,
  useFetchLatestItem,
  usePartners,
  useUpdateItem,
  type CatalogItem,
} from './api';
import type { Partner } from './partner-form';
import styles from './admin.module.css';
import {
  buildCreateRequest,
  buildUpdateRequest,
  emptyForm,
  formFromItem,
  type FormErrors,
  type ItemForm,
  type ItemKind,
} from './item-form';
import { ItemFields, type PartnersFailure } from './ItemFields';
import { LoadErrorNotice } from './LoadErrorNotice';
import {
  publicationLabel,
  publicationTransitions,
  type PublicationTransition,
} from './publication';

/** `/admin/catalog/new`(직접 검증한 서비스)·`/admin/catalog/new-sponsored`(파트너 체험 대리 제출) 등록 화면 */
export function AdminItemCreatePage({ kind }: { kind: ItemKind }) {
  return (
    <>
      <Link to="/admin" className={styles.back}>
        ← 서비스 목록
      </Link>
      <h2 className={styles.sectionTitle}>
        {kind === 'SPONSORED_TRIAL' ? '파트너 체험 대리 제출' : '새 서비스 등록'}
      </h2>
      {/* 두 등록 경로 사이를 이동해도 이전 kind의 입력값이 남지 않게 kind마다 새로 만든다 */}
      <CreateForm key={kind} kind={kind} />
    </>
  );
}

/** `/admin/catalog/:catalogItemId` 수정·게시 상태 화면 */
export function AdminItemEditPage() {
  const { catalogItemId = '' } = useParams();
  const query = useAdminItem(catalogItemId);

  return (
    <>
      <Link to="/admin" className={styles.back}>
        ← 서비스 목록
      </Link>
      {query.isPending ? (
        <div
          aria-busy="true"
          aria-label="불러오는 중"
          className={`${skeleton.block} ${styles.skeleton}`}
        />
      ) : query.isError ? (
        query.error instanceof ApiRequestError && query.error.problem.code === 'NOT_FOUND' ? (
          <ErrorNotice
            title="서비스를 찾을 수 없어요"
            detail="이미 삭제됐거나 주소가 바뀌었어요. 목록에서 다시 골라 주세요."
          />
        ) : (
          <LoadErrorNotice
            error={query.error}
            fallback={{
              title: '서비스를 불러오지 못했어요',
              detail: '네트워크 상태를 확인한 뒤 다시 시도해 주세요.',
            }}
            onRetry={() => void query.refetch()}
          />
        )
      ) : (
        <ItemEditor key={query.data.id} initial={query.data} />
      )}
    </>
  );
}

/** SPONSORED_TRIAL 폼에 넘길 파트너 목록과 조회 실패 상태. 다른 종류에는 아무것도 넘기지 않는다 */
function usePartnerChoices(sponsored: boolean): {
  partners: Partner[] | undefined;
  partnersFailure: PartnersFailure | undefined;
} {
  const query = usePartners({ enabled: sponsored });
  if (!sponsored) return { partners: undefined, partnersFailure: undefined };
  return {
    partners: query.data,
    partnersFailure: query.isError
      ? { error: query.error, onRetry: () => void query.refetch() }
      : undefined,
  };
}

function FailureNotice({ failure }: { failure: AdminFailure | null }) {
  return failure ? <ErrorNotice title={failure.title} detail={failure.detail} /> : null;
}

function CreateForm({ kind }: { kind: ItemKind }) {
  const navigate = useNavigate();
  const create = useCreateItem();
  const sponsored = kind === 'SPONSORED_TRIAL';
  const partnerChoices = usePartnerChoices(sponsored);
  const [form, setForm] = useState<ItemForm>(() => emptyForm(kind));
  const [errors, setErrors] = useState<FormErrors>({});
  const [failure, setFailure] = useState<AdminFailure | null>(null);

  function submit(e: FormEvent) {
    e.preventDefault();
    const request = buildCreateRequest(form);
    if (!request.ok) {
      setErrors(request.errors);
      setFailure(null);
      return;
    }
    setErrors({});
    setFailure(null);
    create.mutate(request.body, {
      onSuccess: () => navigate('/admin'),
      onError: (error) => {
        const next = describeAdminError(toApiError(error));
        setFailure(next);
        setErrors(next.fieldErrors);
      },
    });
  }

  return (
    <form className={sheet.form} onSubmit={submit} noValidate>
      <p className={styles.callout}>
        {sponsored
          ? '파트너를 대신해 제출하는 체험이에요. 제출하면 ‘검수 대기’ 상태로 저장되고, 서비스 목록에서 게시하거나 반려하기 전까지 사용자에게 보이지 않아요.'
          : '직접 해지 경로를 확인한 서비스만 등록해 주세요. 등록하면 바로 사용자에게 보여요.'}
      </p>
      <ItemFields
        form={form}
        errors={errors}
        editing={false}
        {...partnerChoices}
        onChange={(patch) => setForm((prev) => ({ ...prev, ...patch }))}
      />
      <FailureNotice failure={failure} />
      <div className={styles.buttonRow}>
        <button type="submit" className={buttons.primary} disabled={create.isPending}>
          {create.isPending ? '등록하는 중…' : sponsored ? '제출' : '등록'}
        </button>
        <Link to="/admin" className={buttons.utility}>
          취소
        </Link>
      </div>
    </form>
  );
}

function ItemEditor({ initial }: { initial: CatalogItem }) {
  const update = useUpdateItem(initial.id);
  const partnerChoices = usePartnerChoices(initial.kind === 'SPONSORED_TRIAL');
  // 저장·게시 상태 변경 응답을 받으면 이 값을 갈아 끼워, 이후 비교가 최신 서버 값을 기준으로 한다
  const [current, setCurrent] = useState(initial);
  const [form, setForm] = useState<ItemForm>(() => formFromItem(initial));
  const [markVerified, setMarkVerified] = useState(false);
  const [errors, setErrors] = useState<FormErrors>({});
  const [failure, setFailure] = useState<AdminFailure | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  function submit(e: FormEvent) {
    e.preventDefault();
    setMessage(null);
    const request = buildUpdateRequest(current, form, { markVerified });
    if (!request.ok) {
      if ('errors' in request) {
        setErrors(request.errors);
        setFailure(null);
      } else {
        setErrors({});
        setFailure(null);
        setMessage('바꾼 내용이 없어요.');
      }
      return;
    }
    setErrors({});
    setFailure(null);
    update.mutate(request.body, {
      onSuccess: (saved) => {
        setCurrent(saved);
        setForm(formFromItem(saved));
        setMarkVerified(false);
        setMessage('저장했어요.');
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
      <div className={styles.headRow}>
        <h2 className={styles.sectionTitle}>{current.name}</h2>
      </div>

      <PublicationPanel item={current} onChanged={setCurrent} />

      <form className={sheet.form} onSubmit={submit} noValidate>
        <ItemFields
          form={form}
          errors={errors}
          editing
          {...partnerChoices}
          onChange={(patch) => {
            setMessage(null);
            setForm((prev) => ({ ...prev, ...patch }));
          }}
        />

        <div className={styles.panel}>
          <label className={styles.check}>
            <input
              type="checkbox"
              checked={markVerified}
              onChange={(e) => setMarkVerified(e.target.checked)}
            />
            <span>
              해지 경로를 직접 확인했어요
              <br />
              <span className={sheet.note}>
                저장하면 마지막 확인일을 오늘로 바꿔요. 현재 확인일은 {current.lastVerifiedAt}
                이에요.
              </span>
            </span>
          </label>
        </div>

        <FailureNotice failure={failure} />
        {message ? (
          <p className={styles.success} role="status">
            {message}
          </p>
        ) : null}
        <div className={styles.buttonRow}>
          <button type="submit" className={buttons.primary} disabled={update.isPending}>
            {update.isPending ? '저장하는 중…' : '저장'}
          </button>
          <Link to="/admin" className={buttons.utility}>
            목록으로
          </Link>
        </div>
      </form>
    </>
  );
}

/** 게시 상태와 전이 버튼 (SPEC §2). 사용자에게 영향이 큰 전이는 확인 시트를 거친다 */
function PublicationPanel({
  item,
  onChanged,
}: {
  item: CatalogItem;
  onChanged: (item: CatalogItem) => void;
}) {
  const change = useChangePublication(item.id);
  const fetchLatest = useFetchLatestItem(item.id);
  const [pending, setPending] = useState<PublicationTransition | null>(null);
  const [failure, setFailure] = useState<AdminFailure | null>(null);
  const transitions = publicationTransitions(item.publicationStatus);

  function run(transition: PublicationTransition) {
    setFailure(null);
    change.mutate(transition.to, {
      onSuccess: (updated) => {
        setPending(null);
        onChanged(updated);
      },
      onError: (error) => {
        setPending(null);
        const next = describeAdminError(toApiError(error));
        setFailure(next);
        // 이미 상태가 바뀌었으면 버튼이 틀린 상태를 가리키지 않게 최신 항목으로 갈아 끼운다
        if (next.stale) void fetchLatest().then(onChanged, () => undefined);
      },
    });
  }

  return (
    <section className={styles.panel} aria-label="게시 상태">
      <div className={styles.headRow}>
        <p>
          게시 상태: <strong>{publicationLabel(item.publicationStatus)}</strong>
        </p>
        <div className={styles.buttonRow}>
          {transitions.map((t) => (
            <button
              key={t.to}
              type="button"
              className={buttons.utility}
              disabled={change.isPending}
              onClick={() => (t.confirm ? setPending(t) : run(t))}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>
      {transitions.length === 0 ? (
        <p className={sheet.note}>이 상태에서는 바꿀 수 있는 게시 상태가 없어요.</p>
      ) : null}
      <FailureNotice failure={failure} />

      {pending ? (
        <Sheet
          title={`${item.name}을(를) ${pending.label}할까요?`}
          onClose={() => setPending(null)}
        >
          <div className={sheet.form}>
            <p className={sheet.note}>
              {pending.to === 'UNPUBLISHED'
                ? '목록에는 ‘게시 중단’ 안내와 함께 남지만 새 체험 등록은 막혀요. 이미 진행 중인 체험은 그대로 이어져요. 다시 게시하는 기능은 아직 없어요.'
                : '이 결정은 되돌릴 수 없어요.'}
            </p>
            <div className={sheet.actions}>
              <button
                type="button"
                className={buttons.primary}
                disabled={change.isPending}
                onClick={() => run(pending)}
              >
                {change.isPending ? '처리하는 중…' : pending.label}
              </button>
              <button type="button" className={buttons.utility} onClick={() => setPending(null)}>
                취소
              </button>
            </div>
          </div>
        </Sheet>
      ) : null}
    </section>
  );
}
