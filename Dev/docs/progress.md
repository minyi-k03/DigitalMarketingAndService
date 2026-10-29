# progress.md

세션 간 진행 기록이다. TASK별 상태(`대기`/`진행`/`완료`)와 완료 기준은 [`tasks.md`](tasks.md)가 원본이며 여기에는 적지 않는다.
세션을 시작할 때 이 파일과 최근 `git log`를 읽고 `npm run verify`를 먼저 실행해 기준 상태를 확인한다. 세션을 끝낼 때 아래 "마지막 verify"와 "다음 할 일"을 갱신하고 "세션 로그"에 항목을 더한다.

## 다음 할 일

2026-10-29 기준. 위에서부터 진행한다. 원격 변경은 단계마다 사용자 승인을 받는다(AGENTS §6).

1. **배포 환경 비밀값 등록 (승인 필요)**: `wrangler secret put <이름> --env production`으로 `https://subcut.june18806.workers.dev`에 4개를 등록한다.
   - `KAKAO_CLIENT_ID`, `KAKAO_CLIENT_SECRET`은 로컬과 같은 앱이므로 `.dev.vars` 값을 쓴다.
   - `SESSION_SIGNING_KEY`, `KAKAO_TOKEN_ENCRYPTION_KEY`는 로컬 값을 복사하지 않고 **production용 새 값**을 만든다(AGENTS §6). 32바이트 난수의 base64(44자)이며 PowerShell의 `RandomNumberGenerator`로 만든다.
   - 값은 대화·로그·캡처에 표시하지 않는다. 등록 후에는 이름 목록(`wrangler secret list`)만 확인한다.
2. **production 로그인 시험**: 브라우저에서 `https://subcut.june18806.workers.dev/auth/kakao/login`(앱 소유자 계정)으로 로그인하고 `/api/me`를 확인한다. 원격 D1 조회는 승인 후, 개수·동의 범위만 본다(식별값 조회 금지). 통과하면 `tasks.md` T05의 "배포 환경 확인 필요" 문구를 정리한다.
3. **최초 ADMIN 시드(선택)**: `npm run seed:admin -- <카카오 회원번호>`(로컬) 또는 `--remote`(production, 승인 필요). 먼저 그 계정으로 로그인해 `users` 행이 있어야 한다.
4. **T07 착수 전 결정**: `Me.hasRecipient` 판정 기준. 지금은 전화번호 유무로 판정해 `kakao_memo`(D-16) 환경에서는 동의한 사용자도 `false`다. `RecipientResolver` 기준으로 통일할지 정하고, 바꾸면 openapi 설명도 갱신한다(`tasks.md` T07 참고).
5. **다음 주(11/3~11/9) 계획**: T07, T08, T09(간소), T10. Antigravity는 T25를 시작하며, 화면 TASK는 해당 API TASK를 사용자가 커밋한 뒤에 시작한다.

미결·보류 사항
- 401 `loginUrl`의 returnTo가 API 경로(`/api/me`)다. SPA가 자기 화면 경로를 넘기는 방식으로 합의가 필요하다(T25 전).
- R2는 무료 플랜(카드 등록 없음) 때문에 보류했다. 로고 업로드가 필요한 T09 이후 사용 여부를 정한다. ADR-0008의 R2는 보류 상태다.
- CLI `wrangler d1 create`가 `Authentication error 10000`으로 실패한 원인은 미확인이다(대시보드로 생성해 진행에는 지장 없음).
- 미확인 동작: `invalid_grant` 응답 형식, 로그아웃·세션 만료의 실환경 확인, 실제 '나에게 보내기' 발송(T34).
- 로컬 `.wrangler/` D1에는 마이그레이션 0001이 적용돼 있고 본인 계정 사용자 1건이 있다(git 제외).

작업 방식 메모
- 비밀값(클라이언트 시크릿, `.dev.vars` 값)은 대화·캡처에 노출하지 않는다. 한 번 노출돼 재발급한 적이 있다.
- 외부 에이전트(Gemini) `/code-review` 결과는 코드로 검증한 뒤 타당한 것만 반영한다.
- 구현은 `tdd`(합의한 seam만), 완료 보고 전 `verification-before-completion`, 리뷰는 `code-review`(AGENTS §5).

## 마지막 verify

| 날짜 | 명령 | 결과 |
| :--- | :--- | :--- |
| 2026-10-29 | `npm run verify` | 통과 (lint, typecheck, test 170건, build). 외부 리뷰 반영 후 |

## 세션 로그

- 2026-10-28 · Claude Code · T01~T04 완료(스캐폴드, shared kernel, 마이그레이션 0001, HTTP 골격), ADR-0008 갱신. 모두 미커밋. 다음: T08(N8 무관) 또는 N8 후 T05.
- 2026-10-28 · Claude Code · T05 완료(모의 검증): Identity 모듈, 카카오 OAuth 포트·어댑터, 세션·로그인 라우트. 실제 카카오 로그인은 N8(앱 등록)과 비밀값 설정 후 확인. 미커밋. 다음: T08 또는 T06·T07.
- 2026-10-28 · Claude Code · T01~T05 `/code-review` 후 수정 6건: 카카오 어댑터 fetch 바인딩, 로그인 CSRF(nonce 쿠키 대조), 오류 로그에서 메시지 제거, 콜백 `error` 처리, `/api/me` 401 `loginUrl`, 버전 서술 정정. openapi 계약 변경(승인): `INTERNAL_ERROR` 코드 추가, 로그인 시작 400·nonce 쿠키, 콜백 `error` 처리·nonce 쿠키 삭제. `/api/health`는 계약에 넣지 않기로 함(코드에는 유지). 미결: 401 returnTo 설계(SPA와 합의, T25 전). 리뷰의 smell 항목은 미처리(기능 결함 아님).
- 2026-10-28 · Claude Code · T06 완료(발표용 간소화): `requireRole`, `/api/admin/*` 기본 가드(OPERATOR 이상), ADMIN 시드 스크립트(`npm run seed:admin`). 시드는 로컬 D1에서 수동 확인했고 원격(`--remote`)은 실행하지 않음. 로컬 D1에 마이그레이션 0001 적용됨. 미커밋. 다음: T07 또는 T08.
- 2026-10-29 · Claude Code · N7 일부 완료(Cloudflare 무료 계정, `wrangler login` 확인, 계정 서브도메인 `june18806.workers.dev`). 무료 플랜 조건으로 R2 바인딩을 `wrangler.jsonc`에서 제거하고 `Env.BLOBS`를 선택 타입으로 변경(R2 사용 여부는 T09 이후 결정, ADR-0008의 R2는 보류 상태). production Worker 이름을 `subcut`으로 명시. 원격 리소스는 아직 만들지 않음. 다음: 빈 Worker 배포(D1 생성 → database_id 교체 → 원격 마이그레이션 → deploy, 각 단계 승인).
- 2026-10-29 · Claude Code · **빈 Worker 첫 배포 완료(T32 일부, M1)**: 대시보드에서 D1 `subcut-production` 생성(CLI `d1 create`는 Authentication error 10000으로 실패, 원인 미확인), `database_id` 교체, 원격 마이그레이션 0001 적용(테이블 12개, app_settings 3행, users 0건 확인), `wrangler deploy --env production` → https://subcut.june18806.workers.dev (Version d144046a, Cron 2개 등록). 배포 후 GET 확인: `/` 200, `/api/health` 200, `/api/me` 401(loginUrl 포함), `/api/nope` 404, SPA 경로 200. 비밀값 미등록이라 `/auth/kakao/login`은 500(예상된 동작, 로그인 불가). 다음: N8 카카오 앱 등록 → 로컬 로그인 확인 → 비밀값 등록(승인 필요).
- 2026-10-29 · Claude Code · T01~T06 커밋·푸시: `a5e7796`(docs), `ed31448`(T01~T06 코드·설정) → `origin/main`. 위 항목들의 "미커밋"은 이 시점에 해소.
- 2026-10-29 · Claude Code · 외부 에이전트(Gemini) `/code-review` 결과 9건 검증 후 반영. 수정 7건: 테스트 약어 `ID`→`IA`, `auth.test.ts` 조립 코드 중복을 `tests/support/http-login.ts`로 통일·중복 단언 제거, `SessionRow.id`→`userId`, state 페이로드 `n/r/e`→`nonce/returnTo/exp`, Identity 저장소·`LoginResult`의 시각을 `UtcInstant`로 유지, Vite 프록시에 `/auth` 추가, `tasks.md` T01에 R2·staging 보류 사유 기록. 리뷰에 없던 추가 발견: Vite(5173) 경유 POST가 Origin 검사로 403 → 개발 프록시에서만 개발 서버 Origin을 Worker 주소로 바꿔 전달(외부 Origin은 계속 403, 로컬에서 wrangler dev + vite로 확인). 기록만 2건: `/api/health`는 계약 밖 내부 경로로 architecture §8에 명시, `Me.hasRecipient` 판정(D-16)은 T07 착수 전 결정 사항으로 tasks.md T07에 기록.
- 2026-10-29 · Claude Code · 리뷰 반영분 커밋·푸시(`f1aa3b7`).
- 2026-10-29 · Claude Code · **N8 완료, T05 로컬 실제 카카오 로그인 확인**: 카카오 앱 생성, REST API 키·클라이언트 시크릿(노출된 코드는 재발급해 교체), 리다이렉트 URI 2개(localhost:8787, subcut.june18806.workers.dev), 사용 설정 ON, 동의항목(닉네임, 카카오톡 메시지 전송) 설정, `.dev.vars` 작성(비밀값 4개). 시행착오: KOE004(카카오 로그인 사용 설정 OFF)와 KOE205(동의항목 미설정)를 콘솔 설정으로 해결. 로컬 `wrangler dev`에서 로그인 후 사용자 1·세션 1(해시 저장)·카카오 토큰 1(`iv.암호문` 형식, scopes talk_message+profile_nickname, refresh 만료 2026-12-28)을 확인했고 `/api/me`가 닉네임·role USER·notificationEnabled true·hasRecipient false를 반환. 인가 코드 교환·프로필 조회 실호출 성공(fetch 바인딩 수정 효과 확인), 콜백 재요청은 400으로 거부. 미확인: `invalid_grant` 응답 형식, 로그아웃·세션 만료, 실제 '나에게 보내기' 발송(T34), 배포 환경 로그인(비밀값 등록 필요, 승인 사항). 다음: 배포 환경 비밀값 등록 승인 요청 → production 로그인 시험.
