import { describe, expect, it } from 'vitest';
import { KakaoMemoRecipientResolver } from '../../src/worker/adapters/kakao-memo-recipient';

describe('kakao-memo 수신처 조회 [S13][V-10][T34]', () => {
  it('Identity가 돌려준 access token을 KAKAO_MEMO 수신처로 만든다', async () => {
    const resolver = new KakaoMemoRecipientResolver(async (userId) => `token-of-${userId}`);

    expect(await resolver.resolve('user-1')).toEqual({
      channel: 'KAKAO_MEMO',
      accessToken: 'token-of-user-1',
    });
  });

  it('동의가 없거나 만료돼 토큰이 null이면 수신처가 없다 (그 슬롯은 SKIPPED)', async () => {
    const resolver = new KakaoMemoRecipientResolver(async () => null);

    expect(await resolver.resolve('user-1')).toBeNull();
  });

  it('토큰 갱신 중 카카오 API 오류는 삼키지 않고 던진다 (디스패처가 재시도한다)', async () => {
    const resolver = new KakaoMemoRecipientResolver(async () => {
      throw new Error('kakao 503');
    });

    await expect(resolver.resolve('user-1')).rejects.toThrow('kakao 503');
  });
});
