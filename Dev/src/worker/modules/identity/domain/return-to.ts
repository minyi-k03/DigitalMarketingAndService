/**
 * 로그인 후 돌아갈 경로는 구독컷 내부 경로만 허용한다 (열린 리다이렉트 방지, SPEC §15, architecture §9).
 * `/`로 시작하고 `//`·`/\`(브라우저가 외부로 해석)와 제어 문자는 허용하지 않는다.
 */
export function isInternalPath(value: string): boolean {
  if (!value.startsWith('/')) return false;
  if (value.startsWith('//') || value.startsWith('/\\')) return false;
  // eslint-disable-next-line no-control-regex
  return !/[\u0000-\u001f\u007f]/.test(value);
}
