export type LoginErrorNotice = {
  title: string;
  /** 무엇이 일어났고 어떻게 하면 되는지 */
  detail: string;
};

/**
 * 카카오 로그인이 끝나지 않고 돌아오면 서버가 `/?loginError=...`로 보낸다.
 * `search`는 `location.search`(예: `?loginError=access_denied`)다.
 */
export function loginErrorNotice(search: string): LoginErrorNotice | null {
  const reason = new URLSearchParams(search).get('loginError');

  if (reason === 'access_denied') {
    return {
      title: '카카오 로그인을 취소했어요',
      detail: '구독컷을 쓰려면 카카오 로그인이 필요해요. 준비되면 다시 로그인해 주세요.',
    };
  }
  if (reason === 'failed') {
    return {
      title: '로그인하지 못했어요',
      detail: '잠시 뒤에 다시 로그인해 주세요. 계속 안 되면 카카오 계정 상태를 확인해 주세요.',
    };
  }
  return null;
}
