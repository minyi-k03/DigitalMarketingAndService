type BrandMarkProps = {
  size?: number;
};

/**
 * 구독컷 마크(잘린 체험권). 네트워크 요청 없이 바로 그리려고 코드에 둔다.
 * 같은 모양의 파일은 `public/logo-mark.svg`(원본), `favicon.svg`, PWA 아이콘이다. 모양을 바꾸면 함께 고친다.
 */
export function BrandMark({ size = 30 }: BrandMarkProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden="true" focusable="false">
      <path
        d="M12 16H38V48H12Q6 48 6 42V37A5 5 0 0 0 6 27V22Q6 16 12 16Z"
        fill="var(--color-primary)"
      />
      <rect x="14" y="24" width="17" height="4.5" rx="2.25" fill="#ffffff" />
      <rect x="14" y="34" width="11" height="4.5" rx="2.25" fill="#ffffff" />
      <line
        x1="41"
        y1="14"
        x2="41"
        y2="50"
        stroke="var(--color-accent-orange)"
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeDasharray="0.1 5"
      />
      <g transform="rotate(9 50 32)">
        <path
          d="M44 16H52Q58 16 58 22V27A5 5 0 0 0 58 37V42Q58 48 52 48H44Z"
          fill="var(--color-accent-sky)"
        />
      </g>
    </svg>
  );
}
