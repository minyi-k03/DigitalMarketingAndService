/** 원 단위 금액 표기. 화면 로직(순수 함수)에서도 쓰므로 JSX 모듈과 분리해 둔다 */
export function won(amount: number): string {
  return `${amount.toLocaleString('ko-KR')}원`;
}
