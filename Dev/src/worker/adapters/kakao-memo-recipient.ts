import type { Recipient, RecipientResolver } from '../ports/recipient-resolver';

/**
 * `NOTIFICATION_MODE=kakao_memo`의 수신처 조회 (D-16). access token은 Identity의
 * `getKakaoMessageAccessToken`으로만 얻는다. 이 함수가 토큰 갱신과 교체 저장을 맡는다 (AGENTS §4).
 * 동의가 없거나 만료돼 `null`이면 수신처가 없어 그 슬롯은 `SKIPPED`다. 카카오 API 오류는 던지고 재시도는
 * 디스패처가 맡는다.
 */
export class KakaoMemoRecipientResolver implements RecipientResolver {
  constructor(private readonly getAccessToken: (userId: string) => Promise<string | null>) {}

  async resolve(userId: string): Promise<Recipient | null> {
    const accessToken = await this.getAccessToken(userId);
    return accessToken === null ? null : { channel: 'KAKAO_MEMO', accessToken };
  }
}
