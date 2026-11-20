import type { Logger } from './http/logger';
import type { TrialTrackingService } from './modules/trial-tracking';

/** 10분 주기 알림 발송 (wrangler.jsonc `triggers.crons`와 같은 표현식) */
export const DISPATCH_CRON = '*/10 * * * *';
/** 매일 15:10 UTC(KST 00:10) `MISSED_BILLED` 배치. 구현은 T18 */
export const MISSED_BILLED_CRON = '10 15 * * *';

export interface ScheduledDeps {
  trialTracking: Pick<TrialTrackingService, 'dispatchDueNotifications'>;
  logger: Pick<Logger, 'info' | 'error'>;
  /** 현재 `NOTIFICATION_MODE`의 발송 어댑터가 구현돼 있는지 */
  canSend: boolean;
}

/**
 * Cron Trigger 하나를 처리한다 (architecture §5.6). 표현식으로 작업을 가른다.
 * 예기치 않은 오류는 던지지 않고 종류만 기록한다. 선점하지 못한 슬롯은 `PENDING`이고
 * 선점하고 죽은 슬롯은 15분 뒤 복구되므로 다음 회차가 이어받는다.
 */
export async function runScheduled(cron: string, deps: ScheduledDeps): Promise<void> {
  if (cron !== DISPATCH_CRON) return; // MISSED_BILLED_CRON은 T18에서 연결한다

  if (!deps.canSend) {
    deps.logger.error('notification_sender_unavailable');
    return;
  }
  try {
    const result = await deps.trialTracking.dispatchDueNotifications();
    deps.logger.info('notification_dispatch', { ...result });
  } catch (e) {
    // 오류 메시지에는 수신처 정보가 섞일 수 있어 종류만 남긴다 (SPEC §15)
    deps.logger.error('notification_dispatch_failed', {
      name: e instanceof Error ? e.name : 'unknown',
    });
  }
}
