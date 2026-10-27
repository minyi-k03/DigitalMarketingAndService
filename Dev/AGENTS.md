# AGENTS.md

구독컷(SubCut) 프로젝트에서 Google Antigravity, Claude Code, Codex가 공통으로 따르는 작업 하네스다.
기능 요구사항의 세부 내용은 `SPEC.md`에, 아키텍처·API 계약·작업 분할은 `docs/architecture.md`·`api/openapi.yaml`·`docs/tasks.md`에 있다.

## 1. Project Overview

- **목적**: 대학생·청년층이 신용카드 연동 없이 무료체험을 1초 간편 등록(Auto-fill)해 `SafeEndDate` 기준으로 추적·해지(`EscapeBridge`·`ExitPoll`)하도록 돕고, B2B 파트너사에 체험단 유입 채널과 `ChurnReport`를 제공하는 양면 시장 웹 서비스다.
- **핵심 기능**: 사전 검증된 카탈로그 탐색, 1초 간편 등록(Auto-fill), `SafeEndDate` 기준 카카오 알림톡 3종, `EscapeBridge` 경유 해지와 `ExitPoll`, 사후 구제(`RefundTemplate`), `SponsoredTrial`·`AlternativeMatch`·`ChurnReport`.
- **작업 전 필수**: 작업 착수 전 `SPEC.md`(v1.11), `Glossary.md`(v1.4), `docs/architecture.md`, `docs/tasks.md`의 관련 절과 담당 TASK를 읽는다. 2026-12-09 발표까지는 `docs/implementation-plan.md` §7의 발표용 범위·일정·에이전트 담당 구분을 따른다.
- **현재 파일 구성** (`Dev/` 작업 공간 기준):

| 경로 | 내용 |
| :--- | :--- |
| `SPEC.md` | 요구사항 명세서 v1.11 (최우선 기준 문서) |
| `Glossary.md` | 도메인 용어집 v1.4 및 `ADR-0001`~`ADR-0005` 요약 |
| `CLAUDE.md` | Claude Code 세션에서 `@AGENTS.md`를 자동 로드하는 래퍼 |
| `api/openapi.yaml` | HTTP 엔드포인트 및 RFC 9457 `problem+json` 오류 응답 규격 (`D-06` 확정) |
| `docs/architecture.md` | 시스템 구성, 디렉터리 구조, 모듈 공개 인터페이스, D1 스키마, SPEC 갭(G1~G6 해결) 현황 |
| `docs/implementation-plan.md` | 단계별 마일스톤(M0~M10), 크리티컬 패스, 비코드 병행 작업(N1~N7) |
| `docs/tasks.md` | 구현 작업 분할(T00~T52) 및 스토리·검증 항목 추적표 |
| `docs/adr/ADR-0008-cloudflare-stack-and-frontend.md` | Cloudflare 단일 Worker, React + Vite SPA(`D-07`), Hono·zod·Vitest 채택 기록 |
| `../Test/`, `../목업html/`, `../시장분석,사용자분석/`, `../index*.html` | 이전 정적 목업·기획 자료. 구독컷 애플리케이션 구현 코드가 아니다 |

- **Git**: 저장소 루트는 상위 폴더 `디지털창업서비스기획과마케팅/`이고 구독컷 개발 폴더는 `Dev/`다. 작업 때마다 `git status`로 상태를 확인한다.
- **기술 스택 및 개발 환경** (`SPEC.md` §17, `ADR-0008` 확정): Cloudflare Workers(단일 워커에서 API + 정적 자산 제공), TypeScript, React + Vite SPA(`D-07`), Hono, zod, Cloudflare D1, Cloudflare R2, Cron Trigger(10분 주기 알림 발송, 매일 15:10 UTC `MISSED_BILLED` 배치). 현재 Phase 0(설계·계약) 완료 상태이며, `package.json`·TypeScript·테스트 설정은 T01(프로젝트 스캐폴드)에서 구성한다.

## 2. Source of Truth

| 문서 | 역할 |
| :--- | :--- |
| `SPEC.md` (v1.11) | 기능 요구사항, 상태 전이, 데이터·알림 규칙, 도메인 타입(§19), 수용 기준(Testing Decisions)의 최우선 기준 |
| `Glossary.md` (v1.4) | 도메인 용어 정의, *Avoid* 금지어(§1~3), `ADR-0001`~`ADR-0005` 결정 근거(§4) |
| `docs/architecture.md` | 모듈 구조·공개 인터페이스·D1 테이블 소유권·시간/알림 설계 등 "어떻게"를 정의 (요구사항을 바꾸지 못함) |
| `api/openapi.yaml` | HTTP 경로·메서드·요청/응답 스키마 및 오류 코드 계약 (`D-06`) |
| `docs/adr/ADR-0008-*.md` | 기술 스택·프런트엔드(`D-07`)·라우터·테스트 도구 결정 기록 |
| `docs/tasks.md` · `docs/implementation-plan.md` | TASK(T00~T52) 분할, 선행 관계, 수용 기준·스토리 매핑 |

- `SPEC.md`가 용어집·ADR과 다르면 `SPEC.md`(Further Notes §2 포함)가 우선하며, 아키텍처·API 문서가 `SPEC.md`와 충돌하면 임의로 해석하지 않고 위치와 함께 보고한다.
- **`[제안]` 및 미확정 항목 규칙** (`D-01` 확정):
  - P0 범위의 `[제안]` 항목, `D-01`·`D-02`·`D-06`·`D-07`·`D-08`·`D-09`·`D-11`·`D-13`·`D-14`·`D-15`, 그리고 SPEC 갭 `G1`~`G6`(`docs/architecture.md` §11)은 `[확정]`되었다.
  - **미확정 사항 임의 결정 금지**: 아래 항목에 의존하는 TASK는 착수 전에 근거·선택지와 함께 보고하고 사용자 결정을 먼저 받는다.
    - `SPEC.md` Further Notes §7의 미결 항목: `D-03`(비용 상한), `D-04`(성능 목표), `D-05`(접근성 기준), `D-10`(스토리 번호 정책), `D-12`(P1 데이터 모델 보완, T40+)
    - P1·P2 범위의 `[제안]` 항목(Further Notes §1) 및 MVP 배포 포함 여부(§18)
    - 알림톡 수신 번호 확보 방식(Further Notes §4, T31), 발송 실패 시 대체 채널(Further Notes §3), 개인정보·데이터 판매 법률 검토(Further Notes §5)

## 3. Working Procedure

1. 작업 전에 관련 `SPEC.md` 절, `Glossary.md`, `docs/architecture.md`, `docs/tasks.md`의 담당 TASK(선행 조건·완료 기준), `git status`를 확인한다.
2. 작업 규모를 구분한다.
   - **단일 TASK·모듈 내부 작업**: 한 모듈 안에서 끝나고 공개 인터페이스·D1 스키마·`openapi.yaml`을 바꾸지 않는 작업. 관련 `SPEC.md` 절과 TASK(`Tnn`)·스토리 번호(`Sn`)를 근거로 남기며 바로 진행한다.
   - **복잡한 작업 (사전 승인 필수)**: T01 스캐폴딩(의존성 설치 포함), 다중 모듈 변경, 공개 명령·조회 인터페이스나 `openapi.yaml` 변경, D1 스키마·마이그레이션 변경, 상태 머신(§5)·알림 스케줄링(§6) 규칙 변경, 기술 스택·`ADR-0008` 변경. 구현 전에 **계획, 변경 범위, 관련 명세 절, 영향받는 테스트**를 제시하고 승인을 받는다.
3. 요구사항을 임의로 바꾸거나 요청과 무관한 리팩터링·서식 정리를 하지 않는다. TASK 상태가 바뀌면 `docs/tasks.md`를 함께 갱신한다.
4. 우선순위는 `SPEC.md` §18과 `docs/implementation-plan.md`를 따른다: P0(Phase 1~8, T01~T33) → P1(T40~T46) → P2(T50~T52). P0 초기 스키마(T03)부터 `kind`, `publicationStatus`, `ownerPartnerId`, `forcedChannel`을 포함한다.
5. 의존 관계를 지킨다: `TrialRecord` 생성(T13)은 `CatalogItem`(T10)과 `User`(T05) 뒤에, `EscapeBridge`(T20~T21)는 Trial Tracking의 `startCancelAttempt`(T14) 뒤에, `ChurnReport`·`AlternativeMatch`(T45, T51)는 `ExitPollResponse`·`FeaturedEvent`(T14, T44) 뒤에 구현한다.
6. 기존 사용자 변경 사항을 보존한다. 상위 폴더의 untracked 파일(루트 `index*.html`, `목업html/`, `시장분석,사용자분석/`)과 `Test/`를 요청 없이 수정·삭제하지 않고, `git reset --hard`, `git clean`, 강제 push, 요청 없는 commit·push를 하지 않는다.

## 4. Architecture and Coding Rules

- **모듈 경계와 디렉터리** (`SPEC.md` §1, `docs/architecture.md` §2·§3):
  - `src/shared/`(공용 타입·`KstDate`·생성된 API 타입), `src/worker/`(진입점·`http`·`platform`·`ports`·`adapters`·`modules`), `src/web/`(React SPA), `tests/`로 구성한다.
  - 5대 모듈은 자기 소유 테이블만 읽고 쓰며, 다른 모듈은 `src/worker/modules/<module>/index.ts`의 공개 명령·조회 함수로만 호출한다(ESLint `no-restricted-imports`로 내부 `{domain,application,infra}` 직접 import 금지).
    1. **Catalog & Marketplace (`catalog`)**: `catalog_items`, `partners`, `catalog_change_logs`, `app_settings`(`catalog.*`), P1: `catalog_requests`·D-12 테이블
    2. **Trial Tracking & Schedule (`trial-tracking`)**: `trial_records`, `exit_poll_responses`, `notification_schedules`, `app_settings`(`notification.*`)
    3. **EscapeBridge & Recovery (`escape-bridge`)**: 브릿지 뷰·안내 모드, `RefundTemplate`, `broken_link_reports`
    4. **B2B Analytics & Matching (`analytics`)**: P1 `featured_events`, `AlternativeMatch`, P2 `report_grants`, `ChurnReport`
    5. **Identity & Account (`identity`)**: `users`, `sessions`, 카카오 OAuth, 알림 수신 설정, 탈퇴, 역할 검사
  - 다중 모듈 원자성이 필요한 작업(버퍼 변경 적용 T16, 회원 탈퇴 T24)은 각 모듈의 `prepare*` 함수가 반환한 `D1PreparedStatement[]`를 오케스트레이터가 합쳐 단일 `db.batch()`로 실행한다(`docs/architecture.md` §3.3).
- **상태 머신**: `TrialRecord` 상태는 Trial Tracking의 `applyTransition` 단일 진입점에서만 바꾸고, 전이표(§5)에 없는 전이는 `INVALID_TRANSITION` 오류로 거부한다. 상태가 바뀌면 `statusChangedAt`을 갱신하고 조건부 UPDATE(`WHERE status = :from`)로 동시성 충돌을 막는다.
- **`ExitPoll` 일관성**: 응답 저장(`exit_poll_responses`와 `trial_records.exit_reason` 사본)과 상태 전이·알림 변경은 하나의 D1 `batch`와 DB CHECK/PK 제약으로 처리한다. `TRACKING`에는 응답이 없고 `CANCEL_ATTEMPTED`·`CANCELED_CONFIRMED`에는 정확히 1건이 있다는 불변식을 깨는 경로를 만들지 않는다.
- **날짜와 시각** (`SPEC.md` §4·§17, `docs/architecture.md` §4):
  - 달력 날짜(`startDate`, `billingDate`, `safeEndDate`)는 KST `YYYY-MM-DD`(`KstDate`)이며 `Date.UTC` 기반 일 단위 연산만 쓴다.
  - 시각(발송 예정, 전이 시각 등)은 UTC ISO 8601(`UtcInstant`)로 저장한다. '오늘(KST)'은 UTC 현재 시각 + 9시간의 날짜이며, Cron 표현식은 UTC 기준이다.
  - 현재 시각은 항상 주입된 `Clock` 포트에서 얻고, 도메인·application 코드에서 `new Date()`·`Date.now()`를 직접 호출하지 않는다(ESLint `no-restricted-syntax`).
- **알림** (`SPEC.md` §6·§17, `docs/architecture.md` §5.4~§5.7):
  - 날짜·버퍼가 바뀌면 §6의 재예약 규칙을 따른다(`PENDING` 취소 → 새 `safeEndDate`로 재계산 → 정규 슬롯 경과 시 `TRACKING`은 늦은 등록 즉시 발송, `CANCEL_ATTEMPTED`는 마감 시각 이전이면 `SAME_DAY_CONFIRM` 예약·발송(`G3`)). 기본 발송 시각 변경은 이후 생성·재예약되는 슬롯부터 적용한다(`G5`).
  - 발송 멱등성: (`trial_record_id`, `slot`, `safe_end_date`) 유일 제약, `PENDING → SENDING` 조건부 선점(15분 경과 시 복구), `MISSED_BILLED` 배치의 상태 조건부 UPDATE.
  - 발송은 `NotificationSender` 포트, 수신처 조회는 `RecipientResolver` 포트 뒤에 두어 테스트 더블로 교체한다.
  - 알림 링크는 기록 ID만 담은 구독컷 내부 경로(`/bridge/{id}`, `/trials/{id}`)로 연결하며(`ADR-0001`), 알림톡에는 정보성 내용만 넣는다.
- **공개 데이터와 관리 데이터의 경계** (`SPEC.md` §2·§7·§19, `D-09`·`D-11`·`D-13`·`D-15`):
  - 카탈로그 목록·상세는 `CatalogItemPublicView`(`escapeLink`, `escapeLinkFallbackUrl`, `ownerPartnerId`, `darkPatternScores` 제외, `publicationStatus: 'PUBLISHED' | 'UNPUBLISHED'` 포함)만 반환한다.
  - `UNPUBLISHED` 항목은 목록·상세에 '게시 중단' 안내와 함께 노출하되, 새 체험 기록 생성(경로 A·B·'이미 가입했어요')과 `signupUrl` 버튼 노출을 차단한다(`D-13`).
  - `escapePattern = PC_OR_APP_FORCED`인 항목은 `forcedChannel: 'APP' | 'PC_WEB'`이 필수이며, `forcedChannel = APP`이면 `escapeLinkFallbackUrl`이 필수다(`D-15`).
  - 직링크(`escapeLink`)는 `StartCancelAttempt` 결과, `CANCEL_ATTEMPTED` 재진입(`REENTRY`), `MISSED_BILLED`·`BILLED_CONFIRMED` 안내 모드(`GUIDE_ONLY`, `D-09`)에서만 반환한다.
- **카탈로그 변경 반영 및 범위 밖 기능 금지**: 필드별 진행 중 기록 반영 규칙(§2), `SavedAmount` 스냅샷 규칙(§8), `CatalogChangeLog`(§16)를 따른다. 대리 해지, 카드·계좌 연동, 해지 화면 크롤링, 환불 대행 발송, 미검증 서비스 직접 등록은 구현하지 않는다(Out of Scope, `ADR-0001`·`0004`·`0005`).
- **이름 및 코딩 규칙**: 도메인 타입·필드 이름은 `SPEC.md` §19, `api/openapi.yaml`, `Glossary.md`를 따르고 *Avoid* 금지어를 식별자로 쓰지 않는다. T01에서 ESLint·Prettier·TypeScript 설정이 구성되면 확인된 규칙을 이 절에 추가한다.

## 5. Skills Usage and Multi-Agent Rules

- 작업 목적에 맞는 설치된 Skill만 골라 해당 `SKILL.md`를 읽고 따르며, 상세 절차를 이 문서에 옮겨 적지 않는다.
- **에이전트별 Skill 원본 경로**:
  - Codex / 공통: `C:/Users/june1/.agents/skills/<skill>/SKILL.md`
  - Antigravity: `C:/Users/june1/.gemini/config/skills/<skill>/SKILL.md`
  - Claude Code: `C:/Users/june1/.claude/skills/<skill>/SKILL.md`
- **목적별 선택 기준**: 요구사항·설계 탐색(`brainstorming`, `grilling`, `domain-modeling`, `to-spec`), 아키텍처·모듈 설계(`codebase-design`, `improve-codebase-architecture`), 구현 계획(`writing-plans`), 테스트 우선 구현(`tdd`), 버그 분석(`systematic-debugging`), 프런트엔드 UI·React(`frontend-design`, `design-taste-frontend`, `vercel-react-best-practices`), 브라우저 검증(`agent-browser`), 코드 리뷰(`code-review`), 완료 전 검증·마무리(`verification-before-completion`, `finishing-a-development-branch`).
- **스택 불일치 Skill 사용 금지**: `deploy-to-vercel`, `supabase-postgres-best-practices`는 본 프로젝트(Cloudflare Workers·D1)에 쓰지 않는다. `vercel-react-best-practices`는 React 컴포넌트·상태 최적화 규칙만 참고하고 Next.js·Vercel 전용 규칙은 제외한다.
- **다중 에이전트 호환 (Antigravity · Claude Code · Codex)**:
  - 모든 에이전트는 `Dev/AGENTS.md`를 공통 기준으로 삼고, Claude Code는 `Dev/CLAUDE.md`(`@AGENTS.md`)를 통해 로드한다.
  - `~/.claude/skills/`에 없는 스킬(`codebase-design`, `domain-modeling`, `grilling`, `writing-plans`, `frontend-design`, `agent-browser`)이 필요할 때는 `C:/Users/june1/.agents/skills/<skill>/SKILL.md`를 직접 읽는다.
  - `~/.agents/skills/`와 `~/.gemini/config/skills/`에 없는 스킬(`tdd`, `systematic-debugging`)이 필요할 때는 `C:/Users/june1/.claude/skills/<skill>/SKILL.md`를 직접 읽는다.

## 6. Security and Permissions

- **비밀정보**: `KAKAO_CLIENT_SECRET`, `SESSION_SIGNING_KEY`, `PHONE_ENCRYPTION_KEY`, `KAKAO_TOKEN_ENCRYPTION_KEY`(D-16), `ALIMTALK_API_KEY`는 소스 코드·설정 파일·커밋에 넣지 않고 Workers Secrets로 관리한다. 로컬 `.dev.vars` 사용 시 `.gitignore` 포함 여부를 먼저 확인한다.
- **권한·세션·CSRF**: 역할(`USER`·`OPERATOR`·`ADMIN`, §16)은 서버의 모든 관리 API에서 `requireRole`로 검사하고 `/admin*`·`/api/admin*`에 Cloudflare Access를 적용한다. 사용자 API는 `trial_records.user_id = session.userId`를 서버에서 확인(타인 소유는 `404 NOT_FOUND`)하고, 상태 변경 요청은 `Origin` 헤더를 검사한다. 세션 토큰은 SHA-256 해시만 D1에 저장한다.
- **입력과 URL 검증**: 서버에서 zod로 요청을 검증하고 오류는 RFC 9457 `application/problem+json`으로 반환한다(`docs/architecture.md` §8). `signupUrl`, `supportContact.url`, `eduBenefit.url`, `escapeLinkFallbackUrl`, `CatalogRequest.serviceUrl`은 `https:`만 허용하며, `escapeLink`는 `https:` 또는 `forcedChannel = APP`일 때 `app_settings`의 `catalog.allowedDeepLinkSchemes`(기본값 `[]`)에 등록된 커스텀 스킴만 허용한다(`G4`). 카카오 OAuth `returnTo`는 내부 경로(`/`로 시작, `//` 금지)만 허용하고, 알림 링크에는 로그인 토큰을 넣지 않는다.
- **개인정보 및 탈퇴 (`D-08`·`D-14`)**: 전화번호는 AES-GCM으로 암호화 저장하고, 전화번호·카카오 ID·세션 토큰·쿠키를 로그에 남기지 않는다. `ChurnReport`에는 개인 식별 정보(`userId` 포함)를 넣지 않는다. 회원 탈퇴 시 식별 정보와 모든 관련 기록(`TrialRecord`, `NotificationSchedule`, `ExitPollResponse`, `BrokenLinkReport`, P1·P2 테이블) 및 운영자 탈퇴 시 `CatalogChangeLog`·`ReportGrant`까지 즉시 삭제한다(§15).
- **환경 분리**: `dev`·`staging`·`production`의 D1·R2·Secrets를 분리하고, `staging`에서는 `NOTIFICATION_MODE`를 `log`로만 허용해 실제 알림톡·카카오 메시지가 발송되지 않게 한다. 발표용 production은 `kakao_memo`(카카오 '나에게 보내기', D-16)를 쓴다. 운영 비밀값이나 데이터를 개발 환경에 복사하지 않는다.
- **승인이 필요한 작업**: 원격(staging·production) DB 조회·수정·마이그레이션 적용, 클라우드 리소스 생성, `wrangler deploy`(상위 `Test/` 배포 포함), Secrets 등록·변경, 외부 알림톡·카카오 메시지 실제 발송, 의존성 패키지 설치, `git commit`·`git push`·파괴적 Git 명령은 사용자의 명시적 승인 없이 하지 않는다. D1 스키마 변경은 `migrations/` 파일로만 한다.

## 7. Verification

- **명령어**: 현재 Phase 0 상태라 `package.json`이 없으므로 verify 명령은 **미확정**이다. 명령을 지어내거나 실행하지 않은 검증을 통과했다고 보고하지 않는다. T01 완료 시 실제 확인한 명령(예정: `npm test`, `npm run typecheck`, `npm run lint`, `npm run build`, `npm run gen:api`)을 이 절에 기록한다.
- **수용 기준 연결**: 테스트는 `describe('TT 알림 스케줄 [S13][S26]')`, `it('V-08 UNPUBLISHED 항목은 경로 A 생성 거부')`처럼 `SPEC.md` Testing Decisions 항목·`V-01~V-09`·사용자 스토리 번호로 추적할 수 있게 이름 짓는다(`docs/architecture.md` §10, `docs/tasks.md` 추적표 2).
- **테스트 방식**: Vitest + `@cloudflare/vitest-pool-workers`로 마이그레이션을 적용한 격리 로컬 D1에서 실행한다. 각 모듈 `application/` 명령·조회 핸들러를 테스트 seam(`[확정]`)으로 삼아 관찰 가능한 결과만 검증하고, 경계에서 `FakeClock`, `FakeNotificationSender`, `FakeRecipientResolver`만 테스트 더블로 교체한다. 실제 알림톡을 보내는 테스트는 만들지 않는다.
- **반드시 다룰 경계**:
  - 상태 머신의 모든 허용 전이와 대표 불허 전이(`KEPT → CANCEL_ATTEMPTED`, `CANCEL_ATTEMPTED → VOIDED`, `BILLED_CONFIRMED`의 모든 전이), `ExitPoll` 불변식과 D1 `batch` 원자성
  - 글로벌/국내 항목별 `SafeEndDate`, 월말·연말·윤년·평년 경계(`KstDate`)
  - KST 00:00~08:59(UTC 전날) 구간의 `todayKst` 계산, `SafeEndDate` 당일 23:59:59 KST(`SavedAmount`), 당일 해지 확인 알림의 글로벌 20:00 / 국내 10:00·+1h·21:00 이후 미발송 기준
  - Cron 중복 실행과 `MISSED_BILLED` 배치 재실행 시 멱등성, 핵심 시나리오 `S-01`~`S-05`
- **결과 보고**: 실제로 실행한 명령의 출력으로 성공과 실패를 구분하며, 실패했거나 실행할 수 없었던 검증은 원인과 함께 보고한다.

## 8. Completion Report

오류나 테스트 실패를 수정할 때는 증상만 임시 봉합하지 않고 근본 원인(Root Cause)을 먼저 파악한 뒤 관련 테스트를 보강해 수정한다. 모든 작업을 완료하면 다음 5가지를 보고한다.

1. 변경 사항과 변경 이유 (관련 TASK 번호 `Tnn` 명시)
2. 주요 수정·생성 파일 및 `SPEC.md` 절 / 스토리 번호 / `docs/architecture.md`와의 연관성
3. 실제 실행한 검증 명령과 출력 결과
4. 남아 있는 문제, 위험 요소 및 미확정 사항(`[결정 필요 D-nn]`, Further Notes 미결 항목)
5. 추가로 필요한 사용자 결정이나 승인
