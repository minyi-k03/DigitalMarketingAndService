import { HttpKakaoOAuthClient } from './adapters/kakao-oauth';
import type { Env } from './env';
import { createApp } from './http/app';
import type { AppDeps } from './http/deps';
import { createConsoleLogger } from './http/logger';
import { createCatalogService } from './modules/catalog';
import { createIdentityService } from './modules/identity';
import { SystemClock } from './platform/clock';

// composition root: 환경 바인딩으로 의존성을 만들어 주입한다.
function buildDeps(env: Env): AppDeps {
  const clock = new SystemClock();
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
    // 발송 디스패처(T17)가 생기기 전까지는 이 값을 쓰는 곳이 없다.
    recipientResolver: { resolve: async () => null },
  });
  const catalog = createCatalogService({ db: env.DB, clock });
  return { clock, db: env.DB, logger: createConsoleLogger(), identity, catalog };
}

export default {
  fetch: (request, env, ctx) => createApp(buildDeps(env)).fetch(request, env, ctx),
  async scheduled() {
    // T17(발송 디스패처)·T18(MISSED_BILLED 배치)에서 구현한다.
  },
} satisfies ExportedHandler<Env>;
