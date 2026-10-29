# progress.md

세션 간 진행 기록이다. TASK별 상태(`대기`/`진행`/`완료`)와 완료 기준은 [`tasks.md`](tasks.md)가 원본이며 여기에는 적지 않는다.
세션을 시작할 때 이 파일과 최근 `git log`를 읽고 `npm run verify`를 먼저 실행해 기준 상태를 확인한다. 세션을 끝낼 때 아래 "마지막 verify"와 "다음 할 일"을 갱신하고 "세션 로그"에 항목을 더한다.

## 다음 할 일

2026-10-29 기준. 위에서부터 진행한다. 원격 변경은 단계마다 사용자 승인을 받는다(AGENTS §6).

1. **N8 잔여(조건부)**: 시연 계정이 앱 소유자와 다를 때만 카카오 콘솔 "멤버"에 그 계정을 추가한다(검수 전 앱은 멤버만 `talk_message` 수신 가능, `implementation-plan.md` §7.8). 소유자 계정으로 시연하면 불필요하다. 앱 대표 도메인에는 production 도메인이 등록돼 있다(2026-10-29 확인). "플랫폼 키"의 Web 허용 도메인은 JS SDK를 쓸 때만 필요하며 REST 로그인에는 영향이 없다.
2. **최초 ADMIN 시드(선택)**: `npm run seed:admin -- <카카오 회원번호>`(로컬) 또는 `--remote`(production, 승인 필요). production에는 앱 소유자 계정의 `users` 행이 이미 있다(role `USER`).
3. **T07 `hasRecipient` 결정 완료(A안, 2026-10-29)**: `RecipientResolver` 기준으로 통일한다(`kakao_memo`는 유효한 카카오 토큰, `dealer`는 전화번호). 현재 코드는 전화번호 유무로 판정해 production `/api/me`에서도 동의한 사용자가 `false`다. T07 착수 때 `me.ts`·openapi 설명·관련 테스트를 함께 바꾸며, `openapi.yaml` 변경이므로 구현 전에 계획 승인을 받는다(`tasks.md` T07 참고). 이 값은 `/api/me` 표시용이며 알림 발송 여부를 정하지 않는다.
4. **다음 주(11/3~11/9) 계획**: T07, T08, T09(간소), T10. Antigravity는 T25를 시작하며, 화면 TASK는 해당 API TASK를 사용자가 커밋한 뒤에 시작한다.

미결·보류 사항
- 401 `loginUrl`의 returnTo가 API 경로(`/api/me`)다. SPA가 자기 화면 경로를 넘기는 방식으로 합의가 필요하다(T25 전).
- R2는 무료 플랜(카드 등록 없음) 때문에 보류했다. 로고 업로드가 필요한 T09 이후 사용 여부를 정한다. ADR-0008의 R2는 보류 상태다.
- CLI `wrangler d1 create`가 `Authentication error 10000`으로 실패한 원인은 미확인이다(대시보드로 생성해 진행에는 지장 없음).
- 미확인 동작: `invalid_grant` 응답 형식, 로그아웃·세션 만료의 실환경 확인, 실제 '나에게 보내기' 발송(T34). production 로그인은 2026-10-29에 확인했다.
- 로컬 `.wrangler/` D1에는 마이그레이션 0001이 적용돼 있고 본인 계정 사용자 1건이 있다(git 제외).

작업 방식 메모
- 비밀값(클라이언트 시크릿, `.dev.vars` 값)은 대화·캡처에 노출하지 않는다. 한 번 노출돼 재발급한 적이 있다.
- **Windows PowerShell 5.1에서 `wrangler secret put`에 값을 파이프하면 앞에 BOM(EF BB BF)이 붙는다**(`$OutputEncoding`을 바꿔도, .NET `Process` stdin으로 써도 마찬가지). 카카오 `client_id`에 붙어 KOE101이 났다. `[Console]::InputEncoding = New-Object System.Text.UTF8Encoding($false)`로 바꾼 뒤 `Process`의 `StandardInput.Write`로 넘기면 BOM이 없다. 등록 후에는 값을 출력하지 말고 길이와 `[string]::Equals(..., Ordinal)`로 확인한다(PowerShell의 `-eq`·`-ceq`는 BOM을 무시해 동일하다고 나온다).
- 외부 에이전트(Gemini) `/code-review` 결과는 코드로 검증한 뒤 타당한 것만 반영한다.
- 구현은 `tdd`(합의한 seam만), 완료 보고 전 `verification-before-completion`, 리뷰는 `code-review`(AGENTS §5).

## 마지막 verify

| 날짜 | 명령 | 결과 |
| :--- | :--- | :--- |
| 2026-10-29 | `npm run verify` | 통과 (lint, typecheck, test 170건, build). 세션 시작 시 기준 상태 재확인, 이후 코드 변경 없음 |

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
- 2026-10-29 · Claude Code · **production 비밀값 등록과 로그인 확인(T05 배포 환경 완료)**: `KAKAO_CLIENT_ID`·`KAKAO_CLIENT_SECRET`(로컬과 동일 앱), `SESSION_SIGNING_KEY`·`KAKAO_TOKEN_ENCRYPTION_KEY`(production용 새 값)를 `wrangler secret put --env production`으로 등록했다. 첫 등록 값에 BOM이 붙어 로그인에서 KOE101이 났고(원인과 우회법은 위 작업 방식 메모), BOM 없이 4개를 다시 등록해 해결했다. 브라우저에서 production 로그인 성공, `/api/me`가 role USER·notificationEnabled true·hasRecipient false를 반환했다. 원격 D1 읽기 전용 집계(승인 후)로 users 1·sessions 1·kakao_message_tokens 1, scopes talk_message+profile_nickname, 토큰 `iv.암호문` 형식, 변경 0건을 확인했다(식별값 조회 없음). 이번 주(10/27~11/2) 계획 완료, T05·T06은 다음 주 계획분을 앞당겨 완료. `Me.hasRecipient`는 A안(`RecipientResolver` 기준)으로 결정했고 T07에서 구현한다. N8 멤버 등록은 시연 계정이 소유자와 다를 때만 필요하다. 다음: 11/3 주차 T07(계획 승인 후), T08, T09(간소), T10.
