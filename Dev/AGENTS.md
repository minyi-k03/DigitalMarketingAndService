# AGENTS.md

구독컷(SubCut) 프로젝트에서 Google Antigravity, Claude Code, Codex가 공통으로 따르는 작업 하네스다.
기능 요구사항의 세부 내용은 `SPEC.md`에, 아키텍처·API 계약·작업 분할은 `docs/architecture.md`·`api/openapi.yaml`·`docs/tasks.md`에 있다.

## 1. Project Overview

- **목적**: 대학생·청년층이 신용카드 연동 없이 무료체험을 1초 간편 등록(Auto-fill)해 `SafeEndDate` 기준으로 추적·해지(`EscapeBridge`·`ExitPoll`)하도록 돕고, B2B 파트너사에 체험단 유입 채널과 `ChurnReport`를 제공하는 양면 시장 웹 서비스다.
- **핵심 기능**: 사전 검증된 카탈로그 탐색, 1초 간편 등록(Auto-fill), `SafeEndDate` 기준 카카오톡 알림 3종(발표용은 카카오 '나에게 보내기', 사업자 등록 후 알림톡, `D-16`), `EscapeBridge` 경유 해지와 `ExitPoll`, 사후 구제(`RefundTemplate`), `SponsoredTrial`·`AlternativeMatch`·`ChurnReport`.
- **작업 전 필수**: 작업 착수 전 `SPEC.md`(v1.11), `Glossary.md`(v1.4), `docs/architecture.md`, `docs/tasks.md`의 관련 절과 담당 TASK를 읽는다. 2026-12-09 발표까지는 `docs/implementation-plan.md` §7의 발표용 범위·일정·에이전트 담당 구분을 따른다.
- **현재 파일 구성** (`Dev/` 작업 공간 기준):

| 경로 | 내용 |
| :--- | :--- |
| `SPEC.md` | 요구사항 명세서 v1.11 (최우선 기준 문서) |
| `Glossary.md` | 도메인 용어집 v1.4 및 `ADR-0001`~`ADR-0005` 요약 |
| `CLAUDE.md` | Claude Code 세션에서 `@AGENTS.md`를 자동 로드하는 래퍼 |
| `skills-lock.json` | 프로젝트 Skill의 출처·해시 기록(커밋 대상). Skill 파일(`.agents/skills/`)은 커밋하지 않고 이 파일로 복원한다(§5) |
| `api/openapi.yaml` | HTTP 엔드포인트 및 RFC 9457 `problem+json` 오류 응답 규격 (`D-06` 확정) |
| `docs/architecture.md` | 시스템 구성, 디렉터리 구조, 모듈 공개 인터페이스, D1 스키마, SPEC 갭(G1~G6 해결) 현황 |
| `docs/implementation-plan.md` | 단계별 마일스톤(M0~M10), 크리티컬 패스, 비코드 병행 작업(N1~N8), **§7 발표용 범위·주차별 일정·에이전트 담당 구분·TASK별 사용 Skill** |
| `docs/tasks.md` | 구현 작업 분할(T00~T52, 발표용 T34·T35·T60~T63) 및 스토리·검증 항목 추적표 |
| `docs/adr/ADR-0008-cloudflare-stack-and-frontend.md` | Cloudflare 단일 Worker, React + Vite SPA(`D-07`), Hono·zod·Vitest 채택 기록 |
| `../목업html/`, `../시장분석,사용자분석/`, `../index*.html` | 이전 정적 목업·기획 자료. 구독컷 애플리케이션 구현 코드가 아니다 |

- **Git**: 저장소 루트는 상위 폴더 `디지털창업서비스기획과마케팅/`이고 구독컷 개발 폴더는 `Dev/`다. 작업 때마다 `git status`로 상태를 확인한다.
- **기술 스택 및 개발 환경** (`SPEC.md` §17, `ADR-0008` 확정): Cloudflare Workers(단일 워커에서 API + 정적 자산 제공), TypeScript, React + Vite SPA(`D-07`), Hono, zod, Cloudflare D1, Cloudflare R2, Cron Trigger(10분 주기 알림 발송, 매일 15:10 UTC `MISSED_BILLED` 배치). 발표(2026-12-09) 전까지 Cloudflare production 환경에 최종 배포하는 것이 필수다(`docs/implementation-plan.md` §7, T32). Phase 0(설계·계약)과 T01~T04(스캐폴드·shared kernel·마이그레이션 0001·HTTP 골격)가 완료된 상태다. 진행 상태는 `docs/tasks.md`를 따른다.

## 2. Source of Truth

| 문서 | 역할 |
| :--- | :--- |
| `SPEC.md` (v1.11) | 기능 요구사항, 상태 전이, 데이터·알림 규칙, 도메인 타입(§19), 수용 기준(Testing Decisions)의 최우선 기준 |
| `Glossary.md` (v1.4) | 도메인 용어 정의, *Avoid* 금지어(§1~3), `ADR-0001`~`ADR-0005` 결정 근거(§4) |
| `docs/architecture.md` | 모듈 구조·공개 인터페이스·D1 테이블 소유권·시간/알림 설계 등 "어떻게"를 정의 (요구사항을 바꾸지 못함) |
| `api/openapi.yaml` | HTTP 경로·메서드·요청/응답 스키마 및 오류 코드 계약 (`D-06`) |
| `docs/adr/ADR-0008-*.md` | 기술 스택·프런트엔드(`D-07`)·라우터·테스트 도구 결정 기록 |
| `docs/tasks.md` · `docs/implementation-plan.md` | TASK(T00~T52, 발표용 T34·T35·T60~T63) 분할, 선행 관계, 수용 기준·스토리 매핑, 발표용 범위(§7) |

- `SPEC.md`가 용어집·ADR과 다르면 `SPEC.md`(Further Notes §2 포함)가 우선하며, 아키텍처·API 문서가 `SPEC.md`와 충돌하면 임의로 해석하지 않고 위치와 함께 보고한다.
- **`[제안]` 및 미확정 항목 규칙** (`D-01` 확정):
  - 다음 항목은 `[확정]`되었다.
    - P0 범위의 `[제안]` 항목
    - `D-01`·`D-02`(발표용 기준 포함)·`D-06`·`D-07`·`D-08`·`D-09`·`D-11`·`D-13`·`D-14`·`D-15`·`D-16`(발표용 알림 채널)·`D-17`(발표용 B2B 4종)
    - `D-12` 중 `CatalogItem.publishedAt`·`featuredOrder`
    - P1 `[제안]` 중 `FeaturedEvent` 노출 중복 제거 기준과 `AlternativeMatch` 후보 선정 순서
    - SPEC 갭 `G1`~`G6`(`docs/architecture.md` §11)
  - **미확정 사항 임의 결정 금지**: 아래 항목에 의존하는 TASK는 착수 전에 근거·선택지와 함께 보고하고 사용자 결정을 먼저 받는다.
    - `SPEC.md` Further Notes §7의 미결 항목: `D-03`(비용 상한), `D-04`(성능 목표), `D-05`(접근성 기준), `D-10`(스토리 번호 정책), `D-12`의 나머지(`CatalogRequest` 서비스 내 알림, T46)
    - 위에서 확정하지 않은 P1·P2 범위의 `[제안]` 항목(Further Notes §1). 발표용 B2B(T60~T63)는 `D-17` 범위만 구현하고 정식 P1·P2(T40~T52)를 앞당겨 구현하지 않는다.
    - 알림톡 수신 번호 확보 방식(Further Notes §4, T31, 사업자 등록 후), 발송 실패 시 대체 채널(Further Notes §3), 개인정보·데이터 판매 법률 검토(Further Notes §5)

## 3. Working Procedure

1. 작업 전에 관련 `SPEC.md` 절, `Glossary.md`, `docs/architecture.md`, `docs/tasks.md`의 담당 TASK(선행 조건·완료 기준), `git status`를 확인한다.
2. 작업 규모를 구분한다.
   - **단일 TASK·모듈 내부 작업**: 한 모듈 안에서 끝나고 공개 인터페이스·D1 스키마·`openapi.yaml`을 바꾸지 않는 작업. 관련 `SPEC.md` 절과 TASK(`Tnn`)·스토리 번호(`Sn`)를 근거로 남기며 바로 진행한다.
   - **복잡한 작업 (사전 승인 필수)**: T01 스캐폴딩(의존성 설치 포함), 다중 모듈 변경, 공개 명령·조회 인터페이스나 `openapi.yaml` 변경, D1 스키마·마이그레이션 변경, 상태 머신(§5)·알림 스케줄링(§6) 규칙 변경, 기술 스택·`ADR-0008` 변경. 구현 전에 **계획, 변경 범위, 관련 명세 절, 영향받는 테스트**를 제시하고 승인을 받는다.
3. 요구사항을 임의로 바꾸거나 요청과 무관한 리팩터링·서식 정리를 하지 않는다. TASK 상태가 바뀌면 `docs/tasks.md`를 함께 갱신한다.
4. 우선순위는 `SPEC.md` §18과 `docs/implementation-plan.md`를 따른다.
   - 기본 순서: P0(Phase 1~8, T01~T33) → P1(T40~T46) → P2(T50~T52)
   - 2026-12-09 발표까지는 `docs/implementation-plan.md` §7의 주차별 일정과 TASK 범위(구현·간소화·보류)가 우선한다. `보류` TASK는 착수하지 않고, `간소화` TASK는 §7.2에 적은 범위만 구현한다.
   - P0 초기 스키마(T03)부터 `kind`, `publicationStatus`, `ownerPartnerId`, `forcedChannel`, `publishedAt`, `featuredOrder`, `kakao_message_tokens`, `featured_events`를 포함한다.
5. 의존 관계를 지킨다.
   - `TrialRecord` 생성(T13)은 `CatalogItem`(T10)과 `User`(T05) 뒤에 구현한다.
   - `EscapeBridge`(T20~T21)는 Trial Tracking의 `startCancelAttempt`(T14) 뒤에 구현한다.
   - '나에게 보내기' 어댑터(T34)는 디스패처(T17)와 카카오 로그인(T05) 뒤에 구현한다.
   - `ChurnReport`·`AlternativeMatch`는 `ExitPollResponse`·`FeaturedEvent` 뒤에 구현한다. 정식 버전은 T45·T51(T14·T44 뒤), 발표용은 T62·T63(T14·T60 뒤)이다.
6. 기존 사용자 변경 사항을 보존한다.
   - 상위 폴더의 untracked 파일(루트 `index*.html`, `목업html/`, `시장분석,사용자분석/`, `.vscode/`)을 요청 없이 수정·삭제하지 않는다.
   - `git reset --hard`, `git clean`, 강제 push, 요청 없는 commit·push를 하지 않는다.

## 4. Architecture and Coding Rules

- **모듈 경계와 디렉터리** (`SPEC.md` §1, `docs/architecture.md` §2·§3):
  - `src/shared/`(공용 타입·`KstDate`·생성된 API 타입), `src/worker/`(진입점·`http`·`platform`·`ports`·`adapters`·`modules`), `src/web/`(React SPA), `tests/`로 구성한다.
  - 5대 모듈은 자기 소유 테이블만 읽고 쓰며, 다른 모듈은 `src/worker/modules/<module>/index.ts`의 공개 명령·조회 함수로만 호출한다(ESLint `no-restricted-imports`로 내부 `{domain,application,infra}` 직접 import 금지).
    1. **Catalog & Marketplace (`catalog`)**: `catalog_items`(`published_at`·`featured_order` 포함), `partners`, `catalog_change_logs`, `app_settings`(`catalog.*`), P1: `catalog_requests`·D-12 나머지 테이블
    2. **Trial Tracking & Schedule (`trial-tracking`)**: `trial_records`, `exit_poll_responses`, `notification_schedules`, `app_settings`(`notification.*`)
    3. **EscapeBridge & Recovery (`escape-bridge`)**: 브릿지 뷰·안내 모드, `RefundTemplate`, `broken_link_reports`
    4. **B2B Analytics & Matching (`analytics`)**: `featured_events`(발표용으로 0001에 포함, `D-17`), `AlternativeMatch`, `ChurnReport`(발표용은 TT 공개 집계 조회만 사용), P2 `report_grants`
    5. **Identity & Account (`identity`)**: `users`, `sessions`, `kakao_message_tokens`(`D-16`), 카카오 OAuth, 알림 수신 설정, 탈퇴, 역할 검사
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
    - 어댑터는 `NOTIFICATION_MODE`로 고른다: `log`, `kakao_memo`(발표용 '나에게 보내기', T34), `dealer`(알림톡, 사업자 등록 후 T31).
    - `kakao_memo`의 access token은 Identity의 `getKakaoMessageAccessToken`으로만 얻는다.
  - 알림 링크는 기록 ID만 담은 구독컷 내부 경로(`/bridge/{id}`, `/trials/{id}`)로 연결하며(`ADR-0001`), 알림톡·카카오 메시지에는 정보성 내용만 넣는다(`AlternativeMatch` 같은 추천·홍보 내용 금지).
- **공개 데이터와 관리 데이터의 경계** (`SPEC.md` §2·§7·§19, `D-09`·`D-11`·`D-13`·`D-15`):
  - 카탈로그 목록·상세는 `CatalogItemPublicView`(`escapeLink`, `escapeLinkFallbackUrl`, `ownerPartnerId`, `darkPatternScores` 제외, `publicationStatus: 'PUBLISHED' | 'UNPUBLISHED'` 포함)만 반환한다.
  - `UNPUBLISHED` 항목은 목록·상세에 '게시 중단' 안내와 함께 노출하되, 새 체험 기록 생성(경로 A·B·'이미 가입했어요')과 `signupUrl` 버튼 노출을 차단한다(`D-13`).
  - `escapePattern = PC_OR_APP_FORCED`인 항목은 `forcedChannel: 'APP' | 'PC_WEB'`이 필수이며, `forcedChannel = APP`이면 `escapeLinkFallbackUrl`이 필수다(`D-15`).
  - 직링크(`escapeLink`)는 `StartCancelAttempt` 결과, `CANCEL_ATTEMPTED` 재진입(`REENTRY`), `MISSED_BILLED`·`BILLED_CONFIRMED` 안내 모드(`GUIDE_ONLY`, `D-09`)에서만 반환한다.
- **카탈로그 변경 반영 및 범위 밖 기능 금지**: 필드별 진행 중 기록 반영 규칙(§2), `SavedAmount` 스냅샷 규칙(§8), `CatalogChangeLog`(§16)를 따른다. 대리 해지, 카드·계좌 연동, 해지 화면 크롤링, 환불 대행 발송, 미검증 서비스 직접 등록은 구현하지 않는다(Out of Scope, `ADR-0001`·`0004`·`0005`).
- **이름 및 코딩 규칙**: 도메인 타입·필드 이름은 `SPEC.md` §19, `api/openapi.yaml`, `Glossary.md`를 따르고 *Avoid* 금지어를 식별자로 쓰지 않는다.
- **도구 설정** (T01에서 확인):
  - 패키지 매니저는 npm이며 `package-lock.json`을 커밋한다. 의존성 버전은 정확한 버전으로 고정한다.
  - TypeScript는 5.9.3이다. `typescript-eslint` 8.x는 TypeScript `<6.1`, `openapi-typescript` 7.x는 TypeScript `^5.x`를 피어로 요구하기 때문이며(두 도구 자체의 버전이 아니다), `openapi-typescript`가 TypeScript 6.x를 허용하기 전에는 6.x로 올리지 않는다.
  - Vitest는 4.1.x다. Workers 테스트는 `@cloudflare/vitest-plugin`(`@cloudflare/vitest-pool-workers`의 후속 패키지, ADR-0008 갱신 대상)을 쓴다.
  - tsconfig는 `tsconfig.worker.json`(`src/worker`·`src/shared`·`tests`)과 `tsconfig.web.json`(`src/web`·`src/shared`)으로 나뉜다.
  - Prettier는 `*.md`·`docs/`·`api/`를 건드리지 않는다(`.prettierignore`).
  - ESLint(flat config, `eslint.config.js`)는 다음을 자동 검사한다.
    - 다른 모듈의 `domain`·`application`·`infra` import 금지(`no-restricted-imports`, `tests/`는 제외)
    - `src/web`의 `src/worker` import 금지
    - 모듈 `domain`·`application`의 `new Date()`·`Date.now()` 금지(`no-restricted-syntax`, 인자가 있는 `new Date(x)`와 `Date.UTC`는 허용)
  - `src/shared/api-types.ts`는 `npm run gen:api`로 생성하며 직접 고치지 않는다.

## 5. Skills Usage and Multi-Agent Rules

- 작업 목적에 맞는 설치된 Skill만 골라 해당 `SKILL.md`를 읽고 따르며, 상세 절차를 이 문서에 옮겨 적지 않는다.
- **필수 호출**: 구현은 `tdd`를 따르고, 완료 보고 전에는 `verification-before-completion`을 따르며, 리뷰는 `code-review`를 쓴다.
- **Skill 위치와 설치**:
  - 프로젝트 Skill의 원본은 `Dev/.agents/skills/<skill>/SKILL.md` 한 곳이다. Antigravity는 이 경로를 읽고, Claude Code는 `Dev/.claude/skills/<skill>`(원본을 가리키는 Junction)로 읽는다. 두 에이전트에서 인식되는 것을 확인했다. Codex·Gemini CLI도 `.agents/skills/`를 읽는 것으로 알려져 있으나 이 프로젝트에서는 확인하지 않았다.
  - 전역(`~/.claude/skills`, `~/.agents/skills`, `~/.gemini/config/skills`)에는 `find-skills`만 둔다. 같은 이름이 전역과 프로젝트에 모두 있으면 한쪽이 가려질 수 있으므로 프로젝트 Skill은 전역에 설치하지 않는다.
  - 새 프로젝트 전용 Skill은 `find-skills`로 찾고, 설치 전에 `SKILL.md`를 읽어 검토한 뒤 `Dev/`에서 `npx skills add <owner/repo> --skill <name> -y`(`-g` 없이)로 설치한다. 의존성 설치에 해당하므로 사용자 승인 후에만 설치하고, 설치 후 `skills-lock.json`을 갱신해 커밋한다.
  - **Skill 파일은 커밋하지 않는다.** 서드파티 Skill은 MIT·Apache-2.0 등 각자의 라이선스(저작권 고지 포함 의무)가 있고 저장소에 라이선스 파일이 없는 경우가 많아, 재배포 대신 출처와 해시만 `skills-lock.json`에 기록한다. `.agents/skills/`와 `.claude/skills/`는 `.gitignore`로 제외한다.
  - **새 PC·clone 후 복원**: `Dev/`에서 `npx skills experimental_install`을 실행하면 `.agents/skills/`가 복원된다(임시 폴더에서 12개 복원 확인). 이 명령은 `.claude/skills/` 연결을 만들지 않으므로 이어서 `New-Item -ItemType Directory -Force .claude\skills | Out-Null; Get-ChildItem .agents\skills -Directory | ForEach-Object { New-Item -ItemType Junction -Path ".claude\skills\$($_.Name)" -Target $_.FullName | Out-Null }`로 Junction을 만들고, 새 대화에서 Skill이 보이는지 확인한다.
  - **출처가 없는 Skill**(현재 `grilling`, `domain-modeling`, `codebase-design`, `writing-plans`, `agent-browser`)은 잠금 파일로 복원되지 않는 로컬 전용이다. 출처를 찾아 `npx skills add`로 재설치해 잠금 파일에 기록하거나, 다른 PC에서 쓰려면 `.agents/skills/`에 폴더째 복사하고 Junction을 만든다. 라이선스를 확인하기 전에는 커밋하지 않는다.
  - **`npx skills remove -g`는 쓰지 않는다.** 전역 삭제 명령이 프로젝트의 `.agents/skills/` 폴더까지 지운 사례가 있다. 프로젝트 Skill 제거는 `npx skills remove <name>`(`-g` 없이)로 한다.
- **목적별 선택 기준**: 요구사항·설계 탐색(`brainstorming`, `grilling`, `domain-modeling`, `to-spec`), 아키텍처·모듈 설계(`codebase-design`, `improve-codebase-architecture`), 구현 계획(`writing-plans`), 테스트 우선 구현(`tdd`), 버그 분석(`systematic-debugging`), 프런트엔드 UI·React(`frontend-design`, `design-taste-frontend`, `vercel-react-best-practices`), 브라우저 검증(`agent-browser`), 코드 리뷰(`code-review`), 완료 전 검증·마무리(`verification-before-completion`, `finishing-a-development-branch`).
- **TASK별 사용 Skill**: 발표 전까지 주차별·TASK별 Skill은 `docs/implementation-plan.md` §7.5의 '스킬' 열을 따른다. 그 표에 없는 Skill이 필요하거나 '설치 필요'로 표시된 Skill을 쓰려면 설치 전에 사용자에게 보고한다.
- **스택 불일치 Skill 설치·사용 금지**: `deploy-to-vercel`, `supabase-postgres-best-practices`는 본 프로젝트(Cloudflare Workers·D1)에 설치하지도 쓰지도 않는다. Worker 코드 작성·리뷰·설정에는 `workers-best-practices`를 쓴다. `vercel-react-best-practices`는 React 컴포넌트·상태 최적화 규칙만 참고하고 Next.js·Vercel 전용 규칙은 제외한다.
- **다중 에이전트 호환 (Antigravity · Claude Code · Codex)**:
  - 모든 에이전트는 `Dev/AGENTS.md`를 공통 기준으로 삼는다.
    - Claude Code는 `Dev/CLAUDE.md`(`@AGENTS.md`)를 통해 로드한다.
    - Antigravity는 `Dev/`를 작업 공간으로 열거나 작업 규칙에서 이 파일을 참조해 읽는다.
  - **담당 구분** (발표 전까지, `docs/implementation-plan.md` §7.7):
    - Claude Code: `src/worker/`, `tests/`, `migrations/`, `api/openapi.yaml`, `src/shared/`
    - Antigravity: `src/web/`. `api/openapi.yaml`·`src/shared/`는 읽기만 하고, 계약 변경이 필요하면 직접 고치지 않고 사용자에게 보고한다.
    - 두 에이전트가 같은 TASK나 같은 파일을 동시에 다루지 않는다. 화면 TASK는 해당 API TASK가 끝나고 사용자가 커밋한 뒤에 시작한다.
    - 작업을 시작할 때 `git status`와 `docs/tasks.md` 상태를 확인해 다른 에이전트가 진행 중인 TASK와 겹치지 않는지 본다.

## 6. Security and Permissions

- **비밀정보**: `KAKAO_CLIENT_SECRET`, `SESSION_SIGNING_KEY`, `PHONE_ENCRYPTION_KEY`, `KAKAO_TOKEN_ENCRYPTION_KEY`(D-16), `ALIMTALK_API_KEY`는 소스 코드·설정 파일·커밋에 넣지 않고 Workers Secrets로 관리한다. 로컬 `.dev.vars` 사용 시 `.gitignore` 포함 여부를 먼저 확인한다.
- **권한·세션·CSRF**: 역할(`USER`·`OPERATOR`·`ADMIN`, §16)은 서버의 모든 관리 API에서 `requireRole`로 검사하고 `/admin*`·`/api/admin*`에 Cloudflare Access를 적용한다. 사용자 API는 `trial_records.user_id = session.userId`를 서버에서 확인(타인 소유는 `404 NOT_FOUND`)하고, 상태 변경 요청은 `Origin` 헤더를 검사한다. 세션 토큰은 SHA-256 해시만 D1에 저장한다. 발표용으로는 Cloudflare Access를 짧은 시간에 적용할 수 있으면 쓰고, 안 되면 서버 역할 검사만 쓴다(T32). 서버 역할 검사는 어느 경우에도 생략하지 않는다.
- **입력과 URL 검증**: 서버에서 zod로 요청을 검증하고 오류는 RFC 9457 `application/problem+json`으로 반환한다(`docs/architecture.md` §8). `signupUrl`, `supportContact.url`, `eduBenefit.url`, `escapeLinkFallbackUrl`, `CatalogRequest.serviceUrl`은 `https:`만 허용하며, `escapeLink`는 `https:` 또는 `forcedChannel = APP`일 때 `app_settings`의 `catalog.allowedDeepLinkSchemes`(기본값 `[]`)에 등록된 커스텀 스킴만 허용한다(`G4`). 카카오 OAuth `returnTo`는 내부 경로(`/`로 시작, `//` 금지)만 허용하고, 알림 링크에는 로그인 토큰을 넣지 않는다.
- **개인정보 및 탈퇴 (`D-08`·`D-14`·`D-16`)**:
  - 전화번호와 카카오 refresh token은 AES-GCM으로 암호화 저장한다. 카카오 access token은 DB에 저장하지 않는다.
  - 전화번호·카카오 ID·카카오 토큰·세션 토큰·쿠키를 로그에 남기지 않는다.
  - `ChurnReport`(발표용 리포트 화면 포함)에는 개인 식별 정보(`userId` 포함)를 넣지 않는다.
  - 회원 탈퇴 시 식별 정보와 모든 관련 기록을 즉시 삭제한다(§15). 대상은 `TrialRecord`, `NotificationSchedule`, `ExitPollResponse`, `BrokenLinkReport`, `kakao_message_tokens`, `featured_events`, P1·P2 테이블이고, 운영자 탈퇴 시에는 `CatalogChangeLog`·`ReportGrant`까지 포함한다.
  - 탈퇴(T24)는 발표 범위에서 보류했으므로, 일반 사용자에게 공개하기 전에 반드시 구현한다.
- **환경 분리**: `dev`·`staging`·`production`의 D1·R2·Secrets를 분리하고(발표 전에는 staging을 만들지 않고 `dev`와 `production`만 쓴다), `staging`에서는 `NOTIFICATION_MODE`를 `log`로만 허용해 실제 알림톡·카카오 메시지가 발송되지 않게 한다. 발표용 production은 `kakao_memo`(카카오 '나에게 보내기', D-16)를 쓴다. 운영 비밀값이나 데이터를 개발 환경에 복사하지 않는다.
- **승인이 필요한 작업**: 원격(staging·production) DB 조회·수정·마이그레이션 적용, 클라우드 리소스 생성, `wrangler deploy`, Secrets 등록·변경, 외부 알림톡·카카오 메시지 실제 발송, 의존성 패키지 설치, `git commit`·`git push`·파괴적 Git 명령은 사용자의 명시적 승인 없이 하지 않는다. D1 스키마 변경은 `migrations/` 파일로만 한다.

## 7. Verification

- **명령어** (T01에서 실제 실행해 확인): 검증 진입점은 `npm run verify`(`lint` → `typecheck` → `test` → `build` 순서)이며 작업 완료 전에 실행한다. 실행하지 않은 검증을 통과했다고 보고하지 않는다.

| 명령 | 내용 |
| :--- | :--- |
| `npm run lint` | ESLint (모듈 경계·`Clock` 규칙 포함) |
| `npm run typecheck` | worker·web tsconfig 각각 `tsc --noEmit` |
| `npm test` | Vitest + `@cloudflare/vitest-plugin`(로컬 D1, `migrations/` 자동 적용) |
| `npm run build` | `vite build`(→`dist/web`) 후 `wrangler deploy --dry-run --env production`(원격 배포 없음) |
| `npm run gen:api` | `api/openapi.yaml` → `src/shared/api-types.ts` |
| `npm run format` | Prettier 쓰기 모드 |
| `npm run seed:admin -- <카카오 회원번호> [--remote]` | 먼저 로그인한 계정을 `ADMIN`으로 승격(로컬 D1 기본). `--remote`는 production D1이므로 사용자 승인 후에만 실행 |
| `npm run dev` / `npm run dev:web` | `wrangler dev`(웹 빌드 후) / Vite 개발 서버(포트 5173 고정, `/api`·`/auth`는 `localhost:8787`로 프록시. Origin 검사를 통과하도록 개발 서버 자신의 Origin만 Worker 주소로 바꿔 전달) |
- **수용 기준 연결**: 테스트는 `describe('TT 알림 스케줄 [S13][S26]')`, `it('V-08 UNPUBLISHED 항목은 경로 A 생성 거부')`처럼 `SPEC.md` Testing Decisions 항목·`V-01~V-10`·사용자 스토리 번호로 추적할 수 있게 이름 짓는다(`docs/architecture.md` §10, `docs/tasks.md` 추적표 2).
- **테스트 방식**: Vitest + `@cloudflare/vitest-plugin`으로 마이그레이션을 적용한 격리 로컬 D1에서 실행한다. 각 모듈 `application/` 명령·조회 핸들러를 테스트 seam(`[확정]`)으로 삼아 관찰 가능한 결과만 검증하고, 경계에서 `FakeClock`, `FakeNotificationSender`, `FakeRecipientResolver`, `FakeKakaoOAuthClient`(카카오 OAuth 포트)만 테스트 더블로 교체한다. 외부 HTTP 어댑터(`kakao-memo`, 카카오 OAuth, 알림톡)의 단위 테스트만 예외로 `fetch`를 모의한다(V-10). 실제 알림톡이나 카카오 메시지를 보내는 테스트는 만들지 않는다.
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
