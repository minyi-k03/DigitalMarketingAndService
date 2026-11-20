import type { components } from '../../../../shared/api-types';
import { todayKst, toUtcInstant, type UtcInstant } from '../../../../shared/kst-date';
import { DomainError } from '../../../platform/errors';
import type { CatalogService } from '../../catalog';
import type { TrialTrackingDeps } from '../deps';
import { planCancelConfirmSlots, type PlannedSlot } from '../domain/notification-planner';
import { savedAmountOnConfirm } from '../domain/saved-amount';
import { applyTransition, type Transition, type TrialEvent } from '../domain/transitions';
import { prepareExitPollInsert } from '../infra/exit-poll-repo';
import {
  prepareSlotInserts,
  preparePendingSlotCancel,
  readSendTime,
  type NotificationKind,
} from '../infra/notification-repo';
import { prepareStatusUpdate, type ExitReason, type TrialRecord } from '../infra/trial-repo';
import { toTrialRecordView, type TrialRecordView } from './to-trial-record-view';
import { conflict, loadOwned, runBatch, type TrialRecordRef } from './trial-command-support';

type TrackingTerms = Awaited<ReturnType<CatalogService['getTrackingTerms']>>;
export type StartCancelAttemptResult = components['schemas']['StartCancelAttemptResult'];

export type { TrialRecordRef };

export interface StartCancelAttemptCommand extends TrialRecordRef {
  exitReason: ExitReason;
}

interface TransitionContext {
  record: TrialRecord;
  transition: Transition;
  terms: TrackingTerms;
  now: UtcInstant;
}

/** 명령마다 다른 부분: 전이와 함께 바꿀 필드, 새로 저장할 ExitPoll 응답, 취소할 알림 종류 */
interface TransitionEffects {
  fields?: Partial<Pick<TrialRecord, 'cancelAttemptedAt' | 'confirmedAt' | 'savedAmount'>>;
  newExitReason?: ExitReason;
  /** 종료 상태가 아닌 전이에서 취소할 `PENDING` 알림 종류. 종료 상태로 가면 지정 없이 모두 취소한다 */
  cancelPendingKinds?: readonly NotificationKind[];
  /** 전이 뒤에 새로 예약할 알림. 취소 뒤에 같은 batch로 저장한다 */
  newSlots?: readonly PlannedSlot[];
}

/**
 * 전이 하나를 D1 batch 한 번으로 저장한다 (architecture §5.2·§5.3).
 * - 상태 UPDATE는 `WHERE status = :from` 조건부이고, 0행이면 다른 요청이 먼저 바꾼 것이라 `CONFLICT`다.
 * - ExitPoll 응답 INSERT는 같은 batch에서 UPDATE가 반영됐을 때만 들어가고, PK 충돌이면 batch 전체가 롤백된다.
 */
async function commitTransition(
  deps: TrialTrackingDeps,
  ref: TrialRecordRef,
  event: TrialEvent,
  effects: (ctx: TransitionContext) => TransitionEffects = () => ({}),
): Promise<{ record: TrialRecord; terms: TrackingTerms }> {
  const record = await loadOwned(deps, ref);
  const now = toUtcInstant(deps.clock.now());
  const transition = applyTransition(record, event, now);
  const terms = await deps.catalog.getTrackingTerms(record.catalogItemId);
  const {
    fields = {},
    newExitReason,
    cancelPendingKinds,
    newSlots = [],
  } = effects({
    record,
    transition,
    terms,
    now,
  });

  const next: TrialRecord = {
    ...record,
    ...fields,
    status: transition.to,
    statusChangedAt: transition.statusChangedAt,
    ...(newExitReason !== undefined && { exitReason: newExitReason }),
  };
  const statements = [prepareStatusUpdate(deps.db, transition.from, next)];
  if (newExitReason !== undefined) {
    statements.push(
      prepareExitPollInsert(
        deps.db,
        {
          trialRecordId: record.id,
          catalogItemId: record.catalogItemId,
          serviceCategory: terms.serviceCategory,
          reason: newExitReason,
          respondedAt: now,
        },
        transition.to,
      ),
    );
  }
  if (transition.toTerminal) {
    // 종료 상태로 가면 예약된 알림을 모두 취소한다 (SPEC §6)
    statements.push(preparePendingSlotCancel(deps.db, record.id, transition.to));
  } else if (cancelPendingKinds !== undefined) {
    statements.push(
      preparePendingSlotCancel(deps.db, record.id, transition.to, cancelPendingKinds),
    );
  }
  // 새 알림은 같은 batch에서 전이가 반영됐을 때만 들어간다
  statements.push(...prepareSlotInserts(deps.db, record.id, newSlots, transition.to));

  const [update] = await runBatch(deps.db, statements);
  if (update?.meta.changes !== 1) throw conflict();
  return { record: next, terms };
}

function toView(deps: TrialTrackingDeps, record: TrialRecord, terms: TrackingTerms) {
  return toTrialRecordView(record, terms.name, todayKst(deps.clock));
}

/**
 * 브릿지 사유 선택 (SPEC §5, §7 단일 명령, 스토리 20·21·25). 응답 저장과 CANCEL_ATTEMPTED 전이를
 * 한 batch로 처리하고 이동할 직링크를 돌려준다. 아직 보내지 않은 탈출 알림(D3·D1·늦은 등록)은 같은 batch에서
 * 취소하고, 그 자리에 해지 확인 알림(D1_CONFIRM·SAME_DAY_CONFIRM, 계획기 `planCancelConfirmSlots`)을 저장한다.
 */
export async function startCancelAttempt(
  deps: TrialTrackingDeps,
  cmd: StartCancelAttemptCommand,
): Promise<StartCancelAttemptResult> {
  const settings = { sendTime: await readSendTime(deps.db) };
  const { record } = await commitTransition(
    deps,
    cmd,
    'START_CANCEL_ATTEMPT',
    ({ record, now }) => ({
      fields: { cancelAttemptedAt: now },
      newExitReason: cmd.exitReason,
      cancelPendingKinds: ['ESCAPE_ALERT'],
      newSlots: planCancelConfirmSlots(record, now, settings),
    }),
  );
  const escape = await deps.catalog.getEscapeContent(record.catalogItemId);
  return {
    escapeLink: escape.escapeLink,
    ...(escape.escapeLinkFallbackUrl !== undefined && {
      escapeLinkFallbackUrl: escape.escapeLinkFallbackUrl,
    }),
    escapePattern: escape.escapePattern,
    ...(escape.forcedChannel !== undefined && { forcedChannel: escape.forcedChannel }),
  };
}

export interface ConfirmCancelCommand extends TrialRecordRef {
  /** 기록에 응답이 없으면(TRACKING에서 확정) 필수. 이미 응답이 있으면 무시하고 기존 응답을 보존한다 */
  exitReason?: ExitReason;
}

/**
 * 응답이 없는 기록이면 요청의 사유를 새 응답으로 쓰고, 사유도 없으면 `EXIT_POLL_REQUIRED`다.
 * 이미 응답이 있으면 요청 사유는 버린다(기록당 1건, SPEC §5 불변식. 2026-11-13 사용자 결정).
 */
function exitPollForConfirm(record: TrialRecord, requested: ExitReason | undefined) {
  if (record.exitReason !== undefined) return undefined;
  if (requested === undefined) {
    throw new DomainError('EXIT_POLL_REQUIRED', '해지 사유를 하나 골라 주세요');
  }
  return requested;
}

/** 해지 완료 확정 (SPEC §5, §8, 스토리 28·30) */
export async function confirmCancel(deps: TrialTrackingDeps, cmd: ConfirmCancelCommand) {
  const { record, terms } = await commitTransition(
    deps,
    cmd,
    'CONFIRM_CANCEL',
    ({ record, transition, terms, now }) => ({
      fields: {
        confirmedAt: now,
        savedAmount: savedAmountOnConfirm(
          transition.from,
          record.safeEndDate,
          now,
          terms.monthlyPrice,
        ),
      },
      newExitReason: exitPollForConfirm(record, cmd.exitReason),
    }),
  );
  return toView(deps, record, terms);
}

export interface ResolveMissedBillingCommand extends TrialRecordRef {
  resolution: 'BILLED' | 'CANCELED_BEFORE_BILLING' | 'KEEP_USING';
  /** CANCELED_BEFORE_BILLING이고 기존 응답이 없으면 필수 */
  exitReason?: ExitReason;
}

const RESOLUTION_EVENTS: Record<ResolveMissedBillingCommand['resolution'], TrialEvent> = {
  BILLED: 'RESOLVE_BILLED',
  CANCELED_BEFORE_BILLING: 'RESOLVE_CANCELED_BEFORE_BILLING',
  KEEP_USING: 'RESOLVE_KEEP_USING',
};

/**
 * 결제 확인 정정 (SPEC §5, 스토리 31). '결제 전에 해지했어요'는 SafeEndDate가 지난 뒤의 확정이므로
 * 합산하지 않고(§8), 응답이 없던 기록이면 응답을 함께 저장한다.
 */
export async function resolveMissedBilling(
  deps: TrialTrackingDeps,
  cmd: ResolveMissedBillingCommand,
) {
  const { record, terms } = await commitTransition(
    deps,
    cmd,
    RESOLUTION_EVENTS[cmd.resolution],
    ({ record, now }) =>
      cmd.resolution === 'CANCELED_BEFORE_BILLING'
        ? {
            fields: { confirmedAt: now, savedAmount: null },
            newExitReason: exitPollForConfirm(record, cmd.exitReason),
          }
        : {},
  );
  return toView(deps, record, terms);
}

/** 유지 결정 (SPEC §5, 스토리 29). CANCEL_ATTEMPTED에서 왔으면 기존 응답을 보존한다 */
export async function decideKeep(deps: TrialTrackingDeps, ref: TrialRecordRef) {
  const { record, terms } = await commitTransition(deps, ref, 'DECIDE_KEEP');
  return toView(deps, record, terms);
}

/** 등록 취소 '가입 안 했어요' (SPEC §3, §5, 스토리 10). TRACKING에서만 허용한다 */
export async function voidTrialRecord(deps: TrialTrackingDeps, ref: TrialRecordRef) {
  const { record, terms } = await commitTransition(deps, ref, 'VOID');
  return toView(deps, record, terms);
}

/** 기록 상세 (SPEC §13). 남의 기록은 NOT_FOUND다 */
export async function getTrialRecord(
  deps: TrialTrackingDeps,
  ref: TrialRecordRef,
): Promise<TrialRecordView> {
  const record = await loadOwned(deps, ref);
  const terms = await deps.catalog.getTrackingTerms(record.catalogItemId);
  return toView(deps, record, terms);
}
