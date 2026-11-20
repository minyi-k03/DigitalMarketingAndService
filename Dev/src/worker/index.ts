import { HttpKakaoOAuthClient } from './adapters/kakao-oauth';
import { createNotificationSender } from './adapters/select-sender';
import type { Env } from './env';
import { createApp } from './http/app';
import type { AppDeps } from './http/deps';
import { createConsoleLogger } from './http/logger';
import { createCatalogService } from './modules/catalog';
import { createIdentityService } from './modules/identity';
import { createTrialTrackingService } from './modules/trial-tracking';
import { SystemClock } from './platform/clock';
import { runScheduled } from './scheduled';

// composition root: 환경 바인딩으로 의존성을 만들어 주입한다.
function buildDeps(env: Env) {
  const clock = new SystemClock();
  const logger = createConsoleLogger();
  const identity = createIdentityService({
    db: env.DB,
    clock,
    kakao: new HttpKakaoOAuthClient({
      clientId: env.KAKAO_CLIENT_ID,
      clientSecret: env.KAKAO_CLIENT_SECRET,
    }),
    sessionSigningKey: env.SESSION_SIGNING_KEY,
    tokenEncryptionKey: env.KAKAO_TOKEN_ENCRYPTION_KEY,
    notificationMode: env.NOTIFICATION_MODE,
    // 실제 수신처 조회는 T34(kakao_memo)·T31(dealer)에서 어댑터와 함께 교체한다.
    // 그 전까지 발송 디스패처(T17)는 모든 슬롯을 수신처 없음(SKIPPED)으로 닫는다.
    recipientResolver: { resolve: async () => null },
  });
  const catalog = createCatalogService({ db: env.DB, clock });
  // 구현되지 않은 모드(kakao_memo는 T34, dealer는 T31)는 어댑터가 없고 디스패처는 슬롯을 선점하지 않는다
  const sender = createNotificationSender(env.NOTIFICATION_MODE, logger);
  const trialTracking = createTrialTrackingService({
    db: env.DB,
    clock,
    catalog,
    identity,
    sender,
  });
  const app: AppDeps = { clock, db: env.DB, logger, identity, catalog, trialTracking };
  return { app, canSend: sender !== undefined };
}

export default {
  fetch: (request, env, ctx) => createApp(buildDeps(env).app).fetch(request, env, ctx),
  scheduled: (controller, env, ctx) => {
    const { app, canSend } = buildDeps(env);
    // 끝날 때까지 Worker를 유지한다. T18에서 MISSED_BILLED 배치도 같은 진입점으로 연결한다
    ctx.waitUntil(
      runScheduled(controller.cron, {
        trialTracking: app.trialTracking,
        logger: app.logger,
        canSend,
      }),
    );
  },
} satisfies ExportedHandler<Env>;
