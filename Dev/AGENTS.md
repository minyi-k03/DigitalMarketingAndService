# AGENTS.md

구독컷(SubCut) 프로젝트에서 Google Antigravity와 Claude Code가 공통으로 따르는 작업 지침이다.
기능 요구사항의 세부 내용은 이 파일이 아니라 `spec_v1.8.md`에 있다.

## 1. Project Overview

- **목적**: 대학생·청년층이 신용카드 연동 없이 무료체험을 등록·추적하고, 유료 전환 직전에 검증된 해지 안내로 빠져나오도록 돕는다. 동시에 B2B 파트너사에 체험단 유입 채널과 이탈 사유 데이터를 제공하는 양면 시장 서비스다.
- **핵심 기능**: 사전 검증된 카탈로그 탐색, 1초 간편 등록(Auto-fill), `SafeEndDate` 기준 카카오 알림톡, `EscapeBridge` 경유 해지와 `ExitPoll`, 사후 구제(`RefundTemplate`), `SponsoredTrial`·`AlternativeMatch`·`ChurnReport`.
- **작업 전 필수**: 기능을 구현하거나 바꾸기 전에 `spec_v1.8.md`의 관련 절(User Stories, Implementation Decisions §1~§19, Testing Decisions)을 읽는다.
- **현재 파일 구성** (2026-10-21 확인, 이 폴더 = `목업html/`):

| 경로 | 내용 |
| :--- | :--- |
| `spec_v1.8.md` | 요구사항 명세서 (기준 문서) |
| `DESIGN-notion.md` | Notion 디자인 언어 분석 문서. 명세서에서 채택 여부를 언급하지 않으므로 UI 참고 자료로만 본다 |
| `../시장분석,사용자분석/아이디어 구체화 최종.md` | 도메인 용어집 v1.4와 ADR-0001~0005 요약 (파일명과 내용이 다르니 주의) |
| `../Test/` | 이전 목업(`index3.html`)을 Cloudflare Workers 정적 자산으로 배포하는 설정(`worker.js`, `wrangler.jsonc`). 구독컷 구현 코드가 아니다 |

- **Git**: 저장소 루트는 상위 폴더 `디지털창업서비스기획과마케팅/`이고, 이 폴더와 루트의 `index*.html`은 작성 시점에 untracked 상태다. 작업 때마다 `git status`로 다시 확인한다.
- **개발 환경**: 루트 `README.md`에는 제목만 있고 `Test/README.md`는 비어 있어 개발 환경 정보가 없다. `package.json`, TypeScript 설정, 테스트 설정도 아직 없다.
- **기술 스택**: 명세서 §17은 Cloudflare Workers·TypeScript·D1·R2·Cron Trigger를 `[제안]`으로 둔다. 저장소에 실제로 구성되기 전에는 이를 확정된 사실로 취급하지 않으며, 프런트엔드 프레임워크는 미정이다.

## 2. Source of Truth

| 문서 | 역할 |
| :--- | :--- |
| `spec_v1.8.md` | 기능 요구사항, 상태 전이, 데이터 규칙, 수용 기준(Testing Decisions)의 기준 |
| 용어집 v1.4 (`../시장분석,사용자분석/아이디어 구체화 최종.md` §1~3) | 도메인 용어 정의와 *Avoid* 금지어. 코드 식별자와 UI 문구는 용어집 이름을 쓴다 |
| ADR 요약 (같은 파일 §4) | ADR-0001~0005 결정의 근거. 이를 뒤집는 구현은 하지 않는다 |
| 아키텍처 문서 (아직 없음) | 만들어지면 모듈 구조·인터페이스·스키마 등 "어떻게"를 다룬다. 요구사항을 바꾸지 못한다 |
| 테스트 문서 (아직 없음) | 만들어지면 테스트 전략·케이스와 수용 기준의 매핑을 다룬다 |

- 명세서가 용어집 정의를 넓혀 쓴 부분은 명세서 Further Notes §2에 정리되어 있으며, 그 범위에서는 명세서를 따른다. 그 밖의 충돌·누락은 임의로 해석하지 않고 위치와 함께 보고한다.
- 명세서가 근거로 드는 ADR-0006~0008과 용어집 v1.5는 아직 "후보"일 뿐 존재하지 않는다.
- **`[제안]` 항목**: 현재 기본안으로 구현에 쓰되 확정된 결정으로 표현하지 않는다. 바꿔야 하면 코드보다 명세서 개정을 먼저 요청한다(§17 규칙). Further Notes §1이 전체 목록이다.
- **핵심 설계에 영향을 주는 미결 사항** (해당 작업에 닿으면 근거와 함께 보고한다):
  - 기술 스택 전체(§17)와 프런트엔드 프레임워크
  - 테스트 seam 위치 (명세서상 사용자 확인 필요)
  - 알림톡 수신 번호 확보 방식 (Further Notes §4)
  - 탈퇴 시 `userId` 무작위 교체의 적법성, 보존 기간 (Further Notes §5)
  - P1·P2를 MVP 배포에 포함할지 여부 (§18)
  - 알림 발송 실패 시 대체 채널 (Further Notes §3)

## 3. Working Procedure

1. 작업 전에 관련 명세 절, 용어집, 파일 구조, `git status`를 확인한다.
2. 작업 규모를 구분한다.
   - **단일 기능 작업**: 한 모듈 안에서 끝나고 공개 인터페이스·스키마를 바꾸지 않는 작업. 바로 진행하되 관련 명세 절을 근거로 남긴다.
   - **복잡한 작업**: 여러 파일·모듈에 걸치거나, 공개 명령·조회 API, D1 스키마·마이그레이션, 상태 머신, 알림 스케줄링 규칙, 기술 스택을 바꾸는 작업. 구현 전에 계획, 변경 범위, 관련 명세 절, 영향받는 테스트를 제시하고 승인을 받는다.
3. 요구사항을 임의로 바꾸거나 요청과 무관한 리팩터링·서식 정리를 하지 않는다.
4. 우선순위는 명세서 §18을 따른다: P0(MVP 필수) → P1(양면 시장) → P2(B2B 수익화). P0 단계부터 데이터 모델에 `kind`, `publicationStatus`, `ownerPartnerId`를 포함한다.
5. 의존 관계를 지킨다: `TrialRecord` 생성은 `CatalogItem`과 `User`가, `EscapeBridge`는 Trial Tracking의 `StartCancelAttempt`가, `ChurnReport`·`AlternativeMatch`는 `ExitPollResponse`·`FeaturedEvent`가 먼저 있어야 한다.
6. 기존 사용자 변경 사항을 보존한다. untracked 파일(루트 `index*.html` 등)과 `Test/`를 요청 없이 수정·삭제하지 않고, `git reset --hard`, `git clean`, 강제 push, 요청 없는 commit·push를 하지 않는다.

## 4. Architecture and Coding Rules

- **모듈 경계** (명세서 §1): 각 모듈은 자기 도메인 객체만 직접 변경하고, 다른 모듈은 공개 명령·조회 인터페이스로만 호출한다. 다른 모듈의 테이블을 직접 쓰지 않는다.
  1. **Catalog & Marketplace**: `CatalogItem`, `Partner`, 게시 상태, 피처드 슬롯, `CatalogChangeLog`, `CatalogRequest`
  2. **Trial Tracking & Schedule**: `TrialRecord` 생성·수정·상태 전이, 날짜 산정, `NotificationSchedule`, `SavedAmount`
  3. **EscapeBridge & Recovery**: 브릿지 화면, `BrokenLinkReport`, `RefundTemplate`
  4. **B2B Analytics & Matching**: `FeaturedEvent`, `ChurnReport`, `ReportGrant`, `AlternativeMatch`
  5. **Identity & Account**: `User`, 세션, 알림 수신 설정, 탈퇴, 역할
- **상태 머신**: `TrialRecord` 상태는 Trial Tracking의 단일 진입점에서만 바꾸고, 전이표(§5)에 없는 전이는 오류로 거부한다. 상태가 바뀌면 `statusChangedAt`을 갱신한다.
- **`ExitPoll` 일관성**: 응답 저장(`ExitPollResponse`와 `TrialRecord.exitReason` 사본)과 상태 전이는 하나의 원자적 단위로 처리한다. `TRACKING`에는 응답이 없고 `CANCEL_ATTEMPTED`·`CANCELED_CONFIRMED`에는 정확히 1건이 있다는 불변식을 깨는 경로를 만들지 않는다.
- **날짜와 시각**:
  - 날짜(`startDate`, `billingDate`, `safeEndDate`)는 KST 달력 날짜 `YYYY-MM-DD`이며 일 단위 연산만 쓴다.
  - 시각(발송 예정, 전이 시각 등)은 UTC ISO 8601로 저장한다.
  - '오늘(KST)'은 UTC 현재 시각 + 9시간의 날짜다. Cron 표현식은 UTC 기준이다.
  - 현재 시각은 항상 주입된 시계에서 얻고, 도메인 로직에서 시스템 시계를 직접 호출하지 않는다.
- **알림**:
  - 날짜가 바뀌면 §6의 재예약 규칙을 따른다(미발송 예약 취소 → 새 날짜로 재계산 → 필요 시 늦은 등록 즉시 발송).
  - 발송 멱등성: (`trialRecordId`, `slot`, `safeEndDate`) 유일 제약, `PENDING → SENDING` 조건부 선점, `MISSED_BILLED` 전이의 상태 조건부 UPDATE (§17).
  - 발송은 포트(인터페이스) 뒤에 두어 테스트 더블로 교체할 수 있게 한다.
  - 알림 링크는 외부 URL이 아니라 구독컷 내부 화면으로 연결하며(ADR-0001), 알림톡에는 정보성 내용만 넣는다.
- **공개 데이터와 관리 데이터의 경계**: 카탈로그 목록·상세 응답은 `CatalogItemPublicView`만 반환한다(`escapeLink`, `escapeLinkFallbackUrl`, `ownerPartnerId`, `darkPatternScores`, `publicationStatus` 제외). 직링크는 `StartCancelAttempt` 결과, `CANCEL_ATTEMPTED` 재진입, 안내 모드에서만 반환한다.
- **카탈로그 변경 반영**: 필드별 진행 중 기록 반영 규칙(§2)과 `SavedAmount` 스냅샷 규칙(§8)을 따르고, 모든 카탈로그 변경을 `CatalogChangeLog`에 남긴다.
- **범위 밖 기능 금지**: 대리 해지, 카드·계좌 연동, 해지 화면 크롤링, 환불 대행 발송은 구현하지 않는다(Out of Scope, ADR-0001·0004·0005).
- **이름**: 도메인 타입·필드 이름은 명세서 §19와 용어집을 따른다. 용어집 *Avoid* 목록의 단어를 식별자로 쓰지 않는다.
- **코딩 규칙**: 언어, 린터, 포매터, 디렉터리 구조가 저장소에 설정되면 그 설정을 따르고 이 절에 추가한다. 설정되기 전에는 특정 규칙을 가정하지 않는다.

## 5. Skills Usage

- 작업 목적에 맞는 설치된 Skill만 골라 쓴다. 모든 작업에 모든 Skill을 실행하지 않는다.
- 목적별 선택 기준: 구현(테스트 우선 절차), 버그 분석(체계적 디버깅 절차), 리뷰(코드 리뷰 절차), 보안 검사(보안 리뷰 절차), 완료 전 확인(검증 절차). 절차의 세부 내용은 각 Skill 문서를 따르고 여기에 옮겨 적지 않는다.
- 명세서의 기본 스택안(Cloudflare·D1)과 맞지 않는 Skill(예: Vercel 배포, Supabase Postgres 전용)은 스택이 바뀌기 전에는 쓰지 않는다.
- 이 프로젝트에는 프로젝트 전용 Skill 폴더가 없다. 사용자 수준 Skill은 도구마다 경로와 목록이 다르다(작성 시점 기준 Claude Code는 `~/.claude/skills/`, Antigravity는 `~/.gemini/config/skills/` 등). 한 도구에 있는 Skill이 다른 도구에서도 인식된다고 가정하지 말고, 없으면 같은 목적을 수동으로 수행한다.

## 6. Security and Permissions

- **비밀정보**: 알림톡 API 키, 카카오 로그인 Client Secret, 세션 서명 키 등은 소스 코드·설정 파일·커밋에 넣지 않는다. 명세서 기본안은 Workers Secrets다. 로컬 비밀값 파일을 쓰게 되면 `.gitignore`에 포함되어 있는지 먼저 확인한다.
- **권한**: 역할(`USER`·`OPERATOR`·`ADMIN`, §16)은 서버의 모든 관리 API에서 검사한다. 사용자 API는 요청한 `userId`가 대상 `TrialRecord`의 소유자인지 서버에서 확인한다. `Partner`는 `ownerPartnerId`가 자신인 항목의 리포트만 받는다. 클라이언트 화면 숨김을 권한 검사로 대신하지 않는다.
- **입력과 URL 검증**: 명세서의 입력 검증(§3, §2)을 서버에서 수행한다. `escapeLink`, `escapeLinkFallbackUrl`, `signupUrl`, `supportContact.url`, `CatalogRequest.serviceUrl` 등 외부 URL은 허용 스킴을 명시적으로 검증한다. 알림 링크에는 로그인 토큰을 넣지 않고 기록 ID만 넣는다.
- **개인정보**: 전화번호는 암호화해 저장하고(§17 `[제안]`), 전화번호·카카오 ID·세션 값을 로그에 남기지 않는다. `ChurnReport`에는 개인 식별 정보를 넣지 않는다. 알림 수신 거부와 탈퇴는 §6·§15 규칙을 따른다.
- **환경 분리**: `dev`·`staging`·`production`의 D1·R2·비밀값을 분리하고(§17 `[제안]`), `staging`에서는 실제 알림톡을 보내지 않는다. 운영 비밀값이나 데이터를 개발 환경에 복사하지 않는다.
- **승인이 필요한 작업**: 운영 DB 조회·수정, 데이터 삭제·일괄 변경, 스키마 마이그레이션 적용, `wrangler deploy` 등 배포(기존 `Test/` 배포 포함), 비밀값 변경, 외부 서비스로의 실제 발송은 사용자의 명시적 승인 없이 하지 않는다. 스키마 변경은 마이그레이션 파일로만 한다.

## 7. Verification

- **명령어**: 현재 저장소에는 테스트·린트·타입 검사·빌드 명령이 설정되어 있지 않다. 명령을 지어내지 말고, 프로젝트 설정이 생기면 그 설정에서 확인한 명령을 쓰고 이 절에 기록한다.
- **수용 기준 연결**: 테스트는 명세서 Testing Decisions의 항목과 사용자 스토리 번호로 추적할 수 있게 이름 짓거나 주석을 단다.
- **테스트 방식**: 모듈의 공개 명령·조회 인터페이스로 관찰 가능한 결과만 검증한다. seam 위치(애플리케이션 서비스 계층)는 `[제안]`이므로 첫 테스트 구조를 만들기 전에 확인받는다.
- **반드시 다룰 경계**:
  - 상태 머신의 모든 허용 전이와 대표적인 불허 전이, `ExitPoll` 불변식과 원자성
  - 글로벌/국내 항목별 `SafeEndDate`, 월말·연말·윤년
  - KST 00:00~09:00(UTC 전날) 구간의 '오늘' 계산, `SafeEndDate` 당일 23:59:59 KST, 당일 해지 확인 알림의 20:00·21:00 기준
  - Cron 중복 실행과 `MISSED_BILLED` 배치 재실행 시 멱등성
- **시계와 발송**: 날짜·시각 로직은 주입 가능한 시계로, 알림 발송은 테스트 더블로 검증한다. 실제 알림톡을 보내는 테스트를 만들지 않는다.
- **결과 보고**: 실제로 실행한 명령의 출력으로 성공과 실패를 구분한다. 실행하지 않은 테스트를 통과했다고 보고하지 않으며, 실패했거나 실행할 수 없었던 검증은 원인과 함께 보고한다.

## 8. Completion Report

모든 작업을 완료하면 다음을 보고한다.

1. 변경 사항과 변경 이유
2. 주요 수정 파일 및 요구사항과의 연관성
3. 실제 실행한 검증 명령과 결과
4. 남아 있는 문제, 위험 요소 및 미확정 사항
5. 추가로 필요한 사용자 결정이나 승인
