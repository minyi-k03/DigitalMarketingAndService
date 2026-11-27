import type { components } from '../../shared/api-types';

// `../api/me`는 브라우저 전용 모듈(fetch·window)을 끌고 오므로, 순수 로직은 공용 타입에서 직접 가져온다
type Me = components['schemas']['Me'];

export type AdminAccess = 'LOADING' | 'LOGIN' | 'FORBIDDEN' | 'OK';

/**
 * 관리 콘솔을 보여 줄지 정한다. 화면 분기용일 뿐이며 권한은 서버가 `/api/admin*`에서 다시 검사한다 (SPEC §16).
 * `undefined`는 내 정보를 아직 불러오는 중, `null`은 로그인하지 않은 상태다.
 */
export function adminAccess(me: Pick<Me, 'role'> | null | undefined): AdminAccess {
  if (me === undefined) return 'LOADING';
  if (me === null) return 'LOGIN';
  return me.role === 'USER' ? 'FORBIDDEN' : 'OK';
}
