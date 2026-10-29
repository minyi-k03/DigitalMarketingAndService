# progress.md

세션 간 진행 기록이다. TASK별 상태(`대기`/`진행`/`완료`)와 완료 기준은 [`tasks.md`](tasks.md)가 원본이며 여기에는 적지 않는다.
세션을 시작할 때 이 파일과 최근 `git log`를 읽고 `npm run verify`를 먼저 실행해 기준 상태를 확인한다. 세션을 끝낼 때 아래 두 절을 갱신한다.

## 마지막 verify

| 날짜 | 명령 | 결과 |
| :--- | :--- | :--- |
| 2026-10-28 | `npm run verify` | 통과 (lint, typecheck, test 170건, build). T06 완료 시점 |

## 세션 로그

- 2026-10-28 · Claude Code · T01~T04 완료(스캐폴드, shared kernel, 마이그레이션 0001, HTTP 골격), ADR-0008 갱신. 모두 미커밋. 다음: T08(N8 무관) 또는 N8 후 T05.
- 2026-10-28 · Claude Code · T05 완료(모의 검증): Identity 모듈, 카카오 OAuth 포트·어댑터, 세션·로그인 라우트. 실제 카카오 로그인은 N8(앱 등록)과 비밀값 설정 후 확인. 미커밋. 다음: T08 또는 T06·T07.
- 2026-10-28 · Claude Code · T01~T05 `/code-review` 후 수정 6건: 카카오 어댑터 fetch 바인딩, 로그인 CSRF(nonce 쿠키 대조), 오류 로그에서 메시지 제거, 콜백 `error` 처리, `/api/me` 401 `loginUrl`, 버전 서술 정정. openapi 계약 변경(승인): `INTERNAL_ERROR` 코드 추가, 로그인 시작 400·nonce 쿠키, 콜백 `error` 처리·nonce 쿠키 삭제. `/api/health`는 계약에 넣지 않기로 함(코드에는 유지). 미결: 401 returnTo 설계(SPA와 합의, T25 전). 리뷰의 smell 항목은 미처리(기능 결함 아님).
- 2026-10-28 · Claude Code · T06 완료(발표용 간소화): `requireRole`, `/api/admin/*` 기본 가드(OPERATOR 이상), ADMIN 시드 스크립트(`npm run seed:admin`). 시드는 로컬 D1에서 수동 확인했고 원격(`--remote`)은 실행하지 않음. 로컬 D1에 마이그레이션 0001 적용됨. 미커밋. 다음: T07 또는 T08.
- 2026-10-29 · Claude Code · N7 일부 완료(Cloudflare 무료 계정, `wrangler login` 확인, 계정 서브도메인 `june18806.workers.dev`). 무료 플랜 조건으로 R2 바인딩을 `wrangler.jsonc`에서 제거하고 `Env.BLOBS`를 선택 타입으로 변경(R2 사용 여부는 T09 이후 결정, ADR-0008의 R2는 보류 상태). production Worker 이름을 `subcut`으로 명시. 원격 리소스는 아직 만들지 않음. 다음: 빈 Worker 배포(D1 생성 → database_id 교체 → 원격 마이그레이션 → deploy, 각 단계 승인).
- 2026-10-29 · Claude Code · **빈 Worker 첫 배포 완료(T32 일부, M1)**: 대시보드에서 D1 `subcut-production` 생성(CLI `d1 create`는 Authentication error 10000으로 실패, 원인 미확인), `database_id` 교체, 원격 마이그레이션 0001 적용(테이블 12개, app_settings 3행, users 0건 확인), `wrangler deploy --env production` → https://subcut.june18806.workers.dev (Version d144046a, Cron 2개 등록). 배포 후 GET 확인: `/` 200, `/api/health` 200, `/api/me` 401(loginUrl 포함), `/api/nope` 404, SPA 경로 200. 비밀값 미등록이라 `/auth/kakao/login`은 500(예상된 동작, 로그인 불가). 다음: N8 카카오 앱 등록 → 로컬 로그인 확인 → 비밀값 등록(승인 필요).
