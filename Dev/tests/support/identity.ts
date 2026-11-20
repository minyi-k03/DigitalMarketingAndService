import { env } from 'cloudflare:test';
import { createIdentityService } from '../../src/worker/modules/identity';
import type { Clock } from '../../src/worker/platform/clock';
import { FakeKakaoOAuthClient } from './fake-kakao-oauth';
import { FakeRecipientResolver } from './fake-recipient-resolver';

/** 실제 D1과 실제 Identity 서비스. 카카오와 수신처 조회만 테스트 더블이다 */
export function buildIdentity(clock: Clock) {
  const kakao = new FakeKakaoOAuthClient();
  const recipients = new FakeRecipientResolver();
  const identity = createIdentityService({
    db: env.DB,
    clock,
    kakao,
    sessionSigningKey: 'test-session-signing-key',
    tokenEncryptionKey: btoa('0123456789abcdef0123456789abcdef'),
    notificationMode: 'kakao_memo',
    recipientResolver: recipients,
  });
  return { identity, kakao, recipients };
}
