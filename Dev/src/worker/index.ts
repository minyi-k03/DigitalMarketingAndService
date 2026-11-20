import { HttpKakaoOAuthClient } from './adapters/kakao-oauth';
import { KakaoMemoRecipientResolver } from './adapters/kakao-memo-recipient';
import { createNotificationSender } from './adapters/select-sender';
import type { Env } from './env';
import { createApp } from './http/app';
import type { AppDeps } from './http/deps';
import { createConsoleLogger } from './http/logger';
import { createCatalogService } from './modules/catalog';
import { createIdentityService, type IdentityService } from './modules/identity';
import { createTrialTrackingService } from './modules/trial-tracking';
import { SystemClock } from './platform/clock';
import { runScheduled } from './scheduled';

// composition root: 환경 바인딩으로 의존성을 만들어 주입한다.
function buildDeps(env: Env) {
  const clock = new SystemClock();
  const logger = createConsoleLogger();
  const identity: IdentityService = createIdentityService({
    db: env.DB,
    clock,
    kakao: new HttpKakaoOAuthClient({
      clientId: env.KAKAO_CLIENT_ID,
      clientSecret: env.KAKAO_CLIENT_SECRET,
    }),
    sessionSigningKey: env.SESSION_SIGNING_KEY,
    tokenEncryptionKey: env.KAKAO_TOKEN_ENCRYPTION_KEY,
    notificationMode: env.NOTIFICATION_MODE,
    // kakao_memo(D-16)는 Identity 자신의 토큰 갱신을 수신처 조회로 쓴다(호출 시점에 identity가 만들어져 있다).
    // log는 보내지 않으므로 수신처가 없고, dealer(T31)는 아직 없어 그 모드의 슬롯은 SKIPPED로 닫힌다.
    recipientResolver:
      env.NOTIFICATION_MODE === 'kakao_memo'
        ? new KakaoMemoRecipientResolver((userId) => identity.getKakaoMessageAccessToken(userId))
        : { resolve: async () => null },
  });
  const catalog = createCatalogService({ db: env.DB, clock });
  // 만들 수 없는 모드(dealer는 T31 전, staging의 kakao_memo)는 어댑터가 없고 디스패처는 슬롯을 선점하지 않는다
  const sender = createNotificationSender(env.NOTIFICATION_MODE, logger, {
    appEnv: env.APP_ENV,
    appOrigin: env.APP_ORIGIN,
  });
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
    // 끝날 때까지 Worker를 유지한다. 표현식에 따라 디스패치(`*/10`) 또는 MISSED_BILLED 배치(`10 15`)가 돈다
    ctx.waitUntil(
      runScheduled(controller.cron, {
        trialTracking: app.trialTracking,
        logger: app.logger,
        canSend,
      }),
    );
  },
} satisfies ExportedHandler<Env>;
