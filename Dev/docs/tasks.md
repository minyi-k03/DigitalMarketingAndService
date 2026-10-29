# 구독컷(SubCut) TASK 목록

> 기준: `SPEC.md` v1.11, [architecture.md](architecture.md), [implementation-plan.md](implementation-plan.md)
> 작성일: 2026-10-23, 발표용 범위 반영: 2026-10-27
> **발표용 범위** ([implementation-plan.md §7](implementation-plan.md#7-발표용-범위와-일정-2026-12-09-발표))
> - `대기 (발표용 간소화)` 표시가 있는 TASK는 §7.2에 적은 범위만 구현합니다.
> - `보류` TASK는 발표 뒤에 진행합니다.
> - 발표용 신규 TASK는 T34·T35·T60~T63입니다.

## 읽는 법

- 각 TASK에는 다음 항목이 있습니다.
  - **근거**: SPEC 절(§)과 스토리 번호(Sn)
  - **선행**: 먼저 끝나야 하는 TASK
  - **완료 기준**: 통과해야 하는 테스트. Testing Decisions 모듈 약어(TT·EB·CM·IA·BA)와 V-nn을 씁니다.
  - **주요 파일**
- **상태**: `대기` / `차단(사유)` / `진행` / `완료`. 작업하면서 이 문서를 갱신합니다.
- 테스트 이름에는 스토리 번호와 Testing Decisions 항목을 붙입니다(AGENTS §7).
- 경로 접두사: `w/` = `src/worker/`, `m/` = `src/worker/modules/`

---

## Phase 0: 결정·계약

### T00 아키텍처·계약·TASK 문서 — `완료`
- **근거**: SPEC FN §7 D-06·D-07·D-09, AGENTS §2
- **산출물**:
  - `docs/architecture.md`
  - `docs/adr/ADR-0008-…`
  - `api/openapi.yaml`
  - `docs/implementation-plan.md`
  - 이 문서
  - SPEC v1.10 최소 개정

---

## Phase 1: 기반 (P0)

### T01 프로젝트 스캐폴드 — `완료`
- **근거**: §17, ADR-0008, AGENTS §4·§7
- **선행**: T00 (G1 반영 완료)
- **내용**:
  - `package.json`(스크립트 `dev`·`build`·`test`·`typecheck`·`lint`·`format`·`gen:api`)
  - `tsconfig`(worker·web 분리)
  - `wrangler.jsonc`(env `staging`·`production`, D1·R2 바인딩, cron 2종, assets SPA fallback, `NOTIFICATION_MODE`)
    - 실제 구현(2026-10-29): `staging`은 발표 전 만들지 않는다(implementation-plan §7.2 T32). R2 바인딩은 무료 플랜 조건(카드 등록 없음)으로 보류해 `Env.BLOBS`를 선택 타입으로 두었고, 로고 업로드가 필요한 T09 이후 사용 여부를 정한다.
  - `vitest.config.ts`(pool-workers, 마이그레이션 자동 적용)
  - ESLint(모듈 경계 `no-restricted-imports`, 도메인 `Date` 직접 호출 금지)·Prettier
  - `.gitignore`(`.dev.vars`, `node_modules`, `dist`)
- **완료 기준**:
  - 위 스크립트가 빈 프로젝트에서 성공합니다.
  - 확인한 명령을 `AGENTS.md` §4·§7에 기록합니다.
  - 의존성 설치 전에 사용자 확인을 받습니다.
- **주요 파일**: `package.json`, `wrangler.jsonc`, `vitest.config.ts`, `eslint.config.js`, `AGENTS.md`

### T02 shared kernel — `완료`
- **근거**: §4 시간대 처리, §17 시계 주입, Testing Decisions
- **선행**: T01
- **내용**:
  - `Clock`, `SystemClock`, `FakeClock`
  - `KstDate`, `todayKst`, `addDays`, `kstAt`, `kstDateOf`
  - `DomainError`(code 열거형 = openapi `Problem.code`)
  - id 생성
- **완료 기준**:
  - 월말(1/31+1)·연말(12/31+1)·윤년(2/28+1 → 2/29, 2/29+1)·평년 테스트 통과
  - KST 00:00~08:59(UTC 전날) 구간의 `todayKst` 테스트 통과
  - `SafeEndDate` 당일 23:59:59 KST와 다음 날 00:00:00 KST 판정 테스트 통과
- **주요 파일**: `src/shared/kst-date.ts`, `w/platform/clock.ts`, `w/platform/errors.ts`

### T03 마이그레이션 0001 (P0 스키마) — `완료`
- **근거**: §19, §18 (`kind`·`publicationStatus`·`ownerPartnerId` 포함), §17 유일 제약, §5 불변식
- **선행**: T01
- **내용**: [architecture.md §7](architecture.md#7-데이터-모델-d1-migrations0001_p0_initsql)의 10개 테이블, CHECK, 부분 UNIQUE, 인덱스, `app_settings` 기본값(발송 시각 10:00, 기준표 2/4, `catalog.allowedDeepLinkSchemes` `[]`)
  - 발표용 추가(D-16·D-17): `kakao_message_tokens`, `featured_events`, `catalog_items.published_at`·`featured_order`(D-12 일부 확정, 2026-10-27)
- **완료 기준**:
  - 로컬 D1에 적용됩니다.
  - 제약 테스트 통과: `exit_reason` CHECK 위반 거부, 진행 중 중복 INSERT 거부, `(trial_record_id, slot, safe_end_date)` 중복 거부
  - 원격 적용은 하지 않습니다.
- **주요 파일**: `migrations/0001_p0_init.sql`

### T04 HTTP 골격 — `완료`
- **근거**: D-06, architecture §8
- **선행**: T02
- **내용**:
  - Hono 앱, `/api`·`/auth` 라우팅, 나머지 경로는 assets
  - `DomainError` → problem+json 매핑, zod 검증 미들웨어
  - `Origin` 확인, PII 마스킹 로거
  - `gen:api`로 `src/shared/api-types.ts` 생성
  - composition root(Clock·D1·포트 주입)
- **완료 기준**: HTTP 테스트에서 잘못된 본문이 `400 VALIDATION_FAILED` problem+json을 돌려줍니다.
- **주요 파일**: `w/index.ts`, `w/http/*`

---

## Phase 2: Identity & Account (P0)

### T05 카카오 로그인·세션 — `완료 (로컬·production에서 실제 카카오 로그인 확인 2026-10-29)`
- **근거**: §15 로그인·세션, §19 `User`(G6 확정), S16, IA "알림 링크 로그인 후 복귀"
- **선행**: T03, T04
- **내용**:
  - `KakaoOAuthClient` 포트와 어댑터
  - 서명된 `state{nonce, returnTo}`, `returnTo`는 내부 경로만 허용
  - 사용자 upsert, `sessions` 저장(해시), 쿠키 발급
  - `requireSession`, 로그아웃
  - 엔드포인트: `GET /auth/kakao/login`, `GET /auth/kakao/callback`, `POST /auth/logout`, `GET /api/me`
  - 발표용 추가(D-16):
    - 로그인 때 `talk_message` 동의를 요청합니다.
    - refresh token을 `kakao_message_tokens`에 암호화 저장합니다.
    - `getKakaoMessageAccessToken`을 만듭니다(V-10의 토큰 갱신 부분).
    - 선행: N8 카카오 앱 등록
- **완료 기준**:
  - 세션 없이 보호 API를 부르면 401과 `loginUrl`(returnTo 포함)을 받습니다.
  - 콜백 후 `returnTo`로 돌아옵니다.
  - 외부 URL `returnTo`는 거부합니다.
  - 만료 세션은 거부합니다.
- **주요 파일**: `m/identity/*`, `w/ports/kakao-oauth.ts`, `w/adapters/kakao-oauth.ts`

### T06 역할과 관리 API 차단 — `완료 (발표용 간소화: 차단과 ADMIN 시드만. 시드 스크립트는 로컬 D1에서 수동 확인, 원격은 미실행)`
- **근거**: §16 역할·접근 제어, S47, IA "역할별 관리 API 접근 차단"
- **선행**: T05
- **내용**: `requireRole('OPERATOR'|'ADMIN')`, `PUT /api/admin/users/{id}/role`(ADMIN), 최초 ADMIN 부트스트랩 방법(로컬 시드 스크립트)
- **완료 기준**: USER가 관리 API를 부르면 403, OPERATOR가 ADMIN 전용 API(역할·설정·기준표)를 부르면 403을 받습니다.
- **주요 파일**: `m/identity/*`, `w/http/middleware/role.ts`

### T07 알림 수신 설정과 RecipientResolver 포트 — `대기`
- **근거**: §6 수신 거부, §15 알림 수신 설정, S44, FN §4
- **선행**: T05
- **내용**:
  - `PUT /api/me/notification-settings`
  - `RecipientResolver` 포트(`resolve(userId) → recipient | null`)와 `FakeRecipientResolver`
  - `getNotificationRecipient` 공개 조회
  - **결정 (2026-10-29, A안)**: `Me.hasRecipient`는 `RecipientResolver` 기준으로 판정한다. 현재는 전화번호 저장 여부(`phone_number_encrypted`)로 판정하고 openapi 설명도 "알림톡 수신 번호 확보 여부"여서, 발표용 `kakao_memo`(D-16)에서는 수신처가 `talk_message` 동의 토큰인데도 `false`가 나온다. `NOTIFICATION_MODE`별로 `kakao_memo`는 유효한 카카오 토큰이 있으면, `dealer`는 전화번호가 있으면 `true`로 한다. 구현할 때 `me.ts`의 판정과 openapi 설명을 함께 바꾸고(`openapi.yaml` 변경이므로 착수 전 계획 승인), `/api/me` 테스트(`tests/http/auth.test.ts`, `tests/identity/identity.test.ts`)의 기대값을 갱신한다.
- **완료 기준**: 설정 변경이 `Me`에 반영되고, 포트 fake로 수신 번호 유무를 바꿀 수 있습니다(SKIPPED 검증은 T17).
- **주요 파일**: `m/identity/*`, `w/ports/recipient-resolver.ts`

---

## Phase 3: Catalog & Marketplace (P0)

### T08 카탈로그 도메인 검증 — `대기`
- **근거**: §2 전체(G4 확정 포함), §19 `CatalogItem`, S4·S18·S24·S38·S39
- **선행**: T02
- **내용**:
  - 필수 필드(`name`, `lastVerifiedAt`, `serviceCategory` 등)
  - `escapeGuideSteps` 1~3개
  - `PC_OR_APP_FORCED` ⇔ `forcedChannel` 필수 / 그 밖에는 비어 있음
  - `forcedChannel=APP`이면 `escapeLinkFallbackUrl` 필수
  - `SPONSORED_TRIAL`이면 `signupUrl`·`ownerPartnerId` 필수
  - `supportContact`는 email·url 중 하나 이상
  - URL 스킴은 `https:`만 허용하되, `escapeLink`는 `forcedChannel=APP`일 때 `app_settings`의 `catalog.allowedDeepLinkSchemes`(기본값 `[]`)에 등록된 커스텀 스킴도 허용(G4 확정)
  - 원점수 → 등급 계산(기준표 경계값 주입)
- **완료 기준**: CM "`EscapeGuide` 4단계 이상 거부", "원점수→등급 변환", "`forcedChannel` 필수·비어 있음", "대체 URL 필수", "`ownerPartnerId` 필수", "`name`·`lastVerifiedAt` 필수와 `signupUrl` 필수", "URL 스킴 검증(G4: `https:` 외 거부, `escapeLink` 커스텀 스킴은 `forcedChannel = APP`이고 `catalog.allowedDeepLinkSchemes`에 등록된 경우만 허용, 기본값 `[]`에서는 거부)"
- **주요 파일**: `m/catalog/domain/*`

### T09 카탈로그 관리 명령과 변경 이력 — `대기 (발표용 간소화: 되돌리기 제외)`
- **근거**: §2 게시 상태·반영 규칙, §16 변경 이력·최종 검증일, S38·S47·S48, V-06
- **선행**: T06, T08
- **내용**:
  - `createCatalogItem`(`GUARDED_SERVICE`는 `PUBLISHED`로 생성)
  - `updateCatalogItem`(필드별 diff → `CatalogChangeLog`, `markVerified`)
  - `changePublicationStatus`(`SUBMITTED→PUBLISHED|REJECTED`, `PUBLISHED→UNPUBLISHED`)
  - `revertCatalogChange`
  - 관리 API 라우트: `GET /api/admin/catalog-items`, `POST /api/admin/catalog-items`, `GET /api/admin/catalog-items/{id}`, `PATCH /api/admin/catalog-items/{id}`, `POST /api/admin/catalog-items/{id}/publication-status`, `GET /api/admin/catalog-items/{id}/change-logs`, `POST /api/admin/change-logs/{id}/revert`
  - `applyBufferToActiveRecords`는 T16의 `prepareBufferChange`를 붙일 자리로 두고, T16에서 연결합니다.
- **완료 기준**: CM "게시 상태 전이", "변경 이력 기록", V-06(되돌리면 새 이력이 생성됨), 필드별 반영 규칙 중 즉시 반영 필드
- **주요 파일**: `m/catalog/application/*`, `m/catalog/infra/*`, `w/http/routes/admin-catalog.ts`

### T10 공개 카탈로그 조회 — `대기`
- **근거**: §2 D-11·D-13, §7 비노출·상세 범위, S1·S2·S5·S6, V-01·V-03·V-08
- **선행**: T03, T08
- **내용**:
  - `listCatalog{category,q}`, `getCatalogItem` → `CatalogItemPublicView`(타입 수준에서 관리 필드 제외)
  - `getTrackingTerms`, `getEscapeContent`(내부 전용)
  - 엔드포인트: `GET /api/catalog`, `GET /api/catalog/{id}`
- **완료 기준**:
  - V-01(분야 필터, `SUBMITTED`·`REJECTED` 제외)
  - V-03(상세 필드 포함)
  - EB "목록·상세 응답에 `escapeLink`·`escapeLinkFallbackUrl` 없음"
  - V-08 중 "`publicationStatus`가 두 값으로만 내려감"
- **주요 파일**: `m/catalog/application/queries.ts`, `w/http/routes/catalog.ts`

### T11 로고 업로드 (R2) — `보류(발표 범위 밖: 로고는 정적 파일로 대체)`
- **근거**: §2 표시 필드(로고는 구독컷 저장소 `[확정]`)
- **선행**: T09
- **내용**: `BlobStore` 포트와 R2 어댑터. PNG·JPEG·WebP만 받고 크기를 제한합니다. 업로드 후 `logoUrl`을 갱신하고 이력을 남깁니다. 로고는 Worker 경로(`/logos/{key}`)로 제공합니다. 엔드포인트: `PUT /api/admin/catalog-items/{id}/logo`
- **완료 기준**: 허용하지 않는 형식과 크기 초과는 400, 업로드 후 `logoUrl` 변경 이력이 남습니다.
- **주요 파일**: `w/ports/blob-store.ts`, `w/adapters/r2-blob-store.ts`

### T12 다크패턴 기준표 및 운영 설정 관리 — `보류(발표 범위 밖: 기본값 사용)`
- **근거**: §2 기준표·G4(`allowedDeepLinkSchemes`), §6 G5(`notificationSendTime`), §16 ADMIN, S39
- **선행**: T09
- **내용**:
  - `PUT /api/admin/dark-pattern-rubric` → `app_settings` 갱신 후 전 항목 등급 재계산(이력 기록)
  - `GET /api/admin/settings`, `PATCH /api/admin/settings` → Catalog(`catalog.allowedDeepLinkSchemes`)와 Trial Tracking(`notification.sendTime`, `notification.templates`)의 설정 조회·변경 조합(ADMIN 전용)
- **완료 기준**: CM "기준표 변경 시 재계산", ADMIN 설정 조회·변경 반영(변경된 발송 시각은 이후 생성·재예약 슬롯부터 적용)
- **주요 파일**: `m/catalog/application/rubric.ts`, `m/catalog/application/settings.ts`, `m/trial-tracking/application/settings.ts`, `w/http/routes/admin-settings.ts`

---

## Phase 4: Trial Tracking & Schedule (P0 핵심, 테스트 우선)

### T13 체험 기록 생성 (1초 간편 등록) — `대기`
- **근거**: §3 경로 A·입력 검증, §4 날짜 산정, S7·S8·S11·S12, V-08
- **선행**: T05, T10
- **내용**:
  - `createTrialRecord`: Auto-fill
  - `bufferApplied` 복사, `billingDate`·`safeEndDate` 계산
  - 검증: 미래 시작일, 1~365, 이미 끝난 체험, `PUBLISHED` 아님, 진행 중 중복(409 + 기존 id)
  - `POST /api/trials`. 알림 예약은 T15·T16에서 붙입니다.
- **완료 기준**:
  - TT "Auto-fill", "날짜 산정(글로벌/국내, 월말·연말·윤년)", "입력 검증"
  - V-08(`UNPUBLISHED` 항목 생성 거부)
  - HTTP "생략 시 기본값 주입"
- **주요 파일**: `m/trial-tracking/*`, `w/http/routes/trials.ts`

### T14 상태 머신과 ExitPoll 원자성, SavedAmount — `대기`
- **근거**: §5 전체, §7 단일 명령, §8, S10·S20·S25·S28·S29·S30·S31
- **선행**: T13
- **내용**:
  - 전이표 데이터와 `applyTransition` 단일 진입점, 조건부 UPDATE
  - `startCancelAttempt`, `confirmCancel`, `decideKeep`, `voidTrialRecord`, `resolveMissedBilling`
  - 응답·전이를 하나의 batch로 처리, `savedAmount` 스냅샷
  - 종료 상태 전이 시 `PENDING` 슬롯 취소
  - 엔드포인트: `POST /api/trials/{id}/confirm-cancel`, `POST /api/trials/{id}/keep`, `POST /api/trials/{id}/void`, `POST /api/trials/{id}/billing-resolution` (본인 소유 확인, 타인 기록 404). `cancel-attempts`는 T21에서 연결
- **완료 기준**:
  - TT "상태 머신 모든 허용 전이와 대표 불허 전이(`KEPT→CANCEL_ATTEMPTED`, `CANCEL_ATTEMPTED→VOIDED`, `BILLED_CONFIRMED`의 모든 전이)"
  - TT "ExitPoll 불변식(함께 반영·함께 실패, 응답 없는 확정 거부, 기존 응답 보존)"
  - TT "SavedAmount(당일 포함, 다음 날·정정·`BILLED_CONFIRMED` 제외, `monthlyPrice` 변경 후 불변)"
- **주요 파일**: `m/trial-tracking/domain/transitions.ts`, `m/trial-tracking/application/*`, `w/http/routes/trials.ts`

### T15 알림 계획기 — `대기`
- **근거**: §6 전체, S13·S14·S15·S26·S27
- **선행**: T14
- **내용**:
  - `planInitialSlots`: D3·D1, 늦은 등록과 3가지 문구 변형
  - `planCancelConfirmSlots`: D1 → `D1_CONFIRM` 교체, 당일 해지 확인(글로벌 20:00, 국내 10:00 / +1h / 21:00 이후 없음). 사유 선택 시와 `CANCEL_ATTEMPTED` 재예약(G3, T16) 시 함께 사용
  - `AccessRetentionPolicy` × 변형 → 템플릿 키
  - [architecture §5.4](architecture.md#54-알림-계획기-6--순수-함수) 표 그대로 구현
- **완료 기준**:
  - TT "알림 스케줄" 전 항목
  - TT "국내 항목 당일 해지 확인 알림"
  - TT "`AccessRetentionPolicy`별 문구 분기"
  - 늦은 등록은 `BillingDate` 당일 등록과 글로벌·국내 각각을 포함합니다.
- **주요 파일**: `m/trial-tracking/domain/notification-planner.ts`

### T16 알림 저장·재예약·버퍼 변경 적용 — `대기 (발표용 간소화: prepareBufferChange 제외)`
- **근거**: §6 재예약 규칙(G3 확정), §2 버퍼 반영, §5 수정 범위, S42·S48
- **선행**: T15, T09
- **내용**:
  - 생성·전이 시 `notification_schedules` 저장(`INSERT OR IGNORE`)
  - `updateTrialRecord`(`TRACKING`·`CANCEL_ATTEMPTED`만, 재계산 → `PENDING` 취소 → 재계획 → 정규 슬롯 경과 시 `TRACKING`은 `LATE_REGISTRATION` 즉시 1회, `CANCEL_ATTEMPTED`는 마감 시각 이전이면 `SAME_DAY_CONFIRM` 1회 예약·발송)
  - `prepareBufferChange`(`BillingDate >= today`인 진행 중 기록만) → T09 `updateCatalogItem`과 한 batch로 실행
  - `PATCH /api/trials/{id}`
- **완료 기준**: TT "기록 수정(허용·거부 상태, 과거 `BillingDate` 거부, 미래 슬롯 재예약, 정규 슬롯 경과 시 `TRACKING` 즉시 1회 및 `CANCEL_ATTEMPTED` 당일 해지 확인 규칙 적용)", TT "버퍼 변경 적용(선택 시 대상만 재계산, 미선택 시 불변)", S-05
- **주요 파일**: `m/trial-tracking/application/update.ts`, `m/trial-tracking/application/buffer-change.ts`

### T17 발송 디스패처 — `대기`
- **근거**: §17 스케줄러·발송 멱등성, §6 발송 시각(G5 확정)·수신 거부, S13·S44
- **선행**: T16, T07
- **내용**:
  - `NotificationSender` 포트, `notification-log` 어댑터, `FakeNotificationSender`
  - `dispatchDueNotifications`: reclaim → expire → claim → send
  - 즉시 발송 `waitUntil` 경로
  - `scheduled` 핸들러(`*/10`)
  - 알림 링크(`/bridge/{id}`, `/trials/{id}`)
- **완료 기준**:
  - TT "발송 멱등성(Cron 겹침 실행 시 1회)"
  - TT "알림 수신 거부(`SKIPPED`, 상태 전이 지속, 다시 켜면 이후 슬롯만)"
  - 3회 실패 시 `FAILED`, `SENDING` 15분 복구, `BillingDate`가 지난 `ESCAPE_ALERT`는 `EXPIRED`
  - TT "발송 시각 설정 변경(G5: 기존 `PENDING`의 `sendAt` 유지, 이후 생성·재예약 슬롯만 새 시각)"
- **주요 파일**: `m/trial-tracking/application/dispatch.ts`, `w/ports/notification-sender.ts`, `w/adapters/notification-log.ts`

### T18 MISSED_BILLED 배치 — `대기`
- **근거**: §5 `BillingDate` 경과, §6 결제 확인 알림, §17 배치, S31, S-03
- **선행**: T17
- **내용**: 조건부 UPDATE … RETURNING → `PENDING` 취소 → `BILLING_CHECK` `INSERT OR IGNORE`, 누락분 보충, `scheduled`(`10 15 * * *`)
- **완료 기준**: TT "`MISSED_BILLED` 배치 두 번 실행해도 전이·알림 1회", 00:10 KST 실행 시 `todayKst` 판정
- **주요 파일**: `m/trial-tracking/application/missed-billed-batch.ts`

### T19 내 체험 목록·상세 조회 — `대기`
- **근거**: §13 전체, D-09, S23·S41
- **선행**: T14
- **내용**: `listMyTrials{tab}`(탭, 정렬, `dDayLabel`, `actions` — `MISSED_BILLED`에 `GO_TO_BRIDGE_GUIDE` 포함, `savedAmountTotal`, `activeCount`), `getTrialRecord`(본인 소유 확인, 타인 소유는 404), `GET /api/trials`, `GET /api/trials/{id}`
- **완료 기준**: TT "내 체험 목록(탭 구분, 정렬, D-Day 표기, 상태별 행동 버튼)" 및 단건 상세 조회(타인 기록 404)
- **주요 파일**: `m/trial-tracking/application/list-my-trials.ts`, `w/http/routes/trials.ts`

---

## Phase 5: EscapeBridge & Recovery (P0)

### T20 브릿지 화면 데이터 — `대기`
- **근거**: §7 진입 경로·`EscapePattern`별 동작, D-09, S16~S19·S22~S24, V-05
- **선행**: T14, T10
- **내용**: `getBridgeView` 모드 결정(POLL·REENTRY·GUIDE_ONLY·거부), `escapeLink` 노출 범위, `backupFirst`, `forcedChannel`, `GET /api/trials/{id}/bridge`
- **완료 기준**:
  - EB "`TRACKING` 진입 시 사유 버튼만 표시, 상태별 진입 허용 범위와 안내 모드"
  - EB "`EscapePattern`별 동작" 중 서버 측 데이터
  - V-05
- **주요 파일**: `m/escape-bridge/*`, `w/http/routes/bridge.ts`

### T21 사유 선택·재진입·'이미 가입했어요' — `대기`
- **근거**: §7 단일 명령·재진입·'이미 가입했어요', §19 `StartCancelAttemptResult`(G2 확정), S20·S21·S22·S46, V-08
- **선행**: T20
- **내용**: `selectExitReason` → TT `startCancelAttempt`, `POST /api/trials/{id}/cancel-attempts`. '이미 가입했어요'는 T13 API와 브릿지 이동을 조합합니다(중복이면 기존 기록으로 이동).
- **완료 기준**:
  - EB "사유 선택 한 번으로 `EscapeLink` 반환, 재진입 시 투표 생략"
  - EB "'이미 가입했어요' 경로로 기록 생성 후 브릿지 진입"
  - V-08(`UNPUBLISHED`는 '이미 가입했어요'도 거부, 기존 기록은 브릿지 계속 이용)
- **주요 파일**: `m/escape-bridge/application/select-exit-reason.ts`

### T22 환불 요청 템플릿 — `대기`
- **근거**: §9, S32
- **선행**: T14, T10
- **내용**: 국·영문 템플릿 생성(`name`·`startDate`·`supportContact` 자동 기입, 실제 결제일·결제 금액·이름 빈칸), `referenceBillingDate`. `MISSED_BILLED`·`BILLED_CONFIRMED`에서만 제공합니다(그 밖의 상태는 422). 엔드포인트: `GET /api/trials/{id}/refund-template`
- **완료 기준**: EB "`RefundTemplate` 국/영문 변수 자동 기입(`name` 포함), 실제 결제일 빈칸과 공식 결제 예정일 참고 표시"
- **주요 파일**: `m/escape-bridge/domain/refund-template.ts`, `w/http/routes/bridge.ts`

### T23 경로 오류 제보 — `대기 (발표용 간소화: 일괄 FIXED·markVerified 제외)`
- **근거**: §10, §16 최종 검증일, S34·S40
- **선행**: T20, T09
- **내용**: 제보 접수(24시간 중복 시 기존 반환), 관리 목록·상태 변경, 항목별 일괄 FIXED, 처리 수정 시 `markVerified`
  - 엔드포인트: `POST /api/trials/{id}/broken-link-reports`(사용자), `GET /api/admin/broken-link-reports`, `PATCH /api/admin/broken-link-reports/{id}`, `POST /api/admin/catalog-items/{id}/broken-link-reports/mark-fixed`(OPERATOR+)
- **완료 기준**: EB "`BrokenLinkReport` 24시간 중복 제한과 처리 상태 전환"
- **주요 파일**: `m/escape-bridge/application/broken-link-report.ts`, `w/http/routes/bridge.ts`, `w/http/routes/admin-reports.ts`

---

## Phase 6: 탈퇴 (P0)

### T24 회원 탈퇴 — `보류(발표 범위 밖, 일반 공개 전 필수)`
- **근거**: §5 회원 탈퇴, §15 D-08·D-14, S45, V-09
- **선행**: T16, T23, T09
- **내용**: Identity `withdraw`가 각 모듈의 `prepareUserDeletion`(TT·EB·Catalog·Identity, P1·P2 모듈은 추가 시 등록)을 하나의 batch로 실행하고 쿠키를 지웁니다. 운영자이면 `CatalogChangeLog`(·`ReportGrant`)도 삭제하고 `app_settings.updated_by`는 `NULL`로 비웁니다. 엔드포인트: `DELETE /api/me`(성공 시 204와 세션 쿠키 제거)
- **완료 기준**:
  - IA "탈퇴 시 식별 정보 삭제·예약 알림 취소·관련 기록 전체 삭제, 삭제 후 배치·알림 예약에 나타나지 않음"
  - V-09(`ReportGrant` 부분은 P2 T50에서 보완)
- **주요 파일**: `m/identity/application/withdraw.ts`, 각 모듈 `index.ts`, `w/http/routes/me.ts`

---

## Phase 7: 프런트엔드 (P0)

공통 완료 기준: 모바일 폭(360px)과 PC에서 레이아웃이 깨지지 않고, 모든 API 호출은 생성된 타입을 씁니다.

### T25 SPA 골격 — `대기`
- **선행**: T04, T05
- **내용**: Vite + React + Router + TanStack Query, PWA manifest·SW, API 클라이언트(401 → `loginUrl` 이동), 공통 레이아웃·오류 표시
- **주요 파일**: `src/web/*`, `vite.config.ts`

### T26 카탈로그 화면 — `대기`
- **근거**: S1·S2·S4·S5·S6·S8·S46, V-08
- **선행**: T25, T10, T13
- **내용**: 분야별 목록·검색, 상세(다크패턴 등급, 가이드, 보존 정책, 백업, EduBenefit, 'YYYY-MM-DD 확인'), 1회 클릭 등록, 시작일 변경, '이미 가입했어요', '게시 중단' 안내와 등록 버튼 숨김

### T27 내 체험 화면 — `대기`
- **근거**: S10·S23·S28~S32·S41·S42, D-09
- **선행**: T25, T19, T16, T22
- **내용**: 탭 대시보드(누적 방어 금액·진행 중 건수), 카드 행동 버튼, 기록 상세·수정, 해지 확정(필요 시 ExitPoll), 결제 확인 정정 화면, 환불 템플릿 복사

### T28 해지 브릿지 화면 — `대기`
- **근거**: S16~S24·S34, V-05
- **선행**: T25, T21, T23
- **내용**:
  - 모드별 화면
  - `SPA_MODAL_GUIDE` 가이드 고정
  - `IMMEDIATE_TERMINATION` 백업 우선 배치
  - 사유 버튼 → 즉시 이동
  - `APP` 딥링크 fallback, `PC_WEB` 모바일 링크 복사
  - 제보 버튼

### T29 설정 화면 — `보류(발표 범위 밖)`
- **근거**: S44·S45, V-07
- **선행**: T25, T07, T24
- **내용**: 알림 수신 토글(끌 때 확인 창, 확인해야만 요청), 탈퇴(확인 후 삭제)
- **완료 기준**: V-07

### T30 관리 콘솔 — `대기 (발표용 간소화: 카탈로그 폼·게시 상태·제보 목록만)`
- **근거**: S38~S40·S47·S48
- **선행**: T25, T09, T11, T12, T23
- **내용**: 카탈로그 목록·등록·수정 폼(원점수 입력, 버퍼 변경 시 '진행 중 기록에도 적용' 선택), 변경 이력·되돌리기, 게시 상태, 제보 처리, 역할·설정(ADMIN)

---

## Phase 8: 연동·검증·배포 준비 (P0)

### T31 알림톡 딜러사 어댑터 — `보류(사업자 미등록, 발표용은 T34로 대체, D-16)`
- **근거**: §17 외부 연동, FN §3·§4
- **선행**: T17
- **내용**: 딜러사 HTTP API 어댑터, 템플릿 코드 매핑, 실제 `RecipientResolver` 구현. `staging`에서는 쓸 수 없게 막습니다.
- **완료 기준**: 딜러사 응답을 모의(mock)한 어댑터 단위 테스트를 통과합니다. 실제 발송 테스트는 만들지 않습니다.

### T32 staging 구성과 Cloudflare Access — `진행 (발표용: Cloudflare production 배포 필수, staging 생략, Access는 가능하면. 1주차 빈 Worker 배포·원격 D1 마이그레이션 0001·production Secrets 4개 등록 완료 2026-10-29)` (실행은 승인 필요)
- **발표용 일정**: 1주차 빈 Worker 첫 배포 → 점검 B 전 시험 배포 → 12/5 최종 배포 (implementation-plan §7.5)
- **근거**: §16 접근 제어, §17 환경
- **선행**: T30, N7
- **내용**: staging D1·R2 생성, 마이그레이션 적용, Secrets 등록, Access 정책(`/admin*`, `/api/admin*`), 배포 절차 문서화
- **승인**: 리소스 생성·마이그레이션 원격 적용·`wrangler deploy`는 각각 사용자 승인 후에 실행합니다.

### T33 시나리오 테스트와 수동 점검 — `대기`
- **근거**: Goals §3 S-01~S-05
- **선행**: T18, T21, T27, T28
- **내용**:
  - `tests/scenarios/S-01…S-05`(FakeClock 진행, Cron 핸들러 직접 호출)
  - 카카오 인앱 브라우저 수동 점검 목록: 로그인 복귀, 딥링크 fallback, PC 안내, PWA 설치
- **완료 기준**: S-01~S-05 통과, 점검 목록 결과 기록 → **M8 (P0 완료)**

### T34 카카오 '나에게 보내기' 어댑터 — `대기` (발표용 신규)
- **근거**: SPEC §17 발표용 알림 채널(D-16), V-10
- **선행**: T17, T05
- **내용**:
  - `kakao-memo` `NotificationSender` 어댑터: `POST /v2/api/talk/memo/default/send`, text 템플릿과 링크 버튼(`/bridge/{id}`, `/trials/{id}`)
  - (kind, variant, retentionPolicy) 키로 문구 선택(architecture §5.5)
  - `RecipientResolver`가 Identity `getKakaoMessageAccessToken`으로 토큰을 얻고, `null`이면 `SKIPPED`
  - `NOTIFICATION_MODE=kakao_memo` 조립. `staging`에서는 막습니다.
- **완료 기준**:
  - V-10(모의 `fetch`: 토큰 갱신과 교체 저장, 동의 없음·만료 시 `SKIPPED`, API 오류 재시도)
  - 배포 환경에서 발표자 계정으로 늦은 등록 알림이 실제로 오는지 수동 확인(점검 B). 실제 발송은 사용자가 직접 실행합니다.
- **주요 파일**: `w/adapters/kakao-memo.ts`, `m/identity/application/kakao-message-token.ts`

### T35 시드·시연 데이터 — `대기` (발표용 신규)
- **근거**: implementation-plan §7.3, N5
- **선행**: T03 (B2B 데이터는 T60 이후 보강)
- **내용**:
  - 로컬·배포 DB용 시드 스크립트(`migrations/`와 분리)
  - `GuardedService` 10개 안팎(직접 확인한 해지 경로만)
  - 가상 파트너 2~3곳과 `SponsoredTrial` 3~4개(실존 회사 사칭 금지, '시연용 데이터' 표시)
  - 리포트용 체험 기록과 `ExitPoll` 응답
- **완료 기준**: 빈 로컬 DB에 시드를 넣으면 S-01~S-05와 B2B 4종 화면을 바로 시연할 수 있습니다. 원격 DB에 넣는 것은 승인 후에 합니다.

---

## 발표용 B2B (D-17, 2026-12-09 발표)

[implementation-plan §7.4](implementation-plan.md#74-발표용-b2b-4종-d-17)의 단순 버전입니다.
- P1·P2 정식 TASK(T41~T52)를 대신하지 않습니다.
- `ReportGrant`, 최소 표본, CSV는 만들지 않습니다.
- 엔드포인트는 착수할 때 `api/openapi.yaml`에 추가합니다(공개 인터페이스 변경이므로 사전 승인).

| TASK | 내용 | 선행 | 완료 기준 | 상태 |
| :--- | :--- | :--- | :--- | :--- |
| T60 | 제휴 체험 라운지(`published_at` 내림차순)와 피처드 슬롯(`featured_order`, 최대 3개). `FeaturedEvent` 노출·클릭 기록(노출 하루 1회 중복 제거) | T10, T35 | V-02 중 정렬·슬롯 순서, BA "`FeaturedEvent` 노출 하루 1회 중복 제거" | `대기` |
| T61 | 파트너 대리 제출·검수 콘솔(T30 폼 재사용, `SUBMITTED → PUBLISHED/REJECTED`, 파트너 최소 등록) | T30 | CM 게시 상태 전이, `SPONSORED_TRIAL`의 `ownerPartnerId`·`signupUrl` 필수 | `대기` |
| T62 | 대안 매칭 배너(트리거·사유 필터·후보 선정·7일 1회, 앱 안 배너만) | T14, T60 | BA "`AlternativeMatch`" 전 항목 | `대기` (지연 시 가장 먼저 축소) |
| T63 | 이탈 분석 리포트 화면(`ExitReason` 분포, 해지 시도율·확정률, 유지·결제 비율, 분야 평균, 노출·클릭 수). TT 공개 집계 조회만 사용 | T14, T60 | `VOIDED` 제외, 응답에 `userId` 등 식별 정보 없음, 새 투표가 다시 조회했을 때 반영 | `대기` |

---

## P1: 양면 시장 (착수 전 D-12와 FN §1 P1 `[제안]` 확정)

| TASK | 내용 | 근거 | 선행 | 완료 기준 |
| :--- | :--- | :--- | :--- | :--- |
| T40 | D-12 데이터 모델(게시 시각, 슬롯 구성, 서비스 내 알림)과 마이그레이션 0002 | §14, §16, §19, D-12 | M8, D-12 | 스키마 적용 |
| T41 | `Partner` 관리, `SponsoredTrial` 대리 제출(`SUBMITTED`)·검수·게시 | §2, §16, S35 | T40 | CM 게시 상태 전이, `ownerPartnerId` 필수 |
| T42 | 전용 라운지(최근 게시 순)와 피처드 슬롯(수동, 기본 3개) | §16, S3 | T41 | V-02 |
| T43 | 경로 B 원클릭 프롬프트(`SPONSORED_OUTBOUND_PROMPT`) | §3, S9 | T42, T13 | V-04 |
| T44 | `FeaturedEvent` 수집(노출 하루 1회 중복 제거) | §12, §11 | T42 | BA "`FeaturedEvent` 노출 하루 1회 중복 제거" |
| T45 | `AlternativeMatch`(트리거, 사유 필터, 후보 선정, 7일 1회 배너) | §11, S33·S36 | T44, T14 | BA "`AlternativeMatch`" 전 항목 |
| T46 | `CatalogRequest`(정규화 중복, 콘솔 집계, ADDED·REJECTED, 서비스 내 알림) | §14, S43·S49 | T40 | CM "`CatalogRequest` 중복 처리와 `ADDED` 시 요청자 알림" |

탈퇴(T24)의 `prepareUserDeletion` 목록에 `FeaturedEvent`·`CatalogRequest` 삭제를 추가합니다.

## P2: B2B 수익화 (착수 전 FN §1 P2 `[제안]` 확정)

| TASK | 내용 | 근거 | 선행 | 완료 기준 |
| :--- | :--- | :--- | :--- | :--- |
| T50 | `ReportGrant` 발급(ADMIN, 소유 항목만)과 마이그레이션 0003 | §12 발급, S50 | M8 | BA "`ReportGrant` 범위 밖 생성 거부", V-09 보완 |
| T51 | `ChurnReport` 집계(코호트·분모, 대리 지표, 분야 평균, 최소 표본, `VOIDED` 제외, PII 없음) | §12, S37 | T50, T44 | BA "`ChurnReport`" 전 항목 |
| T52 | 인쇄용 리포트 화면과 CSV 내보내기 | §12 발급 | T51 | 최소 표본 미달 시 생성 버튼 비활성과 사유 표시 |

---

## 추적표 1: P0 스토리 → TASK

§18 P0 스토리: 1, 2, 4~8, 10~32, 34, 38~42, 44~48

| 스토리 | TASK | 스토리 | TASK |
| :--- | :--- | :--- | :--- |
| 1 | T10, T26 | 24 | T08, T20, T28 |
| 2 | T10, T26 | 25 | T14 |
| 4 | T08, T10, T26 | 26 | T15, T16 |
| 5 | T10, T26 | 27 | T15 |
| 6 | T10, T15, T26 | 28 | T14, T27 |
| 7 | T13 | 29 | T14, T27 |
| 8 | T13, T26 | 30 | T14, T19 |
| 10 | T14, T19, T27 | 31 | T14, T18, T27 |
| 11 | T13 | 32 | T22, T27 |
| 12 | T13 | 34 | T23, T28 |
| 13 | T15, T16, T17 | 38 | T08, T09, T30 |
| 14 | T15 | 39 | T08, T12, T30 |
| 15 | T15, T16 | 40 | T23, T30 |
| 16 | T05, T20, T28 | 41 | T19, T27 |
| 17 | T20, T28 | 42 | T16, T27 |
| 18 | T08, T20, T28 | 44 | T07, T17, T29 |
| 19 | T20, T28 | 45 | T24, T29 |
| 20 | T14, T21, T28 | 46 | T21, T26 |
| 21 | T21, T28 | 47 | T06, T09, T30 |
| 22 | T20, T21 | 48 | T09, T16, T30 |
| 23 | T19, T20, T27 | | |

P1 스토리 3·9·33·35·36·43·49는 T41~T46, P2 스토리 37·50은 T50~T52가 다룹니다.

## 추적표 2: 검증 항목 → TASK

| 검증 항목 | TASK |
| :--- | :--- |
| TT Auto-fill / 날짜 산정 / 입력 검증 | T02, T13 |
| TT 상태 머신 / `ExitPoll` 불변식 / `SavedAmount` | T14 |
| TT 알림 스케줄 / 문구 분기 / 국내 당일 해지 확인 | T15 |
| TT 기록 수정 / 버퍼 변경 적용 | T16 |
| TT 알림 수신 거부 / 발송 멱등성 / 발송 시각 설정 변경(G5) | T17 |
| TT `MISSED_BILLED` 배치 멱등성 / 00~09시 KST '오늘' | T02, T18 |
| TT 내 체험 목록 | T19 |
| EB 진입 범위·안내 모드 / `EscapePattern`별 동작 | T20, T21, T28 |
| EB `RefundTemplate` | T22 |
| EB 공개 응답 직링크 비노출 / '이미 가입했어요' | T10, T21 |
| EB `BrokenLinkReport` | T23 |
| CM 검증 규칙 전반 | T08 |
| CM 게시 상태 전이 / 변경 이력 / 반영 규칙 | T09, T16, T41 |
| CM 기준표 재계산 | T12 |
| CM `CatalogRequest` | T46 |
| IA 역할별 차단 | T06 |
| IA 탈퇴 | T24 |
| IA 알림 링크 로그인 후 복귀 | T05, T33 |
| BA `AlternativeMatch` / `FeaturedEvent` | T44, T45 |
| BA `ChurnReport` / `ReportGrant` | T50, T51 |
| V-01 | T10 |
| V-02 | T42 |
| V-03 | T10 |
| V-04 | T43 |
| V-05 | T20, T28 |
| V-06 | T09 |
| V-07 | T07, T29 |
| V-08 | T10, T13, T21, T26 |
| V-09 | T24, T50 |
| 시나리오 S-01~S-05 | T33 (S-05는 T16에서 먼저 확인) |
