import type { IdentityService } from '../modules/identity';
import type { Clock } from '../platform/clock';
import type { Logger } from './logger';

/** composition root(index.ts)가 만들어 HTTP 앱에 주입하는 의존성. 모듈·포트가 생기면 여기에 더한다 */
export interface AppDeps {
  clock: Clock;
  db: D1Database;
  logger: Logger;
  identity: IdentityService;
}
