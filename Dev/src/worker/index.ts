import { HttpKakaoOAuthClient } from './adapters/kakao-oauth';
import type { Env } from './env';
import { createApp } from './http/app';
import type { AppDeps } from './http/deps';
import { createConsoleLogger } from './http/logger';
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
  });
  return { clock, db: env.DB, logger: createConsoleLogger(), identity };
}

export default {
  fetch: (request, env, ctx) => createApp(buildDeps(env)).fetch(request, env, ctx),
  async scheduled() {
    // T17(발송 디스패처)·T18(MISSED_BILLED 배치)에서 구현한다.
  },
} satisfies ExportedHandler<Env>;
