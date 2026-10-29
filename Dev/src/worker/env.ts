export interface Env {
  DB: D1Database;
  // production에는 아직 R2가 없다(무료 플랜 조건, wrangler.jsonc 참고). 쓰는 코드는 undefined를 처리해야 한다
  BLOBS?: R2Bucket;
  NOTIFICATION_MODE: 'log' | 'kakao_memo' | 'dealer';
  // Workers Secrets (로컬은 .dev.vars). 소스·설정 파일에 값을 넣지 않는다 (AGENTS.md §6)
  KAKAO_CLIENT_ID: string;
  KAKAO_CLIENT_SECRET: string;
  SESSION_SIGNING_KEY: string;
  KAKAO_TOKEN_ENCRYPTION_KEY: string;
}
