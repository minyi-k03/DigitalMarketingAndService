# 구독컷(SubCut) 아키텍처 설계

> 기준: `SPEC.md` v1.11, `Glossary.md` v1.4. 이 문서는 "어떻게"를 다루며 요구사항을 바꾸지 않습니다. SPEC과 다르면 SPEC이 우선합니다.
> 관련 문서: [ADR-0008](adr/ADR-0008-cloudflare-stack-and-frontend.md), [API 계약](../api/openapi.yaml), [구현 계획](implementation-plan.md), [TASK 목록](tasks.md)
> 표기: `[제안]`은 이 문서에서 정한 구현 방식입니다. 구현 계획 승인(2026-10-23)으로 확정되었으며, 바꾸려면 이 문서를 먼저 고칩니다.

---

## 1. 시스템 구성

```
┌──────────── 카카오톡 인앱 브라우저 / 모바일 웹 / PC ─────────────┐
│  React SPA (PWA)   /catalog  /trials  /bridge/:id  /settings  /admin │
└───────────────┬──────────────────────────────────────────────────┘
                │ HTTPS (세션 쿠키)
┌───────────────▼──────────── Cloudflare Worker (단일) ────────────────┐
│ fetch:  /api/*, /auth/*  → Hono 라우터 → 모듈 application 계층          │
│         그 외 경로        → Workers static assets (SPA fallback)      │
│ scheduled: */10 * * * *  → DispatchDueNotifications                    │
│            10 15 * * *   → RunMissedBilledBatch (= 00:10 KST)           │
└──────┬────────────────┬──────────────────┬───────────────────────────┘
       │                │                  │
   D1 (관계형)       R2 (로고)      NotificationSender 포트
                                     ├─ notification-log (dev·staging)
                                     ├─ kakao-memo (발표용 production, T34, D-16)
                                     └─ alimtalk-dealer (사업자 등록 후, T31)
```

- 근거: SPEC §17. API와 정적 프런트엔드를 Worker 하나에서 함께 제공하고, D1과 R2, Cron Trigger를 씁니다.
- 프런트엔드는 React + Vite SPA입니다(D-07, ADR-0008).
- `/admin*`·`/api/admin*`에는 서버의 역할 검사와 함께 Cloudflare Access를 겁니다(§16).

### 1.1 환경

| 환경 | 실행 | D1 / R2 / Secrets | 알림 어댑터 |
| :--- | :--- | :--- | :--- |
| `dev` | `wrangler dev` (로컬 miniflare) | 로컬 전용 | `notification-log` |
| `staging` | `wrangler.jsonc`의 `env.staging` (발표 전에는 만들지 않음, T32 보류) | staging 전용 | `notification-log` (실제 발송 금지, §17) |
| `production` | `env.production` | production 전용 | 발표용 `kakao-memo`(D-16), 사업자 등록 후 `alimtalk-dealer` |

어댑터는 `NOTIFICATION_MODE` 변수(`log` | `kakao_memo` | `dealer`)로 고릅니다. composition root는 `staging`에서 `log` 말고는 쓸 수 없게 막습니다.

---

## 2. 디렉터리 구조 `[제안]`

```
Dev/
  package.json  tsconfig.json  tsconfig.worker.json  tsconfig.web.json
  wrangler.jsonc  vite.config.ts  vitest.config.ts  eslint.config.js
  migrations/                 # D1 스키마는 이 파일들로만 변경 (§17)
    0001_p0_init.sql
  api/openapi.yaml            # HTTP 계약 (D-06). 타입은 openapi-typescript로 생성
  src/
    shared/                   # 프런트·워커 공용: §19 도메인 타입, KstDate 유틸, 생성된 API 타입
    worker/
      index.ts                # fetch·scheduled 진입점, 의존성 조립(composition root)
      http/                   # Hono 앱, 라우트, 인증·역할 미들웨어, problem+json 변환, zod 요청 검증
      platform/               # Clock, DomainError, id 생성, D1 헬퍼, 암호화
      ports/                  # NotificationSender, RecipientResolver, BlobStore, KakaoOAuthClient
      adapters/               # notification-log, kakao-memo, alimtalk-dealer, r2-blob-store, kakao-oauth
      modules/
        catalog/
        trial-tracking/
        escape-bridge/
        identity/
        analytics/            # P1·P2
          domain/             #   순수 규칙 (I/O 없음)
          application/        #   명령·조회 핸들러 = 테스트 seam
          infra/              #   D1 저장소. 이 모듈의 테이블만 다룸
          index.ts            #   공개 명령·조회 인터페이스 (다른 모듈은 이것만 import)
    web/                      # React SPA
  tests/
    support/                  # FakeClock, FakeNotificationSender, FakeRecipientResolver, FakeKakaoOAuthClient, 픽스처 빌더
    catalog/ trial-tracking/ escape-bridge/ identity/ analytics/
    http/                     # 소수의 HTTP 계약 테스트
    scenarios/                # S-01 ~ S-05
```

**모듈 경계 강제**: ESLint `no-restricted-imports`로 `modules/<a>/**`에서 `modules/<b>/{domain,application,infra}/**`를 import하지 못하게 합니다. 다른 모듈은 `modules/<b>/index.ts`를 통해서만 씁니다(AGENTS §4).

---

## 3. 모듈과 공개 인터페이스

각 모듈은 자기 테이블만 읽고 씁니다. 아래 "공개"는 `index.ts`에서 export하는 함수이고, 그 밖의 함수는 모듈 밖에서 쓸 수 없습니다.

### 3.1 테이블 소유

| 모듈 | 소유 테이블 |
| :--- | :--- |
| Catalog & Marketplace | `catalog_items`, `partners`, `catalog_change_logs`, `app_settings`(`catalog.*` 키), P1: `catalog_requests`, D-12 테이블 |
| Trial Tracking & Schedule | `trial_records`, `exit_poll_responses`, `notification_schedules`, `app_settings`(`notification.*` 키) |
| EscapeBridge & Recovery | `broken_link_reports` |
| B2B Analytics & Matching | `featured_events`(발표용으로 0001에 포함, D-17), P2: `report_grants` |
| Identity & Account | `users`, `sessions`, `kakao_message_tokens`(D-16) |

`app_settings`는 키 접두사(`catalog.*`, `notification.*`)로 소유 모듈을 나눕니다. 다른 모듈의 키는 그 모듈의 조회 함수로만 읽습니다.

### 3.2 공개 명령·조회

**Catalog & Marketplace**

| 구분 | 이름 | 호출자 | 근거 |
| :--- | :--- | :--- | :--- |
| 조회 | `listCatalog({ category?, q? })` → `CatalogItemPublicView[]` | HTTP(사용자) | §2 D-11, §7, V-01 |
| 조회 | `getCatalogItem(id)` → `CatalogItemPublicView` | HTTP(사용자) | §7, V-03, V-08 |
| 조회 | `getTrackingTerms(id)` → `{ publicationStatus, defaultTrialDays, isGlobalTimeZoneBufferRequired, monthlyPrice, serviceCategory, accessRetentionPolicy, name }` | Trial Tracking | §3, §4, §8 |
| 조회 | `getEscapeContent(id)` → `{ name, escapePattern, forcedChannel?, escapeGuideSteps, escapeLink, escapeLinkFallbackUrl?, accessRetentionPolicy, backupChecklist?, supportContact, lastVerifiedAt }` | EscapeBridge, Trial Tracking | §7, §9 |
| 명령 | `createCatalogItem(actor, input)` | HTTP(OPERATOR+) | §2, §16 |
| 명령 | `updateCatalogItem(actor, id, patch, { applyBufferToActiveRecords })` | HTTP(OPERATOR+) | §2 반영 규칙, 스토리 48 |
| 명령 | `changePublicationStatus(actor, id, to)` | HTTP(OPERATOR+) | §2 게시 상태 |
| 명령 | `revertCatalogChange(actor, changeLogId)` | HTTP(OPERATOR+) | §16, V-06 |
| 명령 | `uploadLogo(actor, id, file)` | HTTP(OPERATOR+) | §2 표시 필드 |
| 명령 | `updateDarkPatternRubric(actor, thresholds)` (전체 등급 재계산) | HTTP(ADMIN) | §2 기준표, 스토리 39 |
| 조회/명령 | `getCatalogSettings()` / `updateCatalogSettings(actor, patch)` (`allowedDeepLinkSchemes`) | HTTP(ADMIN) | §2 G4 |
| 조회 | `listChangeLogs(id)` | HTTP(OPERATOR+) | §16 |
| 명령 | `markVerified(actor, id)` | EscapeBridge(제보 처리) | §16 최종 검증일 |
| 명령 | `prepareUserDeletion(userId, { isOperator })` → `D1PreparedStatement[]` | Identity | §15 D-14 |

**Trial Tracking & Schedule**

| 구분 | 이름 | 근거 |
| :--- | :--- | :--- |
| 명령 | `createTrialRecord(cmd: CreateTrialRecordCommand)` | §3, §4, §6 |
| 명령 | `updateTrialRecord(cmd: UpdateTrialRecordCommand)` | §5 수정 범위, §6 재예약 |
| 명령 | `startCancelAttempt(cmd: StartCancelAttemptCommand)` → `StartCancelAttemptResult` | §5, §7 |
| 명령 | `confirmCancel(cmd: ConfirmCancelCommand)` | §5, §8 |
| 명령 | `decideKeep({ userId, trialRecordId })` | §5 |
| 명령 | `voidTrialRecord({ userId, trialRecordId })` | §3, §5 |
| 명령 | `resolveMissedBilling(cmd: ResolveMissedBillingCommand)` | §5 |
| 명령 | `prepareBufferChange(catalogItemId, newBuffer)` → `D1PreparedStatement[]` (= `ApplyBufferChangeToActiveRecords`) | §1, §2, §5 |
| 명령 | `runMissedBilledBatch()` | §17 |
| 명령 | `dispatchDueNotifications()` | §17 |
| 조회/명령 | `getNotificationSettings()` / `updateNotificationSettings(actor, patch)` (`sendTime`, `templates`) | §6 G5, §17 |
| 명령 | `prepareUserDeletion(userId)` → `D1PreparedStatement[]` | §15 D-08 |
| 조회 | `listMyTrials({ userId, tab })` → `{ items, savedAmountTotal, activeCount }` | §13 |
| 조회 | `getTrialRecord({ userId, trialRecordId })` | §13 |
| 조회 | `getBridgeState({ userId, trialRecordId })` → `{ status, hasExitPoll, catalogItemId, startDate, billingDate, bufferApplied }` | §7, §9 |
| 조회 | `exportExitPollResponses(filter)` (P2) | §12 |

**EscapeBridge & Recovery**

| 구분 | 이름 | 근거 |
| :--- | :--- | :--- |
| 조회 | `getBridgeView({ userId, trialRecordId })` → 모드 `POLL` / `REENTRY` / `GUIDE_ONLY`, 진입할 수 없으면 오류 | §7, D-09 |
| 명령 | `selectExitReason({ userId, trialRecordId, exitReason })` → TT `startCancelAttempt` 위임 | §7 단일 명령 |
| 조회 | `getRefundTemplate({ userId, trialRecordId })` → 국·영문 텍스트 | §9 |
| 명령 | `submitBrokenLinkReport({ userId, trialRecordId, target })` | §10 |
| 명령 | `resolveBrokenLinkReport(actor, id, status)` / `markOpenReportsFixed(actor, catalogItemId)` | §10, §16 |
| 조회 | `listBrokenLinkReports(filter)` | §10 |
| 명령 | `prepareUserDeletion(userId)` | §15 |

**Identity & Account**

| 구분 | 이름 | 근거 |
| :--- | :--- | :--- |
| 명령 | `startKakaoLogin(returnTo?)` → 인가 URL과 `nonce`(HTTP 계층이 쿠키에 심음) | §15 |
| 명령 | `loginWithKakao(code, state, nonce)` → 세션 발급, `returnTo` | §15 |
| 명령 | `logout(sessionToken)` | §15 |
| 명령 | `setNotificationEnabled(userId, enabled)` | §15, V-07 |
| 명령 | `withdraw(userId)` | §15 D-08·D-14 |
| 명령 | `assignRole(actor, userId, role)` (ADMIN) | §16 |
| 조회 | `getMe(userId)` | §15 |
| 조회 | `getNotificationRecipient(userId)` → `{ enabled, recipient? }` (`RecipientResolver` 포트 사용) | §6, FN §4 |
| 명령 | `getKakaoMessageAccessToken(userId)` → `accessToken \| null`. 저장된 refresh token으로 access token을 갱신하고, 새 refresh token을 받으면 교체 저장합니다. 동의가 없거나 만료되었으면 `null`을 돌려줍니다 | §17 D-16, V-10 |
| 미들웨어 | `requireSession`, `requireRole('OPERATOR' \| 'ADMIN')` | §16 |

**B2B Analytics & Matching** (P1·P2): `recordFeaturedEvent`, `pickAlternativeMatch`, `issueReportGrant`, `generateChurnReport`, `exportChurnReportCsv`. 세부는 P1·P2 착수 전 D-12와 `[제안]` 확정 후 정합니다.

**발표용 B2B 단순 버전** (D-17, T60~T63):
- 공개 함수는 `recordFeaturedEvent`, `pickAlternativeMatch`, `getChurnSummary(catalogItemId, month)`만 둡니다.
- `getChurnSummary`는 TT의 공개 조회 `aggregateTrialOutcomes(filter)`가 돌려준 집계값만 씁니다. 이 조회는 기록 상태별 건수와 `ExitReason` 분포를 `GROUP BY`로 만들며, 개인 식별 정보를 포함하지 않습니다.
- `ReportGrant`, 최소 표본, CSV 내보내기는 만들지 않습니다.

### 3.3 모듈 간 원자성: statement 조립 방식 `[제안]`

SPEC은 트랜잭션이 필요한 처리를 D1 batch로 구현하라고 합니다(§17). 여러 모듈의 테이블을 함께 바꿔야 하는 경우가 두 군데 있습니다.

1. **버퍼 변경 적용**(스토리 48): Catalog의 `catalog_items` 수정과 `catalog_change_logs` 기록, TT의 `trial_records`·`notification_schedules` 재계산
2. **회원 탈퇴**(스토리 45): 5개 모듈의 사용자 데이터 삭제

이때 각 모듈은 SQL을 직접 실행하지 않고, 자기 테이블만 다루는 `D1PreparedStatement[]`를 만들어 돌려주는 `prepare*` 공개 함수를 둡니다. 오케스트레이터(Catalog의 `updateCatalogItem`, Identity의 `withdraw`)가 이 목록을 합쳐 `db.batch()` 한 번으로 실행합니다. 모듈은 다른 모듈의 테이블을 직접 쓰지 않고, 원자성은 batch가 보장합니다.

`prepareBufferChange`는 batch 실행 전에 대상 기록을 읽어 새 `safeEndDate`와 알림 슬롯을 미리 계산합니다. 읽은 뒤 쓰기 전 사이에 상태가 바뀌는 경우를 막기 위해, 각 UPDATE에 `WHERE status = :expectedStatus AND safe_end_date = :expectedSafeEndDate` 조건을 겁니다. 조건이 맞지 않아 0행이 바뀐 기록은 batch가 끝난 뒤 다시 계산합니다.

---

## 4. 시간 모델 (§4, §17)

| 개념 | 타입 | 규칙 |
| :--- | :--- | :--- |
| 현재 시각 | `Clock.now(): Date` | 도메인·application 코드는 `new Date()`·`Date.now()`를 쓰지 않습니다(ESLint `no-restricted-syntax`로 막음) |
| 오늘(KST) | `todayKst(clock): KstDate` | `now + 9h`의 UTC 날짜 부분 |
| 날짜 | `KstDate` (branded `YYYY-MM-DD`) | `addDays(d, n)`는 `Date.UTC(y, m-1, d + n)`로 계산합니다. 라이브러리 없이 월말·연말·윤년을 처리합니다 |
| 시각 | `UtcInstant` (ISO 8601 문자열) | 저장·비교는 모두 UTC |
| KST 시각 → UTC | `kstAt(date: KstDate, hhmm: string): UtcInstant` | `Date.UTC(y, m-1, d, hh - 9, mm)` |
| 시각의 KST 날짜 | `kstDateOf(instant): KstDate` | 당일 해지 확인 알림에서 '전날 시도 / 당일 시도'를 판단할 때 사용 |

`SavedAmount` 기준 시각인 `SafeEndDate` 당일 23:59:59 KST는 `kstDateOf(confirmedAt) <= safeEndDate`로 비교합니다(§8).

---

## 5. Trial Tracking 핵심 설계

### 5.1 날짜 산정 (§4)

```
billingDate = addDays(startDate, trialDays)
safeEndDate = bufferApplied ? addDays(billingDate, -1) : billingDate
```

**입력 검증 (§3)**
- `startDate <= todayKst`
- `1 <= trialDays <= 365`이고 정수
- `billingDate >= todayKst`
- 항목의 `publicationStatus = PUBLISHED`
- 진행 중 중복 기록이 없을 것

### 5.2 상태 머신 (§5)

`domain/transitions.ts`에 전이표를 **데이터**로 둡니다.

```ts
type TrialEvent =
  | 'UPDATE_DATES' | 'APPLY_BUFFER_CHANGE'
  | 'START_CANCEL_ATTEMPT' | 'REENTER_BRIDGE'
  | 'CONFIRM_CANCEL' | 'DECIDE_KEEP' | 'VOID'
  | 'BILLING_DATE_PASSED'
  | 'RESOLVE_BILLED' | 'RESOLVE_CANCELED_BEFORE_BILLING' | 'RESOLVE_KEEP_USING';

const TRANSITIONS: Record<TrialEvent, Partial<Record<TrialStatus, TrialStatus>>> = { … }; // §5 표 그대로
```

- `applyTransition(record, event, now)`만 상태를 바꿉니다. 표에 없으면 `DomainError('INVALID_TRANSITION')`입니다. 상태가 바뀌면 `statusChangedAt = now`로 둡니다.
- 저장할 때는 조건부 UPDATE(`WHERE id = ? AND status = :from`)로 동시 요청을 막습니다. 0행이 바뀌면 `CONFLICT`로 응답합니다.

### 5.3 `ExitPoll` 불변식과 원자성 (§5, §7)

DB와 애플리케이션 두 겹으로 지킵니다.

1. **DB 제약**
   - `exit_poll_responses.trial_record_id`를 PRIMARY KEY로 두어 기록당 1건만 허용
   - `trial_records`에 CHECK 제약:
     - `status = 'TRACKING'`이면 `exit_reason IS NULL`
     - `status IN ('CANCEL_ATTEMPTED','CANCELED_CONFIRMED')`이면 `exit_reason IS NOT NULL`
2. **batch 하나로 처리**
   - 응답 INSERT
   - `trial_records` 조건부 UPDATE(상태와 `exit_reason` 사본, `cancel_attempted_at`·`confirmed_at`)
   - 알림 취소·교체 INSERT/UPDATE
   - 하나라도 실패하면 모두 롤백합니다. 테스트에서는 PK 충돌을 일부러 일으켜 롤백을 확인합니다.

응답 없이 확정·정정하는 요청(`TRACKING → CANCELED_CONFIRMED`, 응답이 없는 `MISSED_BILLED → CANCELED_CONFIRMED`에 `exitReason` 누락)은 애플리케이션 계층에서 `EXIT_POLL_REQUIRED`로 거부합니다.

### 5.4 알림 계획기 (§6) — 순수 함수

```ts
planInitialSlots(record, terms, now, settings): PlannedSlot[]        // TRACKING 생성·재예약 (D3·D1·LATE_REGISTRATION)
planCancelConfirmSlots(record, now, settings): PlannedSlot[]         // CANCEL_ATTEMPTED 확인 알림 (D1_CONFIRM·SAME_DAY_CONFIRM)
                                                                     //  - 사유 선택(TRACKING → CANCEL_ATTEMPTED) 시: 기존 D3·D1 취소 후 호출
                                                                     //  - CANCEL_ATTEMPTED 재예약(기록 수정·버퍼 변경, G3) 시: PENDING 전부 취소 후 호출
```

`settings.sendTime`의 기본값은 `10:00`입니다. 발송 시각 설정을 바꾸면 변경 이후 새로 만들어지거나 재예약되는 슬롯부터 적용하고 기존 `PENDING` 행의 `sendAt`은 유지합니다(G5 확정). 아래 `T(date)`는 `kstAt(date, sendTime)`을 뜻합니다.

| 상황 | 슬롯 | 종류 | 발송 시각 |
| :--- | :--- | :--- | :--- |
| 생성·재예약(`TRACKING`), `T(safeEnd-3) > now` | `D3` | `ESCAPE_ALERT` | `T(safeEnd-3)` |
| 생성·재예약(`TRACKING`), `T(safeEnd-1) > now` | `D1` | `ESCAPE_ALERT` | `T(safeEnd-1)` |
| 생성·재예약(`TRACKING`), D3·D1 모두 지났고 `today <= billingDate` | `LATE_REGISTRATION` | `ESCAPE_ALERT` | `now` (즉시) |
| 사유 선택 또는 `CANCEL_ATTEMPTED` 재예약, `T(safeEnd-1) > now` | D3 취소, `D1` 취소 → `D1_CONFIRM` 추가 | `CANCEL_CONFIRM_CHECK` | `T(safeEnd-1)` |
| 사유 선택 또는 `CANCEL_ATTEMPTED` 재예약, D1 시각 경과, 글로벌, `now < kstAt(safeEnd, 20:00)` | `SAME_DAY_CONFIRM` | `CANCEL_CONFIRM_CHECK` | `kstAt(safeEnd, 20:00)` |
| 사유 선택 또는 `CANCEL_ATTEMPTED` 재예약, D1 시각 경과, 국내, 시도/변경일 = `safeEnd-1` | `SAME_DAY_CONFIRM` | `CANCEL_CONFIRM_CHECK` | `T(safeEnd)` |
| 사유 선택 또는 `CANCEL_ATTEMPTED` 재예약, D1 시각 경과, 국내, 시도/변경일 = `safeEnd`, `now < kstAt(safeEnd, 21:00)` | `SAME_DAY_CONFIRM` | `CANCEL_CONFIRM_CHECK` | `now + 1h` |
| 그 밖의 사유 선택 또는 `CANCEL_ATTEMPTED` 재예약 | 없음 (결제 확인 흐름) | — | — |
| `MISSED_BILLED` 전이 | `BILLING_CHECK` | `BILLING_CHECK` | `T(billingDate + 1)` |

- **늦은 등록 문구 변형**은 위에서부터 먼저 해당하는 것을 씁니다: `today = billingDate` → `BILLING_DAY`, `today = safeEndDate` → `SAFE_END_DAY`, 그 밖 → `GENERAL`.
- **재예약**(§6, G3 확정): `PENDING` 슬롯을 모두 `CANCELED`로 바꾼 뒤 새 `safeEndDate`로 다시 계산합니다. 유일 키에 `safeEndDate`가 들어가므로 같은 슬롯이라도 새로 넣을 수 있습니다. 새 날짜 기준으로 정규 슬롯이 모두 지났고 `today <= billingDate`이면 `TRACKING`은 `LATE_REGISTRATION`을 즉시 1회 보내고, `CANCEL_ATTEMPTED`는 위 표의 `SAME_DAY_CONFIRM` 규칙을 따릅니다(마감 시각 이전이면 `SAME_DAY_CONFIRM` 1회 예약·발송, 마감 시각 이후이면 추가 발송 없음).

### 5.5 알림 문구와 템플릿 코드 (§6, FN §3)

템플릿 코드는 `app_settings`의 `notification.templates`(JSON)에 **(kind, variant, retentionPolicy)** 조합별로 둡니다. 알림톡 사전 심사 단위와 1:1로 맞춥니다.

| kind | variant | `RETAIN_UNTIL_END` | `IMMEDIATE_TERMINATION` |
| :--- | :--- | :--- | :--- |
| `ESCAPE_ALERT` | `REGULAR` (D3·D1·늦은 등록 GENERAL) | 조기 해지 권장 | 백업 후 D-1 해지 권장 |
| `ESCAPE_ALERT` | `LATE_BILLING_DAY` | 오늘 결제 경고 | 오늘 결제 경고 + 백업 후 바로 해지 |
| `ESCAPE_ALERT` | `LATE_SAFE_END_DAY` | 마지막 날 안내 | 마지막 날 + 백업 후 바로 해지 |
| `CANCEL_CONFIRM_CHECK` | `REGULAR` | "해지를 마치셨나요?" | (같음) |
| `CANCEL_CONFIRM_CHECK` | `SAME_DAY_DOMESTIC` | + "오늘이 결제 예정일이라 이미 결제됐을 수 있어요" | (같음) |
| `BILLING_CHECK` | `REGULAR` | 세 가지 정정 선택지 안내 | (같음) |

- `kakao-memo` 어댑터(D-16)는 템플릿 코드 대신 같은 (kind, variant, retentionPolicy) 키로 코드 안의 문구를 골라 '나에게 보내기' 기본 템플릿(text + 링크 버튼)을 만듭니다. 링크 도메인은 카카오 앱의 Web 플랫폼 도메인으로 등록해야 합니다.
- 알림 링크는 기록 ID만 담은 내부 경로입니다(`/bridge/{id}`, `/trials/{id}`). 로그인 토큰은 넣지 않습니다(§15, ADR-0001).
- 알림톡에는 정보성 내용만 넣고 `AlternativeMatch`는 넣지 않습니다(FN §3).

### 5.6 발송 디스패처 (§17) — Cron 10분

```
1. reclaim : UPDATE … SET status='PENDING' WHERE status='SENDING' AND last_attempt_at < now-15m
2. expire  : 의미를 잃은 PENDING을 닫는다
             - ESCAPE_ALERT인데 billingDate < today 또는 기록이 TRACKING이 아님 → EXPIRED
             - CANCEL_CONFIRM_CHECK인데 기록이 CANCEL_ATTEMPTED가 아님        → EXPIRED
3. claim   : SELECT id FROM … WHERE status='PENDING' AND send_at <= now LIMIT N
             각 행에 대해 UPDATE … SET status='SENDING', last_attempt_at=now
                          WHERE id=? AND status='PENDING'   (changes = 1인 행만 진행)
4. send    : 기록 상태를 다시 확인 → recipient = Identity.getNotificationRecipient(userId)
             - enabled = false 또는 recipient 없음 → SKIPPED
             - NotificationSender.send(...) 성공 → SENT
             - 실패 → attempts+1, 3회 미만이면 PENDING, 3회째면 FAILED
```

- 늦은 등록처럼 즉시 보내야 하는 슬롯은 행을 넣은 뒤 `ctx.waitUntil(dispatchOne(id))`로 같은 3~4단계를 바로 실행합니다. 실패해도 다음 Cron이 다시 집어 갑니다.
- 상태 전이로 종료 상태가 되면 그 기록의 `PENDING` 슬롯을 모두 `CANCELED`로 바꿉니다(§6 알림 취소).

### 5.7 `MISSED_BILLED` 배치 (§17) — 매일 15:10 UTC

```sql
UPDATE trial_records
   SET status='MISSED_BILLED', status_changed_at=:now
 WHERE status IN ('TRACKING','CANCEL_ATTEMPTED') AND billing_date < :todayKst
RETURNING id, safe_end_date, billing_date;
```

- 이어서 반환된 기록의 `PENDING` 슬롯을 `CANCELED`로 바꾸고, `INSERT OR IGNORE`로 `BILLING_CHECK`(`T(today)`)를 넣습니다.
- 두 번 실행돼도 두 번째 UPDATE는 0행이고, INSERT는 유일 제약으로 무시되므로 결과가 같습니다.
- 첫 단계와 두 번째 단계 사이에 실패하면 다음 실행에서 `BILLING_CHECK`가 빠진 `MISSED_BILLED` 기록을 찾아 보충합니다.

### 5.8 `SavedAmount` (§8)

`CANCELED_CONFIRMED` 전이가 `TRACKING`·`CANCEL_ATTEMPTED`에서 일어났고 `kstDateOf(now) <= safeEndDate`이면, `savedAmount = terms.monthlyPrice`를 같은 batch에서 저장합니다. 그 밖에는 `null`입니다.

### 5.9 내 체험 목록 (§13, D-09)

| 상태 | 버튼 (`actions`) |
| :--- | :--- |
| `TRACKING` | `GO_TO_BRIDGE`, `KEEP`, `VOID` |
| `CANCEL_ATTEMPTED` | `CONFIRM_CANCEL`, `GO_TO_BRIDGE`, `KEEP` |
| `MISSED_BILLED` | `RESOLVE_BILLED`, `RESOLVE_CANCELED_BEFORE_BILLING`, `RESOLVE_KEEP_USING`, `GO_TO_BRIDGE_GUIDE` (D-09) |
| `BILLED_CONFIRMED` | `GO_TO_BRIDGE_GUIDE`, `VIEW_REFUND_TEMPLATE` |
| 그 밖의 종료 상태 | 없음 |

- **정렬**: '진행 중' 탭은 `MISSED_BILLED`를 먼저 두고, 나머지는 `safeEndDate` 오름차순입니다. '지난 체험' 탭은 `statusChangedAt` 내림차순입니다.
- **D-Day 표기**(`dDayLabel`)는 서버가 계산해 내려 줍니다. 클라이언트 시계 차이가 생기지 않게 하기 위해서입니다.

---

## 6. EscapeBridge 설계 (§7)

| 기록 상태 | 모드 | 화면 구성 |
| :--- | :--- | :--- |
| `TRACKING` | `POLL` | 사유 버튼 5개(직링크 버튼 없음), 가이드, 백업, 제보 |
| `CANCEL_ATTEMPTED` | `REENTRY` | 직링크 버튼(투표 없음), 가이드, 백업, 제보 |
| `MISSED_BILLED`, `BILLED_CONFIRMED` | `GUIDE_ONLY` | 가이드, 직링크, 제보. 투표와 상태 변화 없음 (D-09) |
| 그 밖 | 진입 불가 | `BRIDGE_NOT_AVAILABLE` 오류 |

- `REENTRY`·`GUIDE_ONLY` 응답에만 `escapeLink`가 들어갑니다. `POLL`에서는 `selectExitReason`의 결과로만 받습니다(§7 비노출).
- `backupFirst = accessRetentionPolicy === 'IMMEDIATE_TERMINATION' && backupChecklist?.length > 0`이면 화면은 백업 체크리스트를 투표 위에 둡니다(V-05).
- `escapePattern = SPA_MODAL_GUIDE`이면 가이드를 펼친 상태로 고정합니다.
- **`forcedChannel`별 클라이언트 동작**
  - `APP`: 딥링크로 이동을 시도하고 약 1.5초 안에 `document.visibilityState`가 `visible`로 남아 있으면 `escapeLinkFallbackUrl`로 이동합니다. 카카오 인앱 브라우저에서는 수동 점검이 필요합니다(T33).
  - `PC_WEB`: 모바일(UA와 `(pointer: coarse)`)이면 이동하지 않고 'PC에서 열어 주세요'와 링크 복사 버튼을 보여 줍니다. `selectExitReason`은 똑같이 호출합니다.
  - 이 판단을 위해 `StartCancelAttemptResult`에 `forcedChannel`을 포함합니다(SPEC §19, G2 확정).
- **'이미 가입했어요'**: 카탈로그 상세 → 시작일 확인 화면 → `POST /api/trials` → 응답의 `id`로 `/bridge/{id}` 이동. 중복 진행 기록이면 409 응답의 `existingTrialRecordId`로 이동합니다.
- **`RefundTemplate`**(§9): 국문과 영문 텍스트 2종을 만듭니다. 서비스명·시작일·고객센터를 채우고 실제 결제일·결제 금액·이름은 `[ ]` 빈칸으로 둡니다. `referenceBillingDate`(공식 결제 예정일)는 참고 정보로 따로 내려 줍니다.
- **`BrokenLinkReport`**(§10): 같은 사용자·항목·대상의 최근 24시간 제보가 있으면 새로 만들지 않고 기존 제보를 돌려줍니다(`200`, `duplicate: true`). 운영자가 처리하면서 카탈로그를 수정하면 Catalog `markVerified`로 `lastVerifiedAt`을 갱신합니다.

---

## 7. 데이터 모델 (D1, `migrations/0001_p0_init.sql`)

컬럼 이름은 SPEC §19 필드를 snake_case로 옮깁니다. 날짜는 `TEXT`(`YYYY-MM-DD`), 시각은 `TEXT`(UTC ISO 8601), 불리언은 `INTEGER` 0/1, 배열·객체 필드는 `TEXT`(JSON)입니다.

| 테이블 | 주요 컬럼 / 제약 |
| :--- | :--- |
| `users` | `id` PK, `kakao_id` UNIQUE, `nickname`(선택, G6 확정), `phone_number_encrypted`, `notification_enabled`, `notification_consent_at`, `role` CHECK, `created_at` |
| `sessions` | `token_hash` PK, `user_id` FK→users ON DELETE CASCADE, `expires_at`, `created_at` |
| `partners` | `id`, `company_name`, `contact_email`, `created_at` |
| `catalog_items` | §19 `CatalogItem` 전체. `kind`·`publication_status`·`service_category`·`escape_pattern`·`forced_channel`·`access_retention_policy`·`dark_pattern_level` CHECK, `owner_partner_id` FK→partners, `escape_guide_steps` JSON(1~3개는 앱에서 검증), `created_at`, `updated_at` |
| `catalog_change_logs` | `id`, `catalog_item_id`, `changed_by`, `changed_at`, `changes` JSON, `applied_to_active_records` |
| `app_settings` | `key` PK, `value` JSON, `updated_by` (nullable, 운영자 탈퇴 시 `NULL`로 갱신), `updated_at` |
| `trial_records` | §19 `TrialRecord` 전체 + `created_at`. CHECK(`exit_reason` 불변식), 부분 UNIQUE INDEX `(user_id, catalog_item_id) WHERE status IN ('TRACKING','CANCEL_ATTEMPTED')`, INDEX `(status, billing_date)`, `(user_id, status)` |
| `exit_poll_responses` | `trial_record_id` PK FK→trial_records ON DELETE CASCADE, `catalog_item_id`, `service_category`, `reason`, `responded_at` |
| `notification_schedules` | §19 `NotificationSchedule` 전체 + `variant`. UNIQUE `(trial_record_id, slot, safe_end_date)`, INDEX `(status, send_at)` |
| `broken_link_reports` | §19 `BrokenLinkReport` 전체. INDEX `(user_id, catalog_item_id, target, created_at)`, `(status)` |
| `kakao_message_tokens` (D-16) | `user_id` PK FK→users ON DELETE CASCADE, `refresh_token_encrypted`, `refresh_token_expires_at`, `scopes` JSON, `updated_at`. access token은 저장하지 않고 발송할 때마다 갱신합니다 |
| `featured_events` (D-17) | §19 `FeaturedEvent` 전체 + `id`. INDEX `(catalog_item_id, placement, type, occurred_at)`, `(user_id, placement, occurred_at)` |

**발표용 B2B 컬럼** (D-17, D-12 일부 확정 2026-10-27)
- `catalog_items.published_at`: `PUBLISHED`로 바뀐 시각. 라운지의 '최근 게시 순' 정렬에 씁니다.
- `catalog_items.featured_order`: 피처드 슬롯 순서. `NULL`이면 슬롯에 넣지 않습니다. UNIQUE이며 값은 1~슬롯 수입니다.

**P1·P2 마이그레이션**
- `0002_p1_*.sql`: `catalog_requests`(UNIQUE `(user_id, normalized_name)`), 남은 D-12 결정 테이블(서비스 내 알림)
- `0003_p2_*.sql`: `report_grants`

`ownerPartnerId`, `kind`, `publicationStatus`는 P0부터 넣어(§18) 이후 핵심 테이블을 바꾸지 않게 합니다.

**외래 키와 삭제**
- 탈퇴는 §3.3의 statement 조립 방식으로 모듈별로 명시적으로 삭제합니다. 다른 모듈의 테이블은 `ON DELETE CASCADE`에 기대지 않습니다.
- 같은 모듈 안(`trial_records` → `exit_poll_responses`, `notification_schedules`)에서만 CASCADE를 씁니다.

---

## 8. HTTP 계층 (D-06)

- 계약의 원본은 [`api/openapi.yaml`](../api/openapi.yaml)입니다. `openapi-typescript`로 `src/shared/api-types.ts`를 생성해 서버 라우트와 SPA가 함께 씁니다.
  - 예외: `GET /api/health`(`{"status":"ok"}`)는 배포 후 생존 확인용 내부 경로라 계약에 넣지 않습니다(2026-10-28 결정). SPA는 이 경로를 쓰지 않습니다.
- 요청 본문은 서버에서 zod로 검증합니다. 생성된 타입과 zod 스키마가 어긋나지 않는지는 HTTP 계약 테스트에서 확인합니다.
- **오류 응답**: RFC 9457 `application/problem+json`에 `code`를 더합니다.

| HTTP | `code` | 상황 |
| :--- | :--- | :--- |
| 400 | `VALIDATION_FAILED` | 입력 검증 실패. 필드별 `errors[]` 포함 |
| 401 | `UNAUTHENTICATED` | 세션 없음. `loginUrl`(returnTo 포함) 제공 |
| 403 | `FORBIDDEN` | 역할 부족 |
| 404 | `NOT_FOUND` | 없거나 **본인 소유가 아닌** 기록 (존재 여부를 숨김) |
| 409 | `INVALID_TRANSITION` | 전이표에 없는 전이 |
| 409 | `DUPLICATE_ACTIVE_RECORD` | 진행 중 중복 기록. `existingTrialRecordId` 포함 |
| 409 | `CONFLICT` | 동시 변경으로 조건부 UPDATE 실패 |
| 422 | `EXIT_POLL_REQUIRED` | 응답 없는 확정·정정 |
| 422 | `CATALOG_ITEM_NOT_PUBLISHED` | `UNPUBLISHED` 등 항목에 새 기록 생성 |
| 422 | `TRIAL_ALREADY_ENDED` | 계산된 `BillingDate`가 오늘 이전 |
| 422 | `BRIDGE_NOT_AVAILABLE` | 브릿지 진입이 허용되지 않는 상태 |
| 500 | `INTERNAL_ERROR` | 예상하지 못한 서버 오류. 내부 정보 없이 응답하고 오류 종류(`name`)만 로그에 남김 |

---

## 9. 보안·개인정보 (AGENTS §6, SPEC §15~§17)

- **세션**
  - 로그인하면 32바이트 무작위 토큰을 쿠키(`sc_session`, HttpOnly·Secure·SameSite=Lax·Max-Age 30일)에 넣습니다. D1에는 SHA-256 해시만 저장합니다.
  - 로그아웃·탈퇴 시 행을 삭제합니다.
  - 상태를 바꾸는 요청은 SameSite=Lax에 더해 `Origin` 헤더가 자기 도메인인지 확인해 CSRF를 막습니다.
- **카카오 OAuth**
  - `state`는 `{ nonce, returnTo }`를 세션 서명 키(HMAC)로 서명한 값입니다.
  - 로그인 CSRF를 막기 위해 같은 `nonce`를 로그인 시작 응답의 쿠키(`sc_login_nonce`, HttpOnly·Secure·SameSite=Lax·Path=`/auth/kakao`·Max-Age 10분)에 심고, 콜백에서 쿠키와 `state` 안의 `nonce`가 같을 때만 로그인을 완료합니다.
  - 사용자가 동의 화면에서 취소해 `error` 쿼리로 돌아오면 `/?loginError=access_denied`(그 밖의 오류는 `failed`)로 이동합니다.
  - `returnTo`는 `/`로 시작하는 내부 경로만 허용합니다(`//` 금지). 열린 리다이렉트를 막기 위해서입니다.
- **권한**
  - 모든 사용자 API는 `trial_records.user_id = session.userId`를 쿼리 조건에 넣습니다.
  - 관리 API는 `requireRole`로 검사하고, Cloudflare Access로 한 번 더 막습니다.
- **URL 검증**
  - `signupUrl`, `supportContact.url`, `eduBenefit.url`, `escapeLinkFallbackUrl`, `CatalogRequest.serviceUrl`은 `https:`만 허용합니다.
  - `escapeLink`는 `https:`에 더해 `forcedChannel = APP`일 때만 `app_settings`의 `catalog.allowedDeepLinkSchemes`(기본값 `[]`)에 등록된 커스텀 딥링크 스킴을 허용합니다(G4 확정).
- **비밀값**: `KAKAO_CLIENT_SECRET`, `SESSION_SIGNING_KEY`, `PHONE_ENCRYPTION_KEY`, `KAKAO_TOKEN_ENCRYPTION_KEY`(D-16), `ALIMTALK_API_KEY`는 Workers Secrets에 둡니다. 로컬에서는 `.dev.vars`를 쓰고 `.gitignore`에 넣습니다.
- **개인정보**
  - 전화번호는 AES-GCM(키는 `PHONE_ENCRYPTION_KEY`)으로 암호화합니다.
  - 카카오 refresh token은 AES-GCM(키는 `KAKAO_TOKEN_ENCRYPTION_KEY`)으로 암호화합니다(D-16). access token은 메모리에서만 씁니다.
  - 로거는 `phone`, `kakaoId`, `token`, `cookie` 키를 지운 뒤 출력합니다.
  - `ChurnReport`에는 `userId`를 내보내지 않습니다.

---

## 10. 테스트 구조 (Testing Decisions)

- **도구**: Vitest와 `@cloudflare/vitest-plugin`(ADR-0008). 테스트마다 마이그레이션을 적용한 격리 D1에서 돌려 batch 원자성, CHECK·UNIQUE 제약을 실제로 확인합니다.
- **seam**: 각 모듈 `application/`의 명령·조회 핸들러입니다. 경계에서 교체하는 것은 `FakeClock`, `FakeNotificationSender`, `FakeRecipientResolver`, `FakeKakaoOAuthClient`뿐입니다. 순수 함수(알림 계획기·전이표·날짜)도 공개 핸들러를 통해 확인하는 것이 기본입니다. 경계값이 많은 날짜 산정만 예외로 `shared`의 공개 유틸을 직접 테스트합니다.
- **이름 규칙**: `describe('TT 알림 스케줄 [S13][S26]')`, `it('V-08 UNPUBLISHED 항목은 경로 A 생성 거부')`처럼 Testing Decisions 항목과 스토리 번호를 붙입니다(AGENTS §7).
- **HTTP 테스트**는 소수만 둡니다: Auto-fill 기본값 주입, problem+json 형태, 401·403 차단, 공개 응답에 `escapeLink`가 없는지.
- **시나리오**: `tests/scenarios/S-01 … S-05`는 `FakeClock`을 진행시키며 Cron 핸들러를 직접 호출해 SPEC의 핵심 흐름 전체를 확인합니다.
- **실제 알림톡이나 카카오 메시지를 보내는 테스트는 만들지 않습니다.** `kakao-memo` 어댑터는 `fetch`를 모의해 확인합니다(V-10).

---

## 11. 미해결 사항 및 SPEC 갭 처리 현황

구현 에이전트는 미결 사항을 임의로 정하지 않으며, 해당 TASK에 착수하기 전에 결정을 받습니다.

| ID | 내용 | 위치 | 막히는 TASK |
| :--- | :--- | :--- | :--- |
| ~~G1~~ | ~~`AGENTS.md`가 옛 경로(`spec_v1.8.md`, `목업html/`, `../시장분석…/아이디어 구체화 최종.md`)를 기준 문서로 가리킵니다. 실제는 `Dev/SPEC.md`, `Dev/Glossary.md`입니다~~ → **해결됨** (2026-10-23 `AGENTS.md` 갱신 완료. `CLAUDE.md`는 원래 내용이 맞아 수정하지 않음) | AGENTS §1·§2 | 해결됨 |
| ~~G2~~ | ~~`StartCancelAttemptResult`에 `forcedChannel`이 없습니다. D-15 동작에 필요합니다~~ → **해결됨** (권장안 A 확정: SPEC §19 `StartCancelAttemptResult`에 `forcedChannel?: 'APP' \| 'PC_WEB'` 추가) | SPEC §19, §7 | 해결됨 |
| ~~G3~~ | ~~`CANCEL_ATTEMPTED` 기록을 수정·버퍼 변경한 뒤 정규 슬롯이 모두 지났을 때 무엇을 즉시 보낼지 정해져 있지 않습니다(`ESCAPE_ALERT`는 `TRACKING` 전용)~~ → **해결됨** (권장안 A 확정: `CANCEL_ATTEMPTED` 재예약 시 당일 해지 확인 알림 `SAME_DAY_CONFIRM` 규칙 적용, 마감 시각 이후에는 미발송) | SPEC §6 재예약 | 해결됨 |
| ~~G4~~ | ~~`escapeLink` 앱 딥링크의 허용 스킴 목록이 없습니다~~ → **해결됨** (권장안 A 확정: `https:` 기본 허용 + `forcedChannel = APP`일 때 `app_settings` `catalog.allowedDeepLinkSchemes`(기본 `[]`)에 등록된 스킴만 허용) | SPEC §2, AGENTS §6 | 해결됨 |
| ~~G5~~ | ~~운영 설정 발송 시각을 바꿀 때 이미 예약된 `PENDING` 행에도 적용할지 정해져 있지 않습니다~~ → **해결됨** (권장안 A 확정: 변경 이후 생성·재예약되는 슬롯부터 적용하고 기존 `PENDING` 행은 유지) | SPEC §6 | 해결됨 |
| ~~G6~~ | ~~§15는 닉네임 삭제를 언급하지만 §19 `User`에 `nickname`이 없습니다. 스키마에는 선택 컬럼으로 두었습니다~~ → **해결됨** (권장안 A 확정: SPEC §19 `User` 및 OpenAPI `Me`에 `nickname?: string` 추가) | SPEC §15, §19 | 해결됨 |
| FN§4 | 알림톡 수신 번호 확보 방식. `RecipientResolver` 포트로 분리했습니다. 발표용으로는 D-16('나에게 보내기')으로 대체해 발표를 막지 않습니다 | SPEC FN §4 | T31 (보류) |
| ~~D-12 일부~~ | ~~발표용 B2B 컬럼 `published_at`·`featured_order`(§7)를 0001에 넣을지~~ → **해결됨** (2026-10-27 확정: 0001에 포함. 서비스 내 알림 모델은 D-12에 남음) | SPEC D-12, D-17 | 해결됨 |
