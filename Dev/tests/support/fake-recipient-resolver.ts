import type { Recipient, RecipientResolver } from '../../src/worker/ports/recipient-resolver';

/** 수신처 조회 대신 쓰는 테스트 더블. `set`으로 사용자별 수신처를 정해 둔다 */
export class FakeRecipientResolver implements RecipientResolver {
  private recipients = new Map<string, Recipient>();
  /** `resolve`가 불린 사용자 id. 외부 호출이 따르는 조회를 건너뛰었는지 확인할 때 쓴다 */
  calls: string[] = [];

  set(userId: string, recipient: Recipient): void {
    this.recipients.set(userId, recipient);
  }

  async resolve(userId: string): Promise<Recipient | null> {
    this.calls.push(userId);
    return this.recipients.get(userId) ?? null;
  }
}
