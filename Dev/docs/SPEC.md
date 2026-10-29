# 구독컷 (SubCut) 요구사항 명세서 (v1.11 - 발표용 범위 반영본)

> **Triage Label**: `ready-for-agent` `[v1.9]` (워크플로우 2단계 구현 계획부터 착수 가능. 남은 `[결정 필요]` 항목은 Further Notes §7의 결정 시점에 확정하며, 그 전에는 해당 작업을 시작하지 않습니다.)  
> **기준 문서** `[v1.9]`: `Glossary.md` (`Dev/Glossary.md`, 구독컷 도메인 용어집 v1.4, 4장에 `ADR-0001` ~ `ADR-0005` 요약 포함). ADR을 별도 디렉터리(`docs/adr/` 등)로 분리하면 이 줄의 경로를 함께 고칩니다.  
> **기준 우선순위** `[v1.9]`: 요구사항과 동작이 용어집·ADR과 다르면 이 SPEC이 우선합니다. 용어 정의는 Further Notes §2에 따라 용어집 v1.5로 동기화합니다. 차이가 발견되면 구현 에이전트는 추측하지 않고 보고합니다.  
> **v1.11 변경 요약** (2026-10-27, 발표 일정 반영): 발표일(2026-12-09)과 1인 개발 조건에 맞춰 발표용 범위를 확정했습니다(`docs/implementation-plan.md` §7). 사업자 미등록으로 알림톡을 쓸 수 없어, 발표용 알림 채널을 카카오 '나에게 보내기' 메시지 API로 정했고(D-16), 발표용 B2B 화면 4종을 실데이터 단순 집계로 만들기로 정했습니다(D-17). D-02(MVP 성공 기준)를 발표용 기준으로 바꿨습니다. 변경 위치는 `[v1.11]`로 표시했습니다.  
> **v1.10 변경 요약** (2026-10-23, 워크플로우 2단계 구현 계획): D-06(API 계약은 `api/openapi.yaml`에서 정의), D-07(React + Vite SPA, `docs/adr/ADR-0008-cloudflare-stack-and-frontend.md`), D-09(`MISSED_BILLED` 카드에 '다음 달 결제 막기' 추가) 및 구현 계획 중 발견한 SPEC 갭 G2(`StartCancelAttemptResult.forcedChannel` 추가)·G3(`CANCEL_ATTEMPTED` 재예약 시 당일 해지 확인 알림 규칙 적용)·G4(`escapeLink` 딥링크 허용 스킴 설정)·G5(발송 시각 변경은 신규·재예약 슬롯부터 적용)·G6(`User.nickname` 선택 필드 추가)를 확정해 반영했습니다. 아키텍처는 `docs/architecture.md`, 작업 분할은 `docs/tasks.md`에 있습니다. Testing Decisions에 G3·G4·G5 검증 항목을 추가했습니다. 변경 위치는 `[v1.10]`으로 표시했습니다.  
> **v1.9 변경 요약**: 검수 반영. 기준 문서 경로와 우선순위, `[결정 필요]` 표기 도입, Goals·성공 기준·핵심 시나리오 절 추가, 스토리 27을 §6 v1.8 규칙과 일치하도록 수정, §6의 용어집 Avoid 표현('결제일') 수정, §19에 API 계약 미정 사항 표시, §20 스토리 추적표 추가, Non-functional Requirements 절 추가, Testing Decisions에 누락 검증 항목 추가, Further Notes에 용어집 차이·위험 요소·결정 필요 목록 추가. 변경 위치는 `[v1.9]`으로 표시했습니다. **교차 검증 r1**(Gemini 4 Argon, High): 지적 6건을 모두 확인했으며, `CatalogItemPublicView` 타입 모순 수정, `PC_OR_APP_FORCED` 구분 기준(D-15) 신설 후 명시 필드 `forcedChannel`로 확정, P1 데이터 모델 누락(D-12) 확장을 반영했습니다. 나머지 3건(D-06·D-09·D-12의 기존 범위)은 이미 결정 대기로 분리되어 있었습니다.  
> **v1.8 변경 요약**: 누락 항목 보강. `CatalogItem` 표시·가입 필드(`name`, `logoUrl`, `signupUrl`, `lastVerifiedAt`), 기록 수정 전이와 공통 알림 재예약 규칙, 카탈로그 변경의 진행 중 기록 반영 규칙(`bufferApplied` 스냅샷), `SavedAmount` 금액 스냅샷, 국내 항목의 당일 해지 확인 알림 시점, 카탈로그 상세의 `EscapeLink` 비노출, 내 체험 목록(대시보드), 카탈로그 추가 요청(`CatalogRequest`), 회원·알림 수신 설정·탈퇴, 운영자 권한·변경 이력·피처드 슬롯 구성, `ChurnReport` 코호트·분모·발급 방식, 기술 스택·배포(Cloudflare), MVP 우선순위, 누락 타입(`ExitPollResponse`, `BrokenLinkReport`, `Partner`, `User` 등) 추가. 사용자 스토리의 변경 위치는 `[v1.8 신규]`·`[v1.8 수정]`으로 표시했습니다.  
> **v1.7 변경 요약**: 최종 검수 피드백 반영. 늦은 등록 알림 조건 오류 수정, `ExitPoll` 응답 저장을 `CANCEL_ATTEMPTED` 전이와 단일 명령으로 통합, 결제 추정 정정 시 `ExitPoll` 필수화, `BILLED_CONFIRMED` 종료 상태 추가, 알림 3종(탈출·해지 확인·결제 확인) 분리, 파트너 소유 항목(`ownerPartnerId`)과 `SponsoredTrial` 제출·검수 흐름, 피처드 노출 이벤트(`FeaturedEvent`), `AlternativeMatch` 후보 선정, `EscapePattern`별 브릿지 동작, 기록 상세의 브릿지 진입 경로, `DarkPatternLevel` 원점수 저장, `RefundTemplate` 결제일 기입 방식 수정. 사용자 스토리의 변경 위치는 `[v1.7 신규]`·`[v1.7 수정]`으로 표시했습니다.  
> **v1.6 변경 요약**: 잘린 상태 머신 정의 복원, 상태 전이표·알림 스케줄링 규칙 추가, 카탈로그 필수 필드(`serviceCategory`, `monthlyPrice`, `isGlobalTimeZoneBufferRequired`, `supportContact`) 보강, `ChurnReport` 지표 정의, Testing Decisions / Out of Scope / Further Notes 섹션 추가.  
> **표기 규칙**: 용어집·ADR에 근거가 없고 이번 개정에서 새로 정한 결정은 `[제안]`으로 표시하고, 사용자가 확정한 것은 `[확정]`으로 바꿉니다(v1.9: P0 범위 전체 확정). 확정 전 검토가 필요하며, 목록은 Further Notes에 모아 두었습니다.  
> `[v1.9]` 아직 어떤 값도 정하지 않은 사항은 `[결정 필요 D-nn]`으로 표시합니다. 구현 에이전트는 이 항목을 임의로 정하지 않습니다. 목록과 선택지는 Further Notes §7에 있습니다.  
> `[v1.9]` **`[제안]`의 효력** (D-01 확정): P0 범위의 `[제안]`은 사용자가 확정하기 전에는 구현 기준으로 쓰지 않습니다. 구현 에이전트는 확정되지 않은 P0 `[제안]`에 의존하는 작업을 만나면 구현을 멈추고 보고합니다. P1·P2 범위의 `[제안]`은 해당 기능을 구현하기 전에 확정합니다. 확정한 항목은 `[제안]`을 `[확정]`으로 바꿉니다. 범위 구분은 Further Notes §1의 `[P0]`·`[P1]`·`[P2]` 표시를 따릅니다.

---

## Problem Statement

* **B2C 관점 (대학생·청년층 사용자)**:
  * 대학생·청년층은 다양한 구독형 소프트웨어 및 멤버십의 무료체험을 탐색하고 활용하고자 하나, 숨겨진 해지 메뉴, 반복되는 설득 팝업, PC 접속 강제 등 복잡한 **다크패턴 난이도(`DarkPatternLevel`)** 장벽으로 인해 원치 않는 유료 전환 피해를 겪고 있습니다.
  * 특히 해외 기반 글로벌 **카탈로그 항목(`CatalogItem`)**은 해외 시차(UTC/PST)와 시간 단위 정산이 적용되므로, 사용자가 가입 시각(시/분)을 기억하지 못한 채 달력 날짜만으로 계산하면 **공식 결제 예정일(`BillingDate`)** 하루 전(D-1)에 조기 결제가 승인되는 사고가 빈번히 발생합니다.
  * 기존 신용카드 연동 방식(`Rocket Money` 방식)은 민감한 금융 정보 연동에 대한 대학생의 진입장벽이 높고, 첫 달 유료 결제가 이미 승인된 후에야 사후 감지된다는 구조적 한계가 있습니다 (`ADR-0004`).
  * 반면 사용자가 직접 등록하는 수동 모델의 경우, 일일이 날짜와 체험 일수를 타이핑하거나 외부 가입 후 다시 돌아와 검색해야 한다면 입력 피로도로 인해 등록을 포기할 위험이 있습니다.
  * 또한 사용자가 해지 링크를 클릭해 외부 사이트로 이동하더라도 로그인 초기화, 비밀번호 분실, 설득 팝업, PC 접속 강제 등의 장벽으로 인해 실제 해지를 끝내지 못하는 경우가 발생하며 (`ADR-0003`), 해지 시점을 놓쳐 자동 결제가 발생했을 때 즉시 대응할 수 있는 국문·영문 청약철회 수단이 부족합니다.
  * 학교 웹메일(`@ac.kr`) 인증만으로 졸업 시까지 무료 라이선스나 혜택을 받을 수 있는 **학술 무료 혜택(`EduBenefit`)**의 존재를 몰라 불필요한 유료 전환형 무료체험을 신청하는 문제도 존재합니다.
* **B2B 관점 (`Partner`)**:
  * 초기 사용자를 확보하고자 하는 B2B 스타트업 고객인 **파트너사(`Partner`)**는 타겟 대학생·청년층 체험단을 유입시킬 전용 채널이 부족하며, 무료체험 사용자가 유료 전환 전에 왜 이탈하는지 정량화하고 같은 서비스 분야 평균과 비교할 수 있는 객관적 데이터를 확보하기 어렵습니다.

---

## Solution

* **사전 검증된 카탈로그 및 양면 시장 구축**:
  * 해지 진입 경로, 단계별 **해지 가이드라인(`EscapeGuide`)**, 기본 무료체험 일수, **잔여 기간 유지 정책(`AccessRetentionPolicy`)**을 사전 검증하여 등록한 **카탈로그 항목(`CatalogItem`)**을 제공합니다.
  * B2C 유입 및 락인을 위해 운영자가 직접 구축한 대중적 빅테크·AI·배달·OTT·클라우드·학습 분야의 **방어 대상 서비스(`GuardedService`)**와, **파트너사(`Partner`)**가 초기 사용자 확보 및 이탈 데이터 수집을 목적으로 비용을 지불해 전용 라운지 및 피처드 슬롯에 노출하는 **제휴 피처드 체험(`SponsoredTrial`)**으로 양면 시장을 운영합니다.
  * 탐색 단계에서 각 **카탈로그 항목(`CatalogItem`)**의 **다크패턴 난이도(`DarkPatternLevel`)**를 상·중·하로 표시하고, 학교 웹메일(`@ac.kr`) 인증으로 이용 가능한 **학술 무료 혜택(`EduBenefit`)** 대체 플랜 안내 정보를 함께 제공합니다.
* **금융 무연동 '1초 간편 등록(Auto-fill)' 및 안전 만료일(`SafeEndDate`) 기반 추적 (`ADR-0002`, `ADR-0004`)**:
  * 신용카드 연동 없이 사용자가 **카탈로그 항목(`CatalogItem`)**을 선택하여 **체험 기록(`TrialRecord`)**을 생성하는 무연동 사전 방어 모델을 채택합니다.
  * **기본값 자동 채움(Auto-fill) UX**: 사용자가 **카탈로그 항목(`CatalogItem`)**을 선택하면 `무료체험 시작일 = 오늘 날짜`, `체험 일수 = 해당 CatalogItem에 사전 검증된 기본 무료체험 일수`로 자동 세팅되어, 별도 타이핑 없이 버튼 1회 클릭만으로 **체험 기록(`TrialRecord`)** 생성이 완료됩니다 (과거 시작일 수정도 가능).
  * **제휴 피처드 체험(`SponsoredTrial`) 원클릭 연동 프롬프트**: 사용자가 전용 라운지나 피처드 슬롯에서 **제휴 피처드 체험(`SponsoredTrial`)**을 클릭해 외부 무료체험 가입으로 이동할 때, 화면 내 원클릭 프롬프트를 즉시 띄워 재검색 없이 **체험 기록(`TrialRecord`)** 추적을 바로 시작할 수 있도록 지원합니다. 외부 가입을 포기한 경우 등록을 취소(무효화)할 수 있습니다.
  * 해외 시차(UTC/PST) 및 시간 단위 정산에 따른 조기 결제 사고를 원천 차단하기 위해, **공식 결제 예정일(`BillingDate`)**에서 안전 버퍼(글로벌 대상 1일 차감)를 적용한 **안전 만료일(`SafeEndDate`)**을 구독컷 기준 D-Day로 산정하고 D-3, D-1에 카카오톡 **탈출 알림(`EscapeAlert`)**을 발송합니다.
  * **탈출 알림(`EscapeAlert`)** 문구는 **잔여 기간 유지 정책(`AccessRetentionPolicy`)**에 따라 사전 해지 적기(갱신 취소형은 조기 해지 권장, 즉시 종료형은 백업 후 D-1 해지 권장)를 함께 안내합니다.
* **해지 브릿지(`EscapeBridge`) 경유 및 2단계 상태 분리 (`ADR-0001`, `ADR-0003`)**:
  * **탈출 알림(`EscapeAlert`)** 클릭 시 외부 URL로 바로 이동시키지 않고 내부 **해지 브릿지(`EscapeBridge`)**를 먼저 경유하게 하여, 3단계 이내의 **해지 가이드라인(`EscapeGuide`)**과 **사전 백업 가이드(`BackupChecklist`)**를 숙지시킵니다. 5대 **표준 이탈 사유(`ExitReason`)** 중 하나를 고르는 클릭 한 번이 **1초 이탈 투표(`ExitPoll`)** 응답이자 **해지 최단 직링크(`EscapeLink`)** 이동이므로, 브릿지를 거친 모든 해지 시도에서 응답률 100%를 확보합니다. 투표는 체험 기록당 1회만 받으며, 알림 외에 체험 기록 상세 화면에서도 브릿지로 진입할 수 있습니다.
  * **해지 최단 직링크(`EscapeLink`)** 이동 직후에는 즉시 완료 처리하지 않고 중간 상태인 **해지 시도 상태(`CancelAttempted`)**로 전환하며, 최종 완료 미확정 시 D-1에 최종 확인 알림을 1회 더 발송합니다.
  * 사용자는 해지 완료 확정 외에도 체험을 계속 쓰기로 하는 '유지 결정'을 선택할 수 있으며, 이 경우 알림이 중단됩니다.
* **사후 구제, 크라우드소싱 유지보수 및 B2B 데이터 상품화 (`ADR-0005`)**:
  * **안전 만료일(`SafeEndDate`)** 이전에 해지 완료를 확정하면 방어한 월 구독료를 **누적 방어 금액(`SavedAmount`)**으로 합산합니다. 공식 결제 예정일이 지나도 확정되지 않은 체험 기록에는 결제 확인 알림을 보내 '결제됐어요 / 결제 전에 해지했어요 / 계속 쓸래요'로 상태를 정정받고, 결제가 발생한 사용자에게는 서비스명·체험 시작일·고객센터 연락처가 자동 기입된 국문·영문 **환불 요청 템플릿(`RefundTemplate`)**을 제공합니다.
  * 외부 UI 개편 시 로그인 세션을 보유한 실사용자의 원클릭 **경로 오류 제보(`BrokenLinkReport`)**와 운영자 DB 핫픽스로 최신성을 유지합니다.
  * 수집된 **1초 이탈 투표(`ExitPoll`)** 데이터와 유입·해지 지표를 같은 서비스 분야 평균과 비교·분석하여 **파트너사(`Partner`)**에게 **이탈 분석 리포트(`ChurnReport`)**로 판매하며, 해지 완료 사용자의 **표준 이탈 사유(`ExitReason`)**가 조건에 부합할 때만 주 1회 이하의 비침투적 배너로 **제한적 대안 매칭(`AlternativeMatch`)**을 제안합니다.

---

## Goals and Success Criteria `[v1.9]`

### 1. Goals (원천 문서에서 확인된 목표)
* **G-1**: 신용카드·계좌 연동 없이 카탈로그 선택 1회로 무료체험 추적을 시작한다 (`ADR-0004`, §3).
* **G-2**: 글로벌 항목의 조기 결제 사고를 막도록 `SafeEndDate` 기준으로 사전 경고한다 (`ADR-0002`, §4, §6).
* **G-3**: 해지 브릿지를 거친 모든 해지 시도에서 `ExitPoll` 응답을 확보한다 (`ADR-0001`, §7).
* **G-4**: 해지 시도 후 완료가 확정되지 않은 체험 기록을 끝까지 추적해 방치를 막는다 (`ADR-0003`, §5, §6).
* **G-5**: 실사용자 제보로 외부 해지 경로의 최신성을 유지한다 (`ADR-0005`, §10).
* **G-6** (P1·P2): 파트너사에게 체험단 유입 채널과 이탈 분석 리포트를 제공한다 (§11, §12, §18).
* 비목표는 Out of Scope 절을 따릅니다.

### 2. 성공 기준 `[v1.9: D-02 확정]`
* **MVP 성공 기준**: 카카오 알림톡 템플릿(알림 3종과 문구 분기, Further Notes §3)이 사전 심사를 통과한다.
* **발표용 성공 기준** `[v1.11: D-02 변경]`: 사업자 미등록으로 알림톡 심사를 받을 수 없으므로, 2026-12-09 발표에서는 다음을 기준으로 삼습니다. 위 MVP 성공 기준은 사업자 등록 뒤에 다시 적용합니다.
  * 핵심 시나리오 S-01~S-05를 Cloudflare에 배포된 서비스(§17, production 환경)에서 시연할 수 있다.
  * 알림 3종(`ESCAPE_ALERT`, `CANCEL_CONFIRM_CHECK`, `BILLING_CHECK`)이 카카오 '나에게 보내기'(D-16)로 발표자의 카카오톡에 실제로 도착하고, 링크가 브릿지·기록 화면으로 연결된다.
  * B2B 화면 4종(D-17)이 실제 저장 데이터로 동작한다.
  * 알림톡 템플릿 문안(3종 × 문구 분기)은 작성까지만 한다.

### 3. 핵심 시나리오 (구현·테스트 참고 흐름)
아래 시나리오는 본문 규칙만으로 구성했으며 새 규칙을 추가하지 않습니다.
* **S-01 글로벌 항목 정상 해지 (P0)**: `bufferApplied = true` 항목을 경로 A로 1회 클릭 등록(D-3 발송 시각이 미래가 되도록 충분한 체험 일수) → `TRACKING`, `BillingDate = startDate + trialDays`, `SafeEndDate = BillingDate - 1일` → `SafeEndDate - 3일` 10:00 KST에 `ESCAPE_ALERT` → 알림 링크로 브릿지 진입(사유 버튼 5개 표시) → 사유 1회 클릭 → `CANCEL_ATTEMPTED`, `ExitPollResponse` 1건, `EscapeLink` 반환, D-1 슬롯이 `CANCEL_CONFIRM_CHECK`로 교체 → `SafeEndDate - 1일` 10:00 KST에 `CANCEL_CONFIRM_CHECK` → 해지 완료 확정 → `CANCELED_CONFIRMED`, `savedAmount = monthlyPrice`, 이후 예약 알림 없음 (§3~§8).
* **S-02 국내 항목 늦은 등록 (P0)**: `bufferApplied = false` 항목을 `startDate = 오늘 - trialDays`로 등록(`BillingDate = 오늘`) → 등록 직후 `ESCAPE_ALERT` 1회, '오늘 결제될 수 있어요' 경고 문구 (§3, §6 늦은 등록).
* **S-03 결제 추정과 정정 (P0)**: `TRACKING` 상태로 `BillingDate` 경과 → 다음 날 00:10 KST 배치로 `MISSED_BILLED` → 같은 날 10:00 KST `BILLING_CHECK` 1회 → '결제됐어요' → `BILLED_CONFIRMED`, `RefundTemplate`(서비스명·시작일·고객센터 자동 기입, 실제 결제일 빈칸) 노출, `savedAmount = null` (§5, §6, §9, §17).
* **S-04 유지 결정 (P0)**: `TRACKING` 기록에서 '계속 쓸래요' → `KEPT`, 예약 알림 전부 취소, `savedAmount = null` (§5, §6).
* **S-05 기록 수정 후 재예약 (P0)**: `TRACKING` 기록의 `startDate` 수정 → `BillingDate`·`SafeEndDate` 재계산, 미발송 알림 취소 후 새 날짜 기준으로 재예약 (§4~§6).

---

## User Stories

> `[v1.9]` 스토리 번호는 §18·§20에서 참조합니다. 번호 부여 정책(고정 번호 유지 또는 영역별 ID 도입)은 `[결정 필요 D-10]`입니다.

### 1. 카탈로그 탐색 및 양면 시장 (B2C 사용자)
1. **대학생·청년 사용자**로서, 나는 사전 검증된 **카탈로그 항목(`CatalogItem`)** 목록을 탐색하기를 원한다, 이를 통해 해지 진입 경로, 단계별 **해지 가이드라인(`EscapeGuide`)**, 기본 무료체험 일수, **잔여 기간 유지 정책(`AccessRetentionPolicy`)**을 미리 확인하고 안전하게 무료체험을 시작할 수 있다.
2. **대학생·청년 사용자**로서, 나는 대중적인 빅테크·AI·배달·OTT·클라우드·학습 분야의 **방어 대상 서비스(`GuardedService`)**를 분야별로 한눈에 조회하기를 원한다, 이를 통해 일상적으로 사용하는 구독형 소프트웨어 및 멤버십의 해지 경로를 쉽게 찾을 수 있다.
3. **대학생·청년 사용자**로서, 나는 전용 라운지 및 피처드 슬롯에서 **제휴 피처드 체험(`SponsoredTrial`)**을 탐색하기를 원한다, 이를 통해 새로운 스타트업의 무료체험 기회를 발견하고 안전하게 체험할 수 있다.
4. **대학생·청년 사용자**로서, 나는 탐색 카드에 표시된 상·중·하 등급의 **다크패턴 난이도(`DarkPatternLevel`)**를 확인하기를 원한다, 이를 통해 해지 메뉴 숨김 깊이, 설득 팝업 반복 횟수, PC 접속 강제 여부 등 절차적 복잡도를 가입 전에 인지할 수 있다.
5. **대학생·청년 사용자**로서, 나는 특정 **카탈로그 항목(`CatalogItem`)** 조회 시 학교 웹메일(`@ac.kr`) 재학생 인증으로 이용할 수 있는 **학술 무료 혜택(`EduBenefit`)** 대체 플랜 안내 정보를 확인하기를 원한다, 이를 통해 일반 유료 전환형 무료체험 대신 졸업 시까지 무료 라이선스나 학생 혜택을 받을 수 있다.
6. **대학생·청년 사용자**로서, 나는 각 **카탈로그 항목(`CatalogItem`)**의 **잔여 기간 유지 정책(`AccessRetentionPolicy`)**이 '갱신 취소형(만료일까지 이용 권한 유지)'인지 '즉시 종료형(해지 즉시 권한 박탈)'인지 확인하기를 원한다, 이를 통해 나에게 유리한 사전 해지 적기를 판단할 수 있다.

### 2. 금융 무연동 1초 간편 등록 및 일정 추적 (B2C 사용자)
7. **대학생·청년 사용자**로서, 나는 민감한 신용카드 정보를 연동하지 않고 **카탈로그 항목(`CatalogItem`)**의 무료체험 시작일과 체험 일수만으로 **체험 기록(`TrialRecord`)**을 생성하기를 원한다, 이를 통해 금융 정보 노출 부담 없이 첫 달 유료 결제 승인 전에 사전 방어를 시작할 수 있다 (`ADR-0004`).
8. **대학생·청년 사용자**로서, 나는 **카탈로그 항목(`CatalogItem`)**을 선택해 **체험 기록(`TrialRecord`)**을 등록할 때 무료체험 시작일이 '오늘 날짜'로, 체험 일수가 해당 **카탈로그 항목(`CatalogItem`)**의 '사전 검증된 기본 무료체험 일수'로 자동 세팅(Auto-fill)되기를 원한다, 이를 통해 직접 타이핑하지 않고도 단 한 번의 클릭(1초 간편 등록)만으로 추적을 시작할 수 있다.
9. **대학생·청년 사용자**로서, 나는 전용 라운지 및 피처드 슬롯에서 **제휴 피처드 체험(`SponsoredTrial`)**을 클릭해 외부 무료체험 가입으로 이동할 때 원클릭 프롬프트를 통해 즉시 **체험 기록(`TrialRecord`)** 생성을 확정하기를 원한다, 이를 통해 외부 가입 후 다시 돌아와 카탈로그를 재검색하는 번거로움 없이 누락 없는 추적을 시작할 수 있다.
10. **[v1.6 신규] 대학생·청년 사용자**로서, 나는 원클릭 프롬프트로 등록했지만 실제로는 외부 가입을 마치지 않은 **체험 기록(`TrialRecord`)**을 '가입 안 했어요'로 등록 취소하기를 원한다, 이를 통해 존재하지 않는 체험에 대한 **탈출 알림(`EscapeAlert`)**을 받지 않을 수 있다.
11. **대학생·청년 사용자**로서, 나는 가입 시각(시/분)을 별도로 입력하지 않아도 무료체험 시작일에 체험 일수를 합산한 **공식 결제 예정일(`BillingDate`)**이 자동 계산되기를 원한다, 이를 통해 번거로운 입력 절차 없이 달력상의 유료 전환일을 파악할 수 있다 (`ADR-0002`).
12. **대학생·청년 사용자**로서, 나는 해외 시차(UTC/PST)나 시간 단위 정산이 적용되는 글로벌 **카탈로그 항목(`CatalogItem`)**에 대해 **공식 결제 예정일(`BillingDate`)**에서 1일 안전 버퍼가 차감된 **안전 만료일(`SafeEndDate`)**을 구독컷 기준 D-Day로 안내받기를 원한다, 이를 통해 D-1에 조기 결제되는 사고를 원천 차단할 수 있다 (`ADR-0002`).
13. **대학생·청년 사용자**로서, 나는 **안전 만료일(`SafeEndDate`)** 도래 전 D-3 및 D-1 시점에 카카오톡으로 **탈출 알림(`EscapeAlert`)**을 수신하기를 원한다, 이를 통해 무료체험 만료를 잊지 않고 유료 전환 직전에 해지 절차를 밟을 수 있다.
14. **[v1.6 신규] 대학생·청년 사용자**로서, 나는 **탈출 알림(`EscapeAlert`)**에서 해당 항목의 **잔여 기간 유지 정책(`AccessRetentionPolicy`)**에 맞는 해지 적기 안내(예: "지금 해지해도 만료일까지 쓸 수 있어요" / "해지 즉시 이용이 끝나니 백업 후 D-1에 해지하세요")를 함께 받기를 원한다, 이를 통해 남은 체험 기간을 손해 보지 않으면서 안전하게 해지할 수 있다.
15. **[v1.6 신규] 대학생·청년 사용자**로서, 나는 이미 며칠 전에 시작한 체험을 늦게 등록해 D-3·D-1 알림 시점이 지나 버린 경우에도 등록 직후 즉시 **탈출 알림(`EscapeAlert`)**을 1회 받기를 원한다, 이를 통해 늦은 등록 때문에 방어 공백이 생기지 않는다.

### 3. 해지 브릿지(`EscapeBridge`) 및 다크패턴 돌파 (B2C 사용자)
16. **대학생·청년 사용자**로서, 나는 카카오톡 **탈출 알림(`EscapeAlert`)**을 클릭했을 때 외부 사이트로 바로 이동하지 않고 먼저 구독컷 내부의 **해지 브릿지(`EscapeBridge`)** 화면으로 진입하기를 원한다, 이를 통해 외부 사이트의 다크패턴 장벽에 부딪히기 전에 돌파 매뉴얼과 백업 사항을 한눈에 준비할 수 있다 (`ADR-0001`).
17. **대학생·청년 사용자**로서, 나는 **해지 브릿지(`EscapeBridge`)**에서 해당 **카탈로그 항목(`CatalogItem`)**의 **해지 경로 유형(`EscapePattern`)**(플랫폼·계정 직링크 이동형, SPA 모달·심층 메뉴 가이드형, PC 웹·전용 앱 강제 우회형)에 맞춘 우회 안내를 확인하기를 원한다, 이를 통해 외부 결제 구조와 환경 제약에 맞는 정확한 진입 방법을 알 수 있다.
18. **대학생·청년 사용자**로서, 나는 **해지 브릿지(`EscapeBridge`)**에서 숨겨진 메뉴 경로, 설득 팝업 회피법, '즉시 해지 vs 다음 달 갱신 취소' 선택 기준, 인앱 브라우저 로그인 우회법이 3단계 이내의 행동 지침으로 요약된 **해지 가이드라인(`EscapeGuide`)**을 읽기를 원한다, 이를 통해 외부 사이트 접속 후 헤매지 않고 즉시 해지를 수행할 수 있다.
19. **대학생·청년 사용자**로서, 나는 해지 즉시 계정이 정지되거나 작업물(문서, 디자인, 클라우드 사진 등) 접근이 차단되는 **카탈로그 항목(`CatalogItem`)**에 대해 **해지 브릿지(`EscapeBridge`)**에서 **사전 백업 가이드(`BackupChecklist`)**를 확인하기를 원한다, 이를 통해 해지 직전에 소중한 데이터를 안전하게 백업할 수 있다.
20. **[v1.7 수정] 대학생·청년 사용자**로서, 나는 **해지 브릿지(`EscapeBridge`)**에서 5대 **표준 이탈 사유(`ExitReason`)**(가격 부담, 기능·성능 부족, 사용성·UI 복잡, 단기 목적 달성, 대체 서비스 이동) 중 하나를 단 한 번 클릭하는 것으로 **1초 이탈 투표(`ExitPoll`)** 응답과 **해지 최단 직링크(`EscapeLink`)** 이동을 동시에 마치기를 원한다, 이를 통해 주관식 입력이나 추가 클릭 없이 바로 해지 화면으로 향할 수 있다 (`ADR-0001`).
21. **대학생·청년 사용자**로서, 나는 **1초 이탈 투표(`ExitPoll`)** 완료 즉시 계정 설정 페이지, 앱마켓 정기결제 관리 허브, 전용 앱 딥링크 등 해지 화면에 가장 가까운 진입점으로 연결되는 **해지 최단 직링크(`EscapeLink`)**를 통해 이동하기를 원한다, 이를 통해 대리 해지가 불가능한 보안 한계 속에서도 최단 시간 내에 해지 화면에 도달할 수 있다.
22. **[v1.6 신규] 대학생·청년 사용자**로서, 나는 해지에 실패해 **해지 브릿지(`EscapeBridge`)**에 다시 들어왔을 때 **1초 이탈 투표(`ExitPoll`)**를 다시 하지 않고 바로 **해지 가이드라인(`EscapeGuide`)**과 **해지 최단 직링크(`EscapeLink`)**를 이용하기를 원한다, 이를 통해 재시도가 빨라지고 중복 응답으로 통계가 왜곡되지 않는다.
23. **[v1.7 신규] 대학생·청년 사용자**로서, 나는 **탈출 알림(`EscapeAlert`)**을 기다리지 않고도 내 **체험 기록(`TrialRecord`)** 상세 화면의 '해지하러 가기' 버튼으로 **해지 브릿지(`EscapeBridge`)**에 들어가기를 원한다, 이를 통해 '갱신 취소형' 항목처럼 일찍 해지할수록 유리한 경우 알림 전에도 바로 해지를 시작할 수 있다.
24. **[v1.7 신규] 대학생·청년 사용자**로서, 나는 PC 웹이나 전용 앱에서만 해지할 수 있는 항목을 모바일에서 열었을 때 'PC에서 열어 주세요' 안내와 링크 복사 버튼을, 전용 앱이 설치되어 있지 않을 때는 앱마켓·웹 대체 경로를 제공받기를 원한다, 이를 통해 막다른 화면에서 헤매지 않고 해지를 이어 갈 수 있다.

### 4. 2단계 해지 상태 분리 및 최종 방어 (B2C 사용자)
25. **대학생·청년 사용자**로서, 나는 **해지 브릿지(`EscapeBridge`)**에서 **1초 이탈 투표(`ExitPoll`)**를 마치고 **해지 최단 직링크(`EscapeLink`)**로 이동했을 때 내 **체험 기록(`TrialRecord`)**이 즉시 완료 처리되지 않고 중간 상태인 **해지 시도 상태(`CancelAttempted`)**로 유지되기를 원한다, 이를 통해 외부 사이트의 로그인 초기화, 설득 팝업, PC 접속 강제 장벽으로 인해 해지에 실패하더라도 추적 보호를 계속 받을 수 있다 (`ADR-0003`).
26. **[v1.7 수정] 대학생·청년 사용자**로서, 나는 내 **체험 기록(`TrialRecord`)**이 **해지 시도 상태(`CancelAttempted`)**에 머물러 있고 최종 완료가 확정되지 않은 경우 **안전 만료일(`SafeEndDate`)** D-1에 일반 **탈출 알림(`EscapeAlert`)** 대신 '해지를 마치셨나요?' **해지 확인 알림**을 받기를 원한다, 이를 통해 미해지 상태로 방치되어 자동 결제되는 사고를 끝까지 예방할 수 있다 (`ADR-0003`).
27. **[v1.9 수정] 대학생·청년 사용자**로서, 나는 D-1 알림 발송 시점 이후에 **해지 시도 상태(`CancelAttempted`)**가 된 경우에도 **해지 확인 알림**을 1회 더 받기를 원한다(발송 시점은 §6 '당일 해지 확인 알림' 규칙을 따른다: 글로벌 항목은 `SafeEndDate` 당일 20:00 KST, 국내 항목은 전날 시도 시 당일 10:00 KST·당일 시도 시 1시간 뒤, 각 마감 이후의 시도는 결제 확인 흐름으로 이어짐), 이를 통해 마지막 날 시도한 해지도 확인 없이 방치되지 않는다.
28. **대학생·청년 사용자**로서, 나는 외부 사이트에서 해지를 실제로 마친 후 구독컷에서 내 **체험 기록(`TrialRecord`)**의 해지 완료를 최종 확정하기를 원한다, 이를 통해 더 이상 불필요한 알림을 받지 않고 방어 실적을 기록할 수 있다. 해지 브릿지를 거치지 않고 직접 해지한 경우에는 확정 시점에 **1초 이탈 투표(`ExitPoll`)**에 한 번 응답한다.
29. **[v1.6 신규] 대학생·청년 사용자**로서, 나는 체험이 마음에 들어 유료로 계속 쓰기로 했을 때 **체험 기록(`TrialRecord`)**을 '유지 결정'으로 바꾸기를 원한다, 이를 통해 더 이상 **탈출 알림(`EscapeAlert`)**이나 환불 안내를 받지 않는다.
30. **대학생·청년 사용자**로서, 나는 **안전 만료일(`SafeEndDate`)** 이전에 해지를 확정할 때마다 방어해 낸 월 구독료가 합산된 **누적 방어 금액(`SavedAmount`)** 통계를 확인하기를 원한다, 이를 통해 원치 않는 자동 결제로부터 지출을 얼마나 막아냈는지 직관적으로 체감할 수 있다.

### 5. 사후 구제, 제한적 대안 매칭 및 크라우드소싱 제보 (B2C 사용자)
31. **[v1.7 수정] 대학생·청년 사용자**로서, 나는 **공식 결제 예정일(`BillingDate`)**이 지나도록 해지 확정이나 유지 결정을 하지 않은 경우 다음 날 결제 확인 알림을 받고 '결제됐어요 / 결제 전에 해지했어요 / 계속 쓸래요' 중 하나로 상태를 정정하기를 원한다, 이를 통해 실제 상황에 맞는 사후 안내를 받을 수 있다. '결제됐어요'를 고르면 **환불 요청 템플릿(`RefundTemplate`)**을 계속 받고, '결제 전에 해지했어요'를 고를 때 아직 **1초 이탈 투표(`ExitPoll`)** 응답이 없다면 한 번 응답한다.
32. **[v1.7 수정] 대학생·청년 사용자**로서, 나는 무료체험 해지 시점을 놓쳐 원치 않는 자동 결제가 발생했을 때 서비스명, 체험 시작일, 고객센터 연락처가 자동 기입되고 실제 결제일·결제 금액·이름만 채우면 되는 국문·영문 맞춤형 **환불 요청 템플릿(`RefundTemplate`)**을 제공받기를 원한다, 이를 통해 당황하지 않고 신속하게 청약철회를 요청할 수 있다.
33. **대학생·청년 사용자**로서, 나는 해지 완료 후 내가 선택한 **표준 이탈 사유(`ExitReason`)**가 대안 수요 조건에 부합할 때만('단기 목적 달성' 제외) 주 1회 이하로 노출되는 비침투적 배너를 통해 **제한적 대안 매칭(`AlternativeMatch`)**으로 같은 서비스 분야의 **제휴 피처드 체험(`SponsoredTrial`)**을 추천받기를 원한다, 이를 통해 피로감 없이 내 불만 요인을 해결해 줄 대체 카탈로그 항목을 발견할 수 있다.
34. **대학생·청년 사용자**로서, 나는 외부 UI 개편으로 인해 **해지 최단 직링크(`EscapeLink`)**나 **해지 가이드라인(`EscapeGuide`)**이 실제 화면과 다를 때 **해지 브릿지(`EscapeBridge`)**에서 원클릭으로 **경로 오류 제보(`BrokenLinkReport`)**를 전송하기를 원한다, 이를 통해 운영자에게 즉각 수정을 요청하고 다른 사용자들의 피해도 막을 수 있다 (`ADR-0005`).

### 6. B2B 파트너사 및 플랫폼 운영자 (`Partner` & Operator)
35. **[v1.8 수정] 파트너사(`Partner`)**로서, 나는 자사 소프트웨어의 해지 경로·기본 무료체험 일수 등 등록 정보를 운영자에게 제출하고 운영자 검증을 거쳐 **제휴 피처드 체험(`SponsoredTrial`)**으로 게시해 전용 라운지 및 피처드 슬롯에 노출하기를 원한다, 이를 통해 무료체험 탐색 의지가 높은 대학생·청년 초기 사용자들을 효율적으로 확보할 수 있다.
36. **파트너사(`Partner`)**로서, 나는 해지 완료 사용자 중 **표준 이탈 사유(`ExitReason`)**가 대안 수요 조건에 부합하는('단기 목적 달성' 제외) 사용자에게 주 1회 이하의 **제한적 대안 매칭(`AlternativeMatch`)** 배너로 자사의 **제휴 피처드 체험(`SponsoredTrial`)**을 노출하기를 원한다, 이를 통해 같은 서비스 분야의 다른 카탈로그 항목에서 이탈한 실수요 사용자를 자연스럽게 유입시킬 수 있다.
37. **[v1.8 수정] 파트너사(`Partner`)**로서, 나는 운영자의 소유 검증을 거쳐 내 소유로 연결된 **카탈로그 항목(`CatalogItem`)**의 **1초 이탈 투표(`ExitPoll`)** 응답(5대 **표준 이탈 사유(`ExitReason`)** 분포)과 유입·해지 지표를 같은 서비스 분야 평균과 비교·분석한 **이탈 분석 리포트(`ChurnReport`)**를 구매·열람하기를 원한다, 이를 통해 해지 흐름 내 응답률 100%에 기반한 객관적 이탈 원인을 파악하고 제품을 개선할 수 있다. 피처드 등록 없이 리포트만 구매하는 경우에도 같다. MVP에서는 오프라인 계약 후 운영자가 발급한 리포트 파일로 받는다.
38. **[v1.7 수정] 플랫폼 운영자**로서, 나는 **방어 대상 서비스(`GuardedService`)**와 파트너사의 **제휴 피처드 체험(`SponsoredTrial`)**에 대해 서비스 분야, 월 구독료, 글로벌 시차 버퍼 적용 여부, 고객센터 연락처, 기본 무료체험 일수, **다크패턴 난이도(`DarkPatternLevel`)** 산정 원점수, **해지 경로 유형(`EscapePattern`)**, **해지 가이드라인(`EscapeGuide`)**, **해지 최단 직링크(`EscapeLink`)**와 앱 미설치 시 대체 URL, **잔여 기간 유지 정책(`AccessRetentionPolicy`)**, **사전 백업 가이드(`BackupChecklist`)**, **학술 무료 혜택(`EduBenefit`)**을 사전 검증하여 등록·관리하기를 원한다, 이를 통해 높은 신뢰도의 카탈로그 품질을 유지할 수 있다.
39. **[v1.6 신규] 플랫폼 운영자**로서, 나는 해지 메뉴 숨김 깊이, 설득 팝업 반복 횟수, PC·전용 앱 접속 강제 여부를 점수화한 공통 기준표로 **다크패턴 난이도(`DarkPatternLevel`)**를 산정하기를 원한다, 이를 통해 운영자마다 등급이 달라지지 않고 일관된 표시를 유지할 수 있다.
40. **플랫폼 운영자**로서, 나는 실사용자가 **해지 브릿지(`EscapeBridge`)**에서 원클릭으로 전송한 **경로 오류 제보(`BrokenLinkReport`)**를 접수·처리 상태별로 관리하고 DB 핫픽스로 **해지 최단 직링크(`EscapeLink`)**와 **해지 가이드라인(`EscapeGuide`)**을 즉시 수정하기를 원한다, 이를 통해 봇 크롤링이 불가능한 로그인 세션 뒤편의 외부 해지 경로 최신성을 유지할 수 있다 (`ADR-0005`).

### 7. 내 체험 관리 및 계정 (B2C 사용자) `[v1.8 신규]`
41. **[v1.8 신규] 대학생·청년 사용자**로서, 나는 '내 체험' 화면에서 진행 중인 **체험 기록(`TrialRecord`)**을 조치가 필요한 순서와 **안전 만료일(`SafeEndDate`)**이 가까운 순서로 보고, 각 기록의 D-Day·상태·다음 행동 버튼을 한눈에 확인하기를 원한다, 이를 통해 알림을 놓쳤더라도 어떤 체험부터 정리해야 하는지 바로 알 수 있다.
42. **[v1.8 신규] 대학생·청년 사용자**로서, 나는 체험 시작일이나 체험 일수를 잘못 입력했을 때 추적 중인 **체험 기록(`TrialRecord`)**을 수정하기를 원한다, 이를 통해 날짜와 알림이 실제 체험 일정에 맞게 다시 잡힌다.
43. **[v1.8 신규] 대학생·청년 사용자**로서, 나는 카탈로그에 없는 서비스를 서비스명(과 선택적으로 URL)만으로 추가 요청하기를 원한다, 이를 통해 내가 쓰는 서비스도 검증된 해지 안내와 함께 추적할 수 있게 된다.
44. **[v1.8 신규] 대학생·청년 사용자**로서, 나는 카카오톡 알림 수신을 켜고 끄기를 원한다, 이를 통해 알림 채널을 내가 통제할 수 있다. 끌 때는 알림이 없으면 결제 직전 경고를 받지 못한다는 안내를 받는다.
45. **[v1.8 신규] 대학생·청년 사용자**로서, 나는 회원 탈퇴 시 내 개인 식별 정보가 삭제되고 예약된 알림이 모두 취소되기를 원한다, 이를 통해 서비스를 그만 쓸 때 내 정보가 남지 않는다는 확신을 가질 수 있다.
46. **[v1.8 신규] 대학생·청년 사용자**로서, 나는 체험 기록 없이 카탈로그 상세를 보다가 '이미 가입했어요'를 누르면 추적 등록과 동시에 **해지 브릿지(`EscapeBridge`)**로 들어가기를 원한다, 이를 통해 추적 등록과 해지 시작을 한 번에 할 수 있다.

### 8. 플랫폼 운영 (Operator) `[v1.8 신규]`
47. **[v1.8 신규] 플랫폼 운영자**로서, 나는 운영자·관리자 역할로 나뉜 관리 콘솔에서 작업하고 카탈로그 변경마다 누가 무엇을 바꿨는지 이력으로 남기기를 원한다, 이를 통해 잘못된 수정을 추적하고 되돌릴 수 있다.
48. **[v1.8 신규] 플랫폼 운영자**로서, 나는 카탈로그 항목의 글로벌 시차 버퍼 여부를 바꿀 때 진행 중인 체험 기록에도 적용할지 선택하기를 원한다, 이를 통해 잘못 등록된 값을 바로잡을 때 이미 추적 중인 사용자도 보호할 수 있다.
49. **[v1.8 신규] 플랫폼 운영자**로서, 나는 사용자의 카탈로그 추가 요청(`CatalogRequest`)을 서비스별 요청 수와 함께 보고 등록·반려 처리하기를 원한다, 이를 통해 수요가 큰 서비스부터 카탈로그를 넓힐 수 있다.
50. **[v1.8 신규] 플랫폼 관리자**로서, 나는 파트너와의 계약을 확인한 뒤 항목·기간을 지정한 리포트 발급권(`ReportGrant`)을 만들고 그 범위의 **이탈 분석 리포트(`ChurnReport`)**를 생성해 파일로 전달하기를 원한다, 이를 통해 결제·포털 없이도 MVP 단계에서 리포트를 판매할 수 있다.

---

## Implementation Decisions

### 1. 핵심 도메인 모듈 구성 (Core Modules)
시스템은 도메인 경계에 따라 다음 5개의 핵심 모듈로 구성됩니다. 모듈 간 호출은 상대 모듈의 공개 명령·조회만 사용합니다(예: 카탈로그의 버퍼 변경을 진행 중 기록에 적용할 때 Catalog 모듈은 Trial Tracking 모듈의 `ApplyBufferChangeToActiveRecords` 명령을 호출합니다).

| 모듈명 | 책임 및 주요 관리 도메인 객체 | 관련 ADR |
| :--- | :--- | :--- |
| **1. Catalog & Marketplace Module** | `CatalogItem`(`GuardedService`, `SponsoredTrial`), `Partner` 및 항목 소유 연결(`ownerPartnerId`), `SponsoredTrial` 제출·검수·게시(`publicationStatus`), `DarkPatternLevel`(원점수 저장·기준표 산정), `EduBenefit`, `AccessRetentionPolicy`, `EscapePattern`, `EscapeGuide`(1~3단계), `EscapeLink`(대체 URL 포함), `BackupChecklist`, `serviceCategory`, `monthlyPrice`, `isGlobalTimeZoneBufferRequired`, `supportContact`, `defaultTrialDays` 등록·조회, 경로 오류 제보에 따른 핫픽스 반영, 피처드 슬롯 구성·노출 관리, `name`·`logoUrl`·`signupUrl`·`lastVerifiedAt` 관리, 카탈로그 변경 이력(`CatalogChangeLog`), 카탈로그 추가 요청(`CatalogRequest`) 접수·처리 | `ADR-0001`, `ADR-0002`, `ADR-0004`, `ADR-0005` |
| **2. Trial Tracking & Schedule Module** | 무연동 1초 간편 등록(Auto-fill) 기반 `TrialRecord` 생성·무효화, `SponsoredTrial` 외부 이동 시 원클릭 추적 생성, `BillingDate`·`SafeEndDate` 산정, 알림 3종(`ESCAPE_ALERT`, `CANCEL_CONFIRM_CHECK`, `BILLING_CHECK`) 스케줄링, `ExitPoll` 응답 저장을 포함한 `TrialRecord` 상태 전이, `SavedAmount` 금액 스냅샷 저장, 기록 수정과 알림 재예약, 알림 예약 테이블(`NotificationSchedule`)의 멱등 발송, 내 체험 목록 조회 | `ADR-0002`, `ADR-0003`, `ADR-0004` |
| **3. EscapeBridge & Recovery Module** | `EscapeBridge` 렌더링(알림·기록 상세 진입, `EscapePattern`별 동작), `ExitReason` 사유 선택 시 Trial Tracking 모듈의 해지 시도 명령 호출 후 `EscapeLink` 이동, `BrokenLinkReport` 접수·처리 상태 관리, `RefundTemplate`(국/영문, 변수 자동 기입) 제공 | `ADR-0001`, `ADR-0003`, `ADR-0005` |
| **4. B2B Analytics & Matching Module** | 피처드 노출·클릭 이벤트(`FeaturedEvent`) 수집, `ExitPoll` 응답 및 유입·해지 지표 집계, `serviceCategory` 평균 대비 `ChurnReport` 생성·제공(최소 표본·소유 항목 열람 범위 적용), `AlternativeMatch` 조건 필터링·후보 선정 및 사용자당 주 1회 빈도 제한 배너 노출, 리포트 발급권(`ReportGrant`) 관리와 리포트 생성·내보내기 | `ADR-0001` |
| **5. Identity & Account Module** `[v1.8 신규]` | `User` 로그인·세션, 알림 수신 설정(`notificationEnabled`), 회원 탈퇴와 식별 정보 삭제, 역할(`USER`·`OPERATOR`·`ADMIN`) 기반 접근 제어 | — |

### 2. 카탈로그 데이터 규칙
* **표시·가입 필드** `[v1.8 신규]`: 서비스명(`name`, 필수)은 카드·브릿지·알림 문구·`RefundTemplate`에 씁니다. 로고(`logoUrl`, 선택)는 외부 이미지 링크 대신 구독컷 저장소(§17)에 올린 파일을 씁니다 `[확정]`. 외부 가입 URL(`signupUrl`)은 경로 B의 무료체험 시작하기 버튼이 여는 주소로, `SPONSORED_TRIAL`은 필수이고 `GUARDED_SERVICE`는 선택이며 `EscapeLink`와는 다른 값입니다. 최종 검증일(`lastVerifiedAt`, 필수)은 운영자가 해지 경로를 마지막으로 직접 확인한 날짜로, 브릿지와 카탈로그 상세에 'YYYY-MM-DD 확인' 형태로 표시합니다.
* **서비스 분야(`serviceCategory`)**: `ChurnReport`의 분야 평균과 `AlternativeMatch`의 대체 항목 매칭 기준이 되는 필수 필드입니다. 값은 용어집의 빅테크·AI·배달·OTT·클라우드·학습에 `ETC`를 더한 7종입니다 `[확정: ETC 추가]`. 기존 v1.5의 `CatalogCategory`(방어 대상 서비스 vs 제휴 피처드 체험 구분)는 분야와 혼동되므로 `CatalogItemKind`로 이름을 바꿉니다.
* **월 구독료(`monthlyPrice`, 원화 정수)**: `SavedAmount` 합산의 근거입니다. 외화 결제 항목은 운영자가 등록 시점 환율로 환산한 원화 금액을 입력합니다 `[확정]`.
* **글로벌 시차 버퍼 여부(`isGlobalTimeZoneBufferRequired`)**: 운영자가 등록하는 필수 불리언 필드이며, `SafeEndDate` 산정에 사용합니다 (`ADR-0002`).
* **고객센터 연락처(`supportContact`)**: `RefundTemplate` 자동 기입용 필드입니다 (이메일·문의 페이지 URL 중 하나 이상).
* **해지 가이드라인(`EscapeGuide`)**: 1~3개의 단계로만 저장할 수 있으며, 4단계 이상은 등록 시 검증 오류로 거부합니다.
* **소유 파트너(`ownerPartnerId`)** `[제안]`: `CatalogItem`과 `Partner`의 소유 연결이며 `ChurnReport` 열람 권한의 기준입니다. `SPONSORED_TRIAL`은 필수이고, `GUARDED_SERVICE`는 리포트만 구매하는 파트너가 운영자의 소유 검증을 통과한 경우에만 연결합니다.
* **게시 상태(`publicationStatus`)와 `SponsoredTrial` 제출·검수 흐름** `[확정: 상태 값]` `[제안: 제출·검수 흐름(P1)]`: 파트너가 등록 정보를 제출하면 `SUBMITTED`가 되고(MVP에서는 파트너 계정 없이 이메일 등으로 받은 정보를 운영자가 콘솔에 대리 입력합니다 `[v1.8 제안]`), 운영자가 해지 경로·`EscapeGuide`·`EscapeLink`·`DarkPatternLevel` 원점수 등을 직접 검증해 `PUBLISHED` 또는 `REJECTED`로 처리합니다. 운영자는 게시 중인 항목을 `UNPUBLISHED`로 내릴 수 있습니다. `GUARDED_SERVICE`는 운영자가 직접 등록하므로 `PUBLISHED`로 생성합니다. 전용 라운지·피처드 슬롯·`AlternativeMatch` 후보는 `PUBLISHED` 항목만 대상이며, 게시가 중단된 항목의 기존 체험 기록은 추적과 브릿지 안내를 계속 받습니다. `[v1.9: D-11 확정]` 일반 카탈로그 목록·검색에는 `PUBLISHED`와 `UNPUBLISHED` 항목을 노출하고, `SUBMITTED`·`REJECTED` 항목은 노출하지 않습니다. `[v1.9: D-13 확정]` `UNPUBLISHED` 항목은 목록·검색과 상세 화면에 '게시 중단' 안내와 함께 표시하되, 새 체험 기록은 만들 수 없습니다. 경로 A 등록, 경로 B 프롬프트, '이미 가입했어요'가 모두 해당하며, 이 경우 `SponsoredTrial`의 무료체험 시작하기 버튼(`signupUrl`)도 표시하지 않습니다. 이미 만들어진 기록은 위와 같이 추적과 브릿지 안내를 계속 받습니다.
* **해지 최단 직링크 대체 URL(`escapeLinkFallbackUrl`)과 URL 스킴 검증**: `EscapeLink`가 전용 앱 딥링크인 항목은 앱 미설치 시 연결할 앱마켓 또는 웹 URL을 필수로 등록합니다. `[v1.9: D-15 확정]` 딥링크 여부는 아래 `forcedChannel`로 판별하며, `forcedChannel = APP`이면 이 URL이 필수입니다. `[v1.10: G4 확정]` `signupUrl`, `supportContact.url`, `eduBenefit.url`, `escapeLinkFallbackUrl`, `CatalogRequest.serviceUrl`은 `https:` 스킴만 허용합니다. `escapeLink`는 기본적으로 `https:`(Universal Links·App Links 포함)만 허용하되, `forcedChannel = APP`인 항목에 한해 운영 설정(`catalog.allowedDeepLinkSchemes`, 기본값 `[]`)에 등록된 커스텀 앱 스킴도 허용합니다.
* **강제 접속 채널(`forcedChannel`)** `[v1.9: D-15 확정]`: `escapePattern = PC_OR_APP_FORCED`인 항목은 해지가 전용 앱에서만 되는지(`APP`), PC 웹에서만 되는지(`PC_WEB`)를 운영자가 등록할 때 반드시 고릅니다. 그 밖의 `EscapePattern` 항목에서는 비워 둡니다. 브릿지 동작(§7)과 대체 URL 필수 검증은 이 값으로 판단합니다.
* **다크패턴 난이도(`DarkPatternLevel`) 산정 기준표** `[확정]`: 세 항목 점수를 합산해 등급을 정합니다.

| 항목 | 0점 | 1점 | 2점 |
| :--- | :--- | :--- | :--- |
| 해지 메뉴 숨김 깊이 | 2클릭 이내 | 3~4클릭 | 5클릭 이상 |
| 설득 팝업 반복 횟수 | 없음 | 1회 | 2회 이상 |
| PC 웹·전용 앱 접속 강제 | 없음 | — | 있음 |

  합산 0~1점은 하(`LOW`), 2~3점은 중(`MEDIUM`), 4점 이상은 상(`HIGH`)입니다. 운영자는 세 항목 원점수를 입력하고 등급은 시스템이 계산합니다. 원점수는 `darkPatternScores`로 함께 저장해 기준표가 바뀌면 전체 항목의 등급을 다시 계산할 수 있게 합니다.
* **카탈로그 변경의 진행 중 기록 반영** `[v1.8 신규]` `[확정]`: 필드별로 다르게 처리합니다.
  * `name`, `logoUrl`, `EscapeGuide`, `EscapeLink`, `escapeLinkFallbackUrl`, `BackupChecklist`, `supportContact`, `EduBenefit`, `DarkPatternLevel`: 저장 즉시 모든 화면에 반영합니다. 브릿지와 `RefundTemplate`은 항상 조회 시점의 값을 씁니다.
  * `defaultTrialDays`: 새로 만드는 기록에만 적용합니다. 기존 기록의 `trialDays`는 사용자 값이므로 바꾸지 않습니다.
  * `monthlyPrice`: 이후 확정되는 기록부터 적용합니다. 이미 합산된 금액은 `savedAmount` 스냅샷이라 바뀌지 않습니다(§8).
  * `isGlobalTimeZoneBufferRequired`: 기록 생성 시 `bufferApplied`로 복사해 두므로 기본적으로 기존 기록에 영향이 없습니다. 운영자가 저장 화면에서 '진행 중 기록에도 적용'을 선택하면, `BillingDate`가 오늘(KST) 이후인 `TRACKING`·`CANCEL_ATTEMPTED` 기록의 `bufferApplied`·`SafeEndDate`를 다시 계산하고 §6의 알림 재예약 규칙을 적용합니다.
  * `serviceCategory`: 이후 응답부터 적용합니다. 과거 `ExitPoll` 응답은 응답 시점 값을 유지합니다(§7).
  * 모든 변경은 `CatalogChangeLog`에 남깁니다(§16).

### 3. 1초 간편 등록(Auto-fill) 및 `SponsoredTrial` 원클릭 추적 (`ADR-0002`, `ADR-0004`)
* **경로 A (일반 카탈로그 검색·선택 등록)**: 사용자가 **방어 대상 서비스(`GuardedService`)** 또는 **제휴 피처드 체험(`SponsoredTrial`)** 카드를 클릭해 **체험 기록(`TrialRecord`)** 생성 화면을 열면, 클라이언트는 `startDate = 오늘 날짜(KST, YYYY-MM-DD)`와 `trialDays = CatalogItem.defaultTrialDays`를 기본값으로 바인딩합니다. 서버 API도 요청에서 `startDate`나 `trialDays`가 생략되면 같은 기본값을 주입하여 **단 1회의 클릭만으로 등록이 완결**되도록 합니다. 이미 며칠 전에 시작한 체험인 경우에만 사용자가 `startDate`를 과거 날짜로 바꿉니다.
* **경로 B (`SponsoredTrial` 외부 이동 시 원클릭 프롬프트)**: 사용자가 전용 라운지나 피처드 슬롯에서 **제휴 피처드 체험(`SponsoredTrial`)**의 무료체험 시작하기 버튼을 클릭하면, 새 탭(또는 인앱 브라우저)으로 외부 가입 페이지(`CatalogItem.signupUrl`)를 열면서 동시에 구독컷 화면에 **"방금 시작하신 무료체험, 안전 만료일(`SafeEndDate`)에 알려드릴까요? [1초 추적 시작]"** 프롬프트를 띄웁니다. 버튼을 누르면 검색이나 날짜 입력 없이 해당 `SponsoredTrial`의 `TrialRecord`가 `source = SPONSORED_OUTBOUND_PROMPT`로 생성됩니다.
* **입력 검증**:
  * `startDate`는 오늘(KST) 이후일 수 없습니다.
  * `trialDays`는 1 이상 365 이하의 정수입니다 `[확정: 상한값]`.
  * 계산된 `BillingDate`가 오늘보다 이전이면 이미 끝난 체험으로 보고 등록을 거부합니다.
  * `[v1.9: D-11·D-13]` 새 기록은 `publicationStatus = PUBLISHED`인 항목에만 만들 수 있으며, 그 밖의 항목에 대한 요청은 거부합니다.
  * 동일 사용자·동일 `CatalogItem`에 진행 중(`TRACKING`, `CANCEL_ATTEMPTED`)인 기록이 있으면 중복 생성 대신 기존 기록으로 안내합니다 `[확정]`.
* **등록 무효화(`VOIDED`)**: 경로 B로 생성했으나 외부 가입을 하지 않은 경우를 위해, `TRACKING` 상태의 기록은 사용자가 '가입 안 했어요'로 무효화할 수 있습니다. `TRACKING` 기록에는 구조상 `ExitPoll` 응답이 없으므로(§5 불변식) 무효화로 투표 데이터가 사라지는 일은 없습니다. 무효화된 기록은 모든 알림과 `ChurnReport`·`SavedAmount` 집계에서 제외됩니다.

### 4. 날짜 산정 규칙 (`BillingDate` vs `SafeEndDate`, `ADR-0002`)
* 사용자는 가입 시각(시/분)이나 신용카드 정보 없이 `startDate`와 `trialDays`만으로 **체험 기록(`TrialRecord`)**을 생성합니다 (`ADR-0004`).
* 모든 날짜 계산은 KST 기준 달력 날짜(시각 없음)로 수행하며, 일 단위 가산이므로 월말·윤년 경계는 날짜 라이브러리의 일 단위 연산을 따릅니다.
* **공식 결제 예정일(`BillingDate`)**: `startDate + trialDays`.
* **안전 만료일(`SafeEndDate`)**: 기록 생성 시 `CatalogItem.isGlobalTimeZoneBufferRequired`를 `TrialRecord.bufferApplied`로 복사해 두고, `bufferApplied = true`이면 `BillingDate - 1일`, 그렇지 않으면 `BillingDate`입니다. 구독컷의 기준 D-Day입니다. 이후 카탈로그 값이 바뀌어도 기존 기록은 §2의 반영 규칙을 따릅니다 `[v1.8 수정]`.
* `BillingDate`와 `SafeEndDate`는 생성 시 계산해 저장하고, 사용자가 `startDate`나 `trialDays`를 수정하면 재계산 후 알림을 다시 예약합니다. 수정 가능 상태와 검증은 §5, 재예약 규칙은 §6을 따릅니다.
* **시간대 처리** `[v1.8 신규]`: 서버(Cloudflare Workers)는 UTC로 동작하므로 '오늘(KST)'은 항상 'UTC 현재 시각 + 9시간'의 날짜로 구합니다. 한국은 일광절약시간이 없으므로 고정 오프셋을 씁니다. 시각(발송 예정 시각, 상태 전이 시각 등)은 UTC ISO 8601 문자열로, 날짜(`startDate`, `BillingDate`, `SafeEndDate`)는 KST 기준 `YYYY-MM-DD` 문자열로 저장합니다.

### 5. 체험 기록(`TrialRecord`) 상태 머신 (`ADR-0003`)
v1.6의 6개 상태에 사용자가 결제를 확인한 `BILLED_CONFIRMED`를 추가합니다 `[확정]`. `MISSED_BILLED`는 금융 무연동 구조상 실제 결제를 감지할 수 없으므로 "결제 추정" 상태로 정의하고, 사용자가 세 가지 선택지로 정정할 수 있게 합니다.

| 현재 상태 | 이벤트 | 다음 상태 | 부수 효과 |
| :--- | :--- | :--- | :--- |
| (없음) | 체험 기록 생성 | `TRACKING` | `bufferApplied` 복사, `BillingDate`·`SafeEndDate` 계산, 알림 스케줄 등록 |
| `TRACKING` · `CANCEL_ATTEMPTED` | 사용자 기록 수정(`startDate`·`trialDays`) `[v1.8 신규]` | (변화 없음) | 생성과 같은 입력 검증(수정 후 `BillingDate`가 오늘 이전이면 거부), `BillingDate`·`SafeEndDate` 재계산, §6 알림 재예약 규칙 적용 |
| `TRACKING` · `CANCEL_ATTEMPTED` | 운영자의 버퍼 변경을 진행 중 기록에 적용 `[v1.8 신규]` | (변화 없음) | `bufferApplied`·`SafeEndDate` 재계산, §6 알림 재예약 규칙 적용 |
| `TRACKING` | 브릿지에서 `ExitReason` 사유 선택(= `EscapeLink` 이동) | `CANCEL_ATTEMPTED` | 같은 트랜잭션에서 `ExitPoll` 응답 저장, 아직 발송 전인 D-3 알림 취소, D-1 알림을 해지 확인 알림으로 교체 |
| `CANCEL_ATTEMPTED` | 해지 브릿지 재진입 후 `EscapeLink` 이동 | `CANCEL_ATTEMPTED` | 투표 생략, 상태 변화 없음 |
| `TRACKING` | 사용자 해지 완료 확정 | `CANCELED_CONFIRMED` | 확정 화면에서 `ExitPoll` 1회 응답 필수(같은 트랜잭션), `SavedAmount` 규칙 적용, 이후 알림 전부 취소 |
| `CANCEL_ATTEMPTED` | 사용자 해지 완료 확정 | `CANCELED_CONFIRMED` | `SavedAmount` 규칙 적용, 이후 알림 전부 취소 |
| `TRACKING` · `CANCEL_ATTEMPTED` | 사용자 유지 결정 | `KEPT` | 이후 알림 전부 취소 |
| `TRACKING` | 사용자 등록 취소 | `VOIDED` | 이후 알림 전부 취소, 모든 집계에서 제외 |
| `TRACKING` · `CANCEL_ATTEMPTED` | `BillingDate` 경과 (다음 날 배치) | `MISSED_BILLED` | 결제 확인 알림 발송, `RefundTemplate` 노출 |
| `MISSED_BILLED` | 사용자 정정: "결제됐어요" | `BILLED_CONFIRMED` | `RefundTemplate` 계속 노출 |
| `MISSED_BILLED` | 사용자 정정: "결제 전에 해지했어요" | `CANCELED_CONFIRMED` | `ExitPoll` 응답이 없으면 정정 화면에서 1회 응답 필수(같은 트랜잭션), `SafeEndDate`가 지난 뒤의 확정이므로 `SavedAmount`에 합산하지 않음 |
| `MISSED_BILLED` | 사용자 정정: "계속 쓸래요" | `KEPT` | `RefundTemplate` 노출 중단 |

* **종료 상태**: `CANCELED_CONFIRMED`, `KEPT`, `VOIDED`, `BILLED_CONFIRMED`입니다. `MISSED_BILLED`는 위 세 가지 정정만 허용하며, 사용자가 응답하지 않으면 추가 알림 없이 그대로 남아 `ChurnReport`에서 '결제 추정'으로 집계됩니다 `[확정]`.
* **`ExitPoll` 불변식**: `TRACKING` 기록은 투표 응답이 없고, `CANCEL_ATTEMPTED`·`CANCELED_CONFIRMED` 기록은 응답을 정확히 1건 가집니다. 응답이 생기는 지점은 `TRACKING → CANCEL_ATTEMPTED`, `TRACKING → CANCELED_CONFIRMED`, 응답이 없던 기록의 `MISSED_BILLED → CANCELED_CONFIRMED` 세 전이뿐이며, 각각 응답 저장과 상태 전이를 하나의 트랜잭션으로 처리합니다. `CANCEL_ATTEMPTED`에서 `KEPT`·`MISSED_BILLED`로 넘어간 기록은 기존 응답을 보존합니다.
* **기록 수정 범위** `[v1.8 신규]` `[확정]`: 수정은 `TRACKING`·`CANCEL_ATTEMPTED`에서만 허용합니다. `MISSED_BILLED` 이후의 기록은 날짜를 고치는 대신 결제 확인 정정(세 가지 선택지)으로 처리하고, 종료 상태 기록은 수정할 수 없습니다. `catalogItemId`와 `source`는 수정할 수 없으며, 다른 서비스로 잘못 등록했다면 `VOIDED` 처리 후 새로 등록합니다.
* **회원 탈퇴** `[v1.9: D-08 확정]`: 사용자의 체험 기록을 상태와 관계없이 모두 삭제합니다(§15). 삭제는 상태 전이가 아니므로 전이표의 부수 효과(알림 발송, `SavedAmount` 등)는 일어나지 않습니다.
* 상태가 바뀔 때마다 `statusChangedAt`을 갱신합니다(내 체험 목록 정렬에 사용).
* 이 상태 머신은 Trial Tracking 모듈의 단일 진입점에서만 변경되며, 허용되지 않은 전이는 오류로 거부합니다.

### 6. 알림 종류와 스케줄링 규칙
용어집의 **탈출 알림(`EscapeAlert`)**은 사전 해지 경고이므로, 성격이 다른 해지 확인·결제 확인 알림과 분리해 세 종류로 관리합니다 `[확정: 종류 분리]`. 세 종류 모두 카카오톡 알림톡 템플릿을 따로 둡니다.

| 알림 종류 | 코드 | 성격 | 발송 대상 상태 |
| :--- | :--- | :--- | :--- |
| 탈출 알림(`EscapeAlert`) | `ESCAPE_ALERT` | `BillingDate` 이전의 사전 해지 경고 (정규 D-3·D-1, 늦은 등록 즉시 알림) | `TRACKING` |
| 해지 확인 알림 | `CANCEL_CONFIRM_CHECK` | 해지 시도 후 완료 여부 확인 ("해지를 마치셨나요?") | `CANCEL_ATTEMPTED` |
| 결제 확인 알림 | `BILLING_CHECK` | `BillingDate` 경과 후 상태 정정 요청 | `MISSED_BILLED` |

* **발송 시각**: 운영 설정값으로 두며 기본값은 오전 10:00 KST입니다 `[확정]`. `[v1.10: G5 확정]` 운영 설정의 기본 발송 시각을 바꾸면 변경 이후 새로 만들어지거나 재예약되는 슬롯부터 적용하고, 이미 예약된 `PENDING` 행의 `sendAt`은 그대로 둡니다.
* **D-3 알림**(`SafeEndDate - 3일`): `TRACKING` 상태에만 `ESCAPE_ALERT`를 발송합니다.
* **D-1 알림**(`SafeEndDate - 1일`): 기록당 1회만 발송하며, `TRACKING`이면 `ESCAPE_ALERT`, `CANCEL_ATTEMPTED`이면 `CANCEL_CONFIRM_CHECK`를 보냅니다. ADR-0003의 "1회 더"는 D-1 탈출 알림을 해지 확인 알림으로 교체하는 것으로 해석합니다 `[확정]`.
* **당일 해지 확인 알림** `[v1.8 수정]`: D-1 발송 시각 이후에 `CANCEL_ATTEMPTED`가 된 기록에 `CANCEL_CONFIRM_CHECK`를 1회 더 보냅니다. 국내 항목은 `SafeEndDate`가 곧 공식 결제 예정일(`BillingDate`)이라 `[v1.9: 용어집 Avoid 표현 수정]` 저녁 발송이 늦을 수 있으므로 항목 종류에 따라 시점을 나눕니다 `[확정: 발송 시각]`.
  * 글로벌 항목(`bufferApplied = true`, 결제는 다음 날인 `BillingDate`): `SafeEndDate` 당일 20:00 KST에 보냅니다. 20:00 이후에 시도한 기록은 결제 확인 흐름(`BILLING_CHECK`)으로 이어집니다.
  * 국내 항목(`SafeEndDate = BillingDate`, 당일 중 언제든 결제될 수 있음): 시도가 `SafeEndDate` 전날이면 `SafeEndDate` 당일 기본 발송 시각(10:00 KST)에, 당일이면 전이 시각 1시간 뒤에 보냅니다. 당일 21:00 KST 이후의 시도에는 보내지 않고 결제 확인 흐름으로 이어집니다. 문구에 '오늘이 결제 예정일이라 이미 결제됐을 수 있어요'를 포함합니다.
* **늦은 등록**: 등록 시점에 D-3·D-1 발송 시각이 모두 지났고 오늘이 `BillingDate` 이하(당일 포함)이면, 등록 직후 `ESCAPE_ALERT`를 즉시 1회 발송합니다. 문구는 위에서부터 먼저 해당하는 것을 씁니다.
  * 오늘 = `BillingDate`: "오늘 결제될 수 있어요. 지금 바로 해지하세요" 경고 문구. 국내 항목은 `SafeEndDate`와 `BillingDate`가 같으므로 안전 만료일 당일 등록도 여기에 해당합니다.
  * 오늘 = `SafeEndDate`(글로벌 항목, `BillingDate` 하루 전): "오늘이 안전하게 해지할 수 있는 마지막 날이에요" 문구.
  * 그 외(D-1 발송 시각 이후 등록): 일반 탈출 알림 문구.
* **문구 분기**: `ESCAPE_ALERT`는 `AccessRetentionPolicy`가 `RETAIN_UNTIL_END`이면 "지금 해지해도 만료일까지 이용 가능, 조기 해지 권장", `IMMEDIATE_TERMINATION`이면 "해지 즉시 이용 종료, `BackupChecklist` 확인 후 D-1 해지 권장"을 포함합니다. 늦은 등록의 경고 문구 두 가지에서는 `IMMEDIATE_TERMINATION` 안내를 "백업 후 바로 해지"로 바꿉니다.
* **결제 확인 알림**: `MISSED_BILLED` 전이 시 `BillingDate + 1일` 발송 시각에 `BILLING_CHECK`를 1회 발송하며, 세 가지 정정 선택지 화면으로 연결합니다.
* **알림 취소**: 종료 상태로 전이하면 예약된 모든 알림을 취소합니다.
* **알림 재예약 규칙** `[v1.8 신규]` `[확정]`: 기록 수정이나 버퍼 변경으로 `SafeEndDate`가 바뀌면, 아직 발송되지 않은 예약 알림을 모두 취소하고 새 날짜 기준으로 다시 계산합니다. 새 날짜 기준으로 미래인 슬롯은 이전에 같은 슬롯을 보낸 적이 있어도 다시 예약합니다(마감일이 바뀌었기 때문입니다). 새 날짜 기준으로 정규 슬롯이 모두 지났고 오늘이 `BillingDate` 이하이면 기록 상태에 따라 다음과 같이 처리합니다 `[v1.10: G3 확정]`.
  * `TRACKING`: 늦은 등록 규칙에 따라 `ESCAPE_ALERT`(`LATE_REGISTRATION`)를 즉시 1회 발송합니다.
  * `CANCEL_ATTEMPTED`: 당일 해지 확인 알림(`SAME_DAY_CONFIRM`, `CANCEL_CONFIRM_CHECK`) 규칙을 적용합니다. 당일 확인 마감 시각(글로벌 항목: `SafeEndDate` 당일 20:00 KST, 국내 항목: `SafeEndDate` 당일 21:00 KST) 이전이면 `SAME_DAY_CONFIRM`을 1회 예약·발송하고(국내 항목은 변경일이 `SafeEndDate` 전날이면 당일 기본 발송 시각에, `SafeEndDate` 당일이면 변경 시각 1시간 뒤에 발송), 마감 시각 이후이면 추가 알림 없이 결제 확인 흐름(`BILLING_CHECK`)으로 이어집니다.
  * 중복 발송 방지 키에 `safeEndDate`를 포함하므로(§17) 같은 마감일의 같은 슬롯은 한 번만 나갑니다.
* **알림 수신 거부** `[v1.8 신규]`: 사용자가 알림 수신을 끈 동안에는 알림톡을 보내지 않고 해당 슬롯을 `SKIPPED`로 기록합니다. 상태 전이와 결제 확인 배치는 그대로 진행되며, '내 체험' 화면의 상태 표시와 행동 버튼으로 대신 안내합니다. 수신을 다시 켜면 그 시점 이후의 슬롯부터 발송합니다.
* 모든 알림 링크는 외부 URL이 아니라 `EscapeBridge` 또는 구독컷 내부 화면으로 연결합니다 (`ADR-0001`).

### 7. 해지 브릿지(`EscapeBridge`) 및 1초 이탈 투표(`ExitPoll`) 규칙 (`ADR-0001`)
* `EscapeBridge`는 `EscapePattern`별 우회 안내, `EscapeGuide`(1~3단계), `BackupChecklist`(해당 항목에 있을 때), `ExitPoll`, `EscapeLink`, `BrokenLinkReport` 버튼을 한 화면에 제공합니다. `IMMEDIATE_TERMINATION` 항목은 `BackupChecklist`를 `ExitPoll` 위에 우선 배치합니다.
* **진입 경로**: `ESCAPE_ALERT`·`CANCEL_CONFIRM_CHECK`의 링크와, `TRACKING`·`CANCEL_ATTEMPTED` 기록 상세 화면의 '해지하러 가기' 버튼입니다. `MISSED_BILLED`·`BILLED_CONFIRMED` 기록은 다음 달 결제를 막기 위한 해지가 여전히 필요하므로, 투표와 상태 변화 없이 `EscapeGuide`·`EscapeLink`·`BrokenLinkReport`만 쓰는 안내 모드로 진입합니다 `[확정]`. 그 밖의 종료 상태 기록은 브릿지에 진입할 수 없습니다. `[v1.10: D-09 확정]` `MISSED_BILLED` 기록은 §13 카드의 '다음 달 결제 막기' 버튼으로 안내 모드에 진입합니다.
* **투표와 이동의 단일 명령**: `TRACKING` 기록으로 진입하면 `EscapeLink` 버튼 대신 `ExitReason` 사유 버튼 5개를 표시합니다. 사유 버튼 클릭 한 번으로 Trial Tracking 모듈의 `StartCancelAttempt` 명령이 응답 저장과 `CANCEL_ATTEMPTED` 전이를 하나의 트랜잭션으로 처리하고 이동할 `EscapeLink`를 반환하며, 클라이언트는 즉시 이동합니다. 투표만 하고 이동하지 않은 중간 상태는 존재하지 않습니다.
* **재진입**: `CANCEL_ATTEMPTED` 기록은 투표 단계 없이 `EscapeLink` 버튼을 바로 표시하며, 클릭해도 상태는 바뀌지 않습니다.
* **`EscapePattern`별 동작** `[확정]`:
  * `DIRECT_LINK`: 사유 선택 후 `EscapeLink`(계정 설정 페이지, 앱마켓 정기결제 관리 허브)로 즉시 이동합니다.
  * `SPA_MODAL_GUIDE`: `EscapeLink`는 모달을 여는 직전 화면을 가리키므로, `EscapeGuide`를 사유 버튼 위에 펼친 상태로 고정 표시하고 브릿지로 돌아오면 가이드를 다시 보여 줍니다.
  * `PC_OR_APP_FORCED` `[v1.9: D-15 반영]`: `forcedChannel`에 따라 나뉩니다. `APP`이면 `EscapeLink`(전용 앱 딥링크)로 이동하고, 앱이 설치되어 있지 않으면 `escapeLinkFallbackUrl`로 연결합니다. `PC_WEB`이면 모바일에서 열었을 때 사유 선택 시 `StartCancelAttempt`는 똑같이 실행하되 이동 대신 'PC에서 열어 주세요' 안내와 링크 복사 버튼을 보여 주고, PC에서 열었을 때는 바로 이동합니다.
* `ExitPoll` 응답은 `trialRecordId`, `catalogItemId`, `serviceCategory`(응답 시점 값), `reason`, `respondedAt`으로 저장합니다. `serviceCategory`를 응답 시점에 복사해 두어 이후 카탈로그 분야 변경이 과거 통계를 바꾸지 않게 합니다. 저장 형태는 §19의 `ExitPollResponse`이며, `TrialRecord.exitReason`은 조회 편의를 위한 같은 값의 사본입니다(같은 트랜잭션에서 함께 기록) `[v1.8 수정]`.
* **카탈로그 상세의 `EscapeLink` 비노출** `[v1.8 신규]` `[확정]`: 카탈로그 목록·상세 조회 응답에는 `escapeLink`·`escapeLinkFallbackUrl`을 넣지 않습니다(§19 `CatalogItemPublicView`). 상세 화면은 `EscapePattern`, `DarkPatternLevel`, `EscapeGuide` 단계, `AccessRetentionPolicy`, `BackupChecklist`, `EduBenefit`, `lastVerifiedAt`까지만 보여 주며, 직링크 URL은 `StartCancelAttempt` 결과와 `CANCEL_ATTEMPTED` 재진입·안내 모드에서만 반환합니다. 기록 없이 해지하려는 사용자를 위해 상세 화면에 '이미 가입했어요' 버튼을 두며, 누르면 시작일 확인 화면(기본값 오늘, 과거 날짜로 변경 가능)을 거쳐 기록을 만들고 곧바로 브릿지로 진입합니다. 직링크는 공개 URL이므로 이 규칙은 보안 장치가 아니라 `ExitPoll` 응답률과 추적 누락을 지키기 위한 UX 게이팅입니다.

### 8. 누적 방어 금액(`SavedAmount`) 규칙
* `CANCELED_CONFIRMED` 전이 시각이 `SafeEndDate` 당일 23:59:59 KST 이전인 경우에만, 확정 시점의 `CatalogItem.monthlyPrice`를 `TrialRecord.savedAmount`에 금액으로 저장합니다 `[확정: 당일 포함]`. 사용자의 누적 방어 금액은 `savedAmount` 합계이며, 이후 `monthlyPrice`가 바뀌어도 이미 저장된 금액은 바뀌지 않습니다 `[v1.8 수정]`.
* `MISSED_BILLED`에서 정정되어 확정된 기록과 `KEPT`, `VOIDED`, `BILLED_CONFIRMED` 기록은 합산하지 않습니다.

### 9. 사후 구제: 환불 요청 템플릿(`RefundTemplate`)
* `MISSED_BILLED`·`BILLED_CONFIRMED` 상태의 기록 상세 화면과 결제 확인 알림에서 노출합니다.
* 국문·영문 2종을 제공하며 서비스명(`name`), 체험 시작일(`startDate`), 고객센터 연락처(`supportContact`)를 자동 기입합니다. 실제 결제일, 결제 금액, 사용자 이름은 사용자가 직접 채우는 빈칸으로 둡니다. 글로벌 항목은 `BillingDate`보다 하루 일찍 결제될 수 있으므로(`ADR-0002`) `BillingDate`를 결제일로 자동 기입하지 않고, 빈칸 옆에 '공식 결제 예정일: YYYY-MM-DD'를 참고 정보로만 표시합니다.
* 구독컷은 템플릿을 복사 가능한 텍스트로만 제공하며 발송을 대행하지 않습니다.

### 10. 경로 오류 제보(`BrokenLinkReport`) (`ADR-0005`)
* 제보는 `userId`, `catalogItemId`, 대상(`ESCAPE_LINK` | `ESCAPE_GUIDE`), 제보 시점의 `trialRecordId`, `createdAt`, 처리 상태(`OPEN` | `FIXED` | `REJECTED`)로 저장합니다.
* 동일 사용자·동일 항목·동일 대상의 제보는 24시간 내 1건만 접수합니다 `[확정]`.
* 운영자가 카탈로그를 수정하면 해당 항목의 `OPEN` 제보를 일괄 `FIXED`로 전환할 수 있습니다.

### 11. 제한적 대안 매칭(`AlternativeMatch`)
* 트리거는 `CANCELED_CONFIRMED` 전이뿐입니다. `CANCEL_ATTEMPTED` 단계에서는 노출하지 않습니다.
* 대상 사유는 `SHORT_TERM_GOAL_MET`을 제외한 4종입니다 (용어집 규칙 그대로).
* 후보는 해지한 항목과 같은 `serviceCategory`이면서 `PUBLISHED` 상태인 `SponsoredTrial`이며, 방금 해지한 항목과 사용자가 이미 체험 기록을 가진 항목은 제외합니다.
* **후보 선정** `[제안]`: 후보가 여러 개이면 이 사용자에게 가장 오래전에 노출된(또는 한 번도 노출되지 않은) 항목을 고르고, 동률이면 무작위로 고릅니다. 피처드 슬롯 입찰·가중치는 Out of Scope입니다.
* 빈도 제한은 사용자당 최근 7일 기준 배너 노출 1회입니다. 노출 채널은 앱 내 비침투적 배너뿐이며 카카오톡 알림으로는 발송하지 않습니다. 배너 노출과 클릭은 `FeaturedEvent`(`ALTERNATIVE_MATCH_BANNER`)로 기록합니다.

### 12. 이탈 분석 리포트(`ChurnReport`)
* **대상 항목**: `ownerPartnerId`가 연결된 `CatalogItem`입니다. 피처드 등록 없이 리포트만 구매하는 파트너도 소유 검증을 거쳐 연결된 항목의 리포트를 받습니다.
* **지표 정의**: 금융 무연동 구조상 실제 유료 전환은 관측할 수 없으므로 아래 대리 지표를 씁니다.
  * 유입: 피처드 노출 수, 클릭 수(`FeaturedEvent` 기준, `SponsoredTrial`만 해당), `TrialRecord` 생성 수(경로 A/B 구분).
  * 해지: 해지 시도율(`CANCEL_ATTEMPTED` 도달 비율), 해지 확정률(`CANCELED_CONFIRMED` 비율).
  * 유지·결제: `KEPT` 비율(자발적 유료 전환의 대리 지표), `BILLED_CONFIRMED` 비율(사용자가 확인한 미해지 결제), 응답 없이 남은 `MISSED_BILLED` 비율(미해지 결제 추정).
  * 이탈 사유: `CANCELED_CONFIRMED` 기록의 `ExitReason` 5종 분포와 같은 `serviceCategory` 평균 대비 차이. 해지를 시도했다가 `KEPT` 등으로 끝난 기록의 응답은 '시도 후 잔류 사유'로 따로 집계합니다 `[제안]`.
  * `VOIDED` 기록은 모든 지표에서 제외합니다.
* **피처드 노출 이벤트(`FeaturedEvent`)** `[제안]`: 전용 라운지, 피처드 슬롯, `AlternativeMatch` 배너에서 `SponsoredTrial`이 노출되거나 클릭될 때 `catalogItemId`, `placement`, `type`(`IMPRESSION` | `CLICK`), `userId`, `occurredAt`를 기록합니다. 노출은 같은 사용자·항목·위치 기준 하루 1회로 중복 제거합니다.
* **최소 표본** `[제안]`: `CANCELED_CONFIRMED` 기록의 `ExitPoll` 응답이 30건 미만이면 리포트를 발행하지 않습니다. 분야 평균은 해당 `serviceCategory`에 3개 이상의 `CatalogItem` 데이터가 있을 때만 계산합니다.
* **열람 범위** `[제안]`: `Partner`는 `ownerPartnerId`가 자신인 항목의 리포트만 구매·열람할 수 있습니다. 다른 항목의 데이터는 분야 평균 형태로만 반영되며 개별 항목명이 드러나지 않습니다.
* 리포트에는 개인 식별 정보를 포함하지 않습니다. `[v1.9]` 탈퇴한 사용자의 기록은 삭제되므로(§15, D-08) 집계에 포함되지 않습니다.
* **집계 코호트와 분모** `[v1.8 신규]` `[제안]`: 리포트 기간은 월 단위이며, 결과가 정해진 기록만 세기 위해 `BillingDate`가 그 달에 속하는 기록(`VOIDED` 제외)을 코호트로 삼습니다. 비율 지표의 분모는 코호트 기록 수입니다. 해지 시도율은 `cancelAttemptedAt`이 있는(브릿지를 거쳐 시도한) 기록의 비율, 해지 확정률은 최종 상태가 `CANCELED_CONFIRMED`인 기록의 비율입니다. 유입 지표(노출·클릭·생성 수)는 건수로, 이벤트 발생일·기록 생성일 기준으로 셉니다. 말일 `BillingDate`의 `MISSED_BILLED` 전이까지 반영되도록 리포트는 다음 달 2일 이후에 생성합니다.
* **발급과 전달 방식(MVP)** `[v1.8 신규]` `[제안]`: 파트너 결제·정산은 Out of Scope이므로, 관리자가 오프라인 계약을 확인한 뒤 콘솔에서 `ReportGrant`(파트너·항목·기간)를 만들고, 그 범위 안에서만 리포트를 생성할 수 있습니다. 리포트는 콘솔의 인쇄용 리포트 화면(브라우저의 PDF 저장 사용)과 CSV 내보내기로 만들어 이메일 등으로 전달합니다. 최소 표본 미달이면 생성 버튼을 비활성화하고 사유를 표시합니다. 파트너 로그인과 포털 내 열람은 MVP 이후로 미룹니다.

### 13. 내 체험 목록(대시보드) `[v1.8 신규]`
* **탭**: '진행 중'(`TRACKING`, `CANCEL_ATTEMPTED`, `MISSED_BILLED`)과 '지난 체험'(종료 상태 전부)으로 나눕니다.
* **정렬** `[확정]`: 진행 중 탭은 사용자의 응답이 필요한 `MISSED_BILLED`를 맨 위에, 나머지는 `SafeEndDate` 오름차순으로 둡니다. 지난 체험 탭은 `statusChangedAt` 내림차순입니다.
* **D-Day 표기** `[확정]`: 오늘(KST) < `SafeEndDate`이면 'D-n', 같으면 'D-Day', `SafeEndDate` < 오늘 ≤ `BillingDate`(글로벌 항목의 마지막 하루)이면 '결제 예정일', 그 이후에는 표시하지 않습니다.
* **카드 구성**: 서비스명·로고, 상태 배지, D-Day, 상태별 행동 버튼입니다. 카드를 누르면 기록 상세(수정 포함)로 이동합니다.
  * `TRACKING`: '해지하러 가기'(브릿지), '계속 쓸래요', '가입 안 했어요'.
  * `CANCEL_ATTEMPTED`: '해지 완료했어요', '다시 해지하러 가기', '계속 쓸래요'.
  * `MISSED_BILLED`: 결제 확인 정정 세 가지 선택지, '다음 달 결제 막기'(브릿지 안내 모드) `[v1.10: D-09 확정]`.
  * `BILLED_CONFIRMED`: '다음 달 결제 막기'(브릿지 안내 모드), 환불 요청 템플릿 보기.
  * 그 밖의 종료 상태: 버튼 없음.
* 화면 상단에 누적 방어 금액(`savedAmount` 합계)과 진행 중 건수를 표시합니다.

### 14. 카탈로그 추가 요청(`CatalogRequest`) `[v1.8 신규]`
* 사용자는 카탈로그 검색 결과가 없을 때 서비스명(필수)과 URL(선택)로 추가를 요청합니다. 카탈로그에 없는 서비스를 날짜만으로 직접 추적 등록하는 기능은 두지 않습니다. 해지 경로를 검증하지 않은 항목은 브릿지 안내와 `ExitPoll` 집계를 할 수 없기 때문입니다(Out of Scope).
* 같은 사용자가 같은 서비스명(공백·대소문자 정규화 기준)을 다시 요청하면 기존 요청으로 처리합니다. 콘솔은 정규화된 서비스명별 요청 수를 묶어 보여 줍니다.
* 운영자가 항목을 등록해 요청을 `ADDED`로 처리하면 요청자에게 서비스 내 알림(다음 접속 시 표시)으로 알립니다. 알림톡은 쓰지 않습니다 `[제안]`. 반려할 때는 `REJECTED`와 사유를 남깁니다. `[v1.9]` 이 서비스 내 알림을 저장하고 확인(읽음) 여부를 남길 데이터 모델은 §19에 없습니다 `[결정 필요 D-12]` (P1).

### 15. 회원·알림 수신·탈퇴 (Identity & Account Module) `[v1.8 신규]`
* **로그인** `[확정]`: 카카오 로그인을 기본안으로 합니다. 알림 링크는 카카오톡 인앱 브라우저에서 열리므로, 세션이 없으면 카카오 로그인 한 번으로 원래 화면(브릿지·정정 화면)으로 돌아옵니다. 알림 링크에는 로그인 토큰을 넣지 않고 기록 ID만 넣습니다. 알림톡 수신 번호 확보 방법은 Further Notes §4에서 확정합니다. `[v1.11: D-16]` 발표용으로는 카카오 로그인 때 '카카오톡 메시지 전송'(`talk_message`) 동의를 함께 받습니다. 받은 refresh token은 암호화해 저장하고, 탈퇴하면 삭제합니다.
* **세션** `[확정]`: HttpOnly·Secure·SameSite=Lax 쿠키로 관리하며 만료 기한은 30일입니다.
* **알림 수신 설정**: 가입 시 알림톡 수신 안내와 동의를 받으며 기본값은 켜짐입니다. 설정에서 끌 수 있고, 끌 때 '알림이 없으면 결제 직전 경고를 받지 못해요' 확인 창을 띄웁니다. 수신 거부 중의 동작은 §6을 따릅니다.
* **회원 탈퇴** `[v1.9: D-08 확정]`: 진행 중 기록의 예약 알림을 모두 취소하고, 카카오 계정 ID·전화번호·닉네임 등 식별 정보를 즉시 삭제합니다. 이어서 해당 사용자의 `TrialRecord`, `NotificationSchedule`, `ExitPollResponse`, `FeaturedEvent`, `BrokenLinkReport`, `CatalogRequest`를 모두 삭제하고, 통계용으로 남기지 않습니다. 이미 삭제된 기록은 이후 생성하는 `ChurnReport` 집계에서도 빠지므로, 같은 기간의 리포트를 다시 생성하면 이전 값과 달라질 수 있습니다. `[v1.9: D-14 확정]` 운영자 계정(`OPERATOR`·`ADMIN`)이 탈퇴하면 그 계정이 남긴 `CatalogChangeLog`와 `ReportGrant`도 함께 삭제합니다. 따라서 해당 운영자가 만든 카탈로그 변경은 이력에서 추적하거나 되돌릴 수 없고(§16), 삭제된 발급권 범위의 리포트는 새로 생성할 수 없습니다(§12).
* 운영자 계정도 같은 `User`이며 역할로 구분합니다(§16).

### 16. 운영자 권한과 관리 콘솔 `[v1.8 신규]` `[확정: 역할·접근 제어·변경 이력·최종 검증일]` `[제안: 피처드 슬롯 구성(P1)]`
* **역할**:
  * `USER`: 일반 사용자.
  * `OPERATOR`: 카탈로그 등록·수정, `SponsoredTrial` 대리 제출·검수·게시, 피처드 슬롯 구성, `BrokenLinkReport`·`CatalogRequest` 처리.
  * `ADMIN`: `OPERATOR` 권한에 더해 역할 부여, `Partner`와 소유 연결(`ownerPartnerId`) 관리, `ReportGrant` 발급과 리포트 생성, `DarkPatternLevel` 기준표 변경.
* **접근 제어**: 관리 콘솔은 `/admin` 경로의 별도 화면이며, 서버는 모든 관리 API에서 역할을 검사합니다. 추가로 Cloudflare Access로 콘솔 경로 접근을 운영진 이메일로 제한합니다.
* **변경 이력(`CatalogChangeLog`)**: 카탈로그 항목의 생성·수정·게시 상태 변경마다 변경자, 시각, 바뀐 필드의 이전 값과 새 값, '진행 중 기록에도 적용' 선택 여부를 남깁니다. 이력에서 이전 값으로 되돌리면 그것도 새 변경으로 기록합니다. `[v1.9: D-14]` 탈퇴한 운영자의 이력은 삭제되므로(§15) 이 추적 범위에서 빠집니다.
* **최종 검증일 갱신**: 운영자가 해지 경로를 직접 확인하고 저장하거나 `BrokenLinkReport`를 처리하며 카탈로그를 수정하면 `lastVerifiedAt`을 오늘로 갱신합니다.
* **피처드 슬롯 구성**: 운영자가 `PUBLISHED` 상태의 `SponsoredTrial` 중 피처드 슬롯에 올릴 항목과 순서를 수동으로 지정합니다. 슬롯 수는 설정값이며 기본값은 3개입니다. 전용 라운지는 `PUBLISHED` `SponsoredTrial` 전체를 최근 게시 순으로 보여 줍니다.

### 17. 기술 스택 및 배포 (Cloudflare) `[v1.8 신규]`
MVP는 Cloudflare에 최종 배포합니다. 이 절의 `[제안]` 항목은 구현 에이전트가 임의로 바꾸지 않으며, 바꿀 필요가 있으면 이 문서를 먼저 수정합니다. 확정 전에 구현 기준으로 쓸 수 있는지는 머리말의 `[제안]` 효력 규칙(D-01)을 따릅니다 `[v1.9]`.
* **플랫폼** `[확정]`: 모바일 우선 반응형 웹(PWA 설치 지원)으로 만듭니다. 알림 링크가 카카오톡 인앱 브라우저에서 열리고, 대리 해지 없이 외부 링크로 보내는 구조라 네이티브 앱이 꼭 필요하지 않습니다. 이 문서에서 '앱 내'는 구독컷 웹 화면을 뜻합니다.
* **런타임·언어** `[확정]`: Cloudflare Workers 하나에서 API와 정적 프런트엔드(Workers 정적 자산)를 함께 제공합니다. 언어는 TypeScript이며 §19의 타입을 그대로 씁니다. 프런트엔드는 React + Vite SPA(정적 빌드)입니다 `[v1.10: D-07 확정]`. 근거와 구현 라이브러리 선택은 `docs/adr/ADR-0008-cloudflare-stack-and-frontend.md`에 있습니다.
* **데이터** `[확정]`: 관계형 데이터는 Cloudflare D1, 로고 이미지는 R2에 저장합니다. D1 스키마 변경은 `wrangler` 마이그레이션 파일로만 합니다. 하나의 트랜잭션이 필요한 처리(`StartCancelAttempt`, 확정·정정 시 `ExitPoll` 응답 저장 등)는 D1의 batch(원자적 실행)로 구현합니다.
* **스케줄러** `[확정]`:
  * 알림 예약은 `NotificationSchedule` 행(발송 예정 시각은 UTC)으로 저장하고, Cron Trigger가 10분마다 실행되어 발송 시각이 지난 `PENDING` 행을 처리합니다. Cron 표현식은 UTC 기준이므로 KST 시각을 그대로 쓰지 않습니다.
  * `MISSED_BILLED` 전이 배치는 매일 00:10 KST(= 전날 15:10 UTC)에 `BillingDate`가 오늘(KST)보다 이전인 `TRACKING`·`CANCEL_ATTEMPTED` 기록을 전이하고, 같은 날 기본 발송 시각에 `BILLING_CHECK`를 예약합니다.
* **발송 멱등성** `[확정]`: `NotificationSchedule`은 (`trialRecordId`, `slot`, `safeEndDate`)에 유일 제약을 둡니다. 발송할 때는 `PENDING → SENDING`을 조건부 UPDATE로 선점한 행만 보내고, 성공하면 `SENT`, 실패하면 재시도 횟수를 올려 다시 `PENDING`으로 둡니다. 3회 실패하면 `FAILED`, 슬롯이 의미를 잃은 뒤(예: `BillingDate`가 지난 `ESCAPE_ALERT`)에는 `EXPIRED`로 닫습니다. `SENDING`으로 15분 넘게 남은 행은 `PENDING`으로 되돌리며, 이 경우에 한해 중복 발송 가능성을 허용합니다. `MISSED_BILLED` 전이도 상태 조건부 UPDATE로 처리해 배치가 겹쳐 실행돼도 한 번만 일어나게 합니다.
* **외부 연동** `[확정]`: 카카오 알림톡은 비즈메시지 딜러사의 HTTP API를 Workers에서 호출하고, 템플릿 코드는 알림 종류·문구 분기별 설정값으로 둡니다. 발송은 포트(인터페이스) 뒤에 구현해 테스트 더블로 바꿀 수 있게 합니다.
* **발표용 알림 채널** `[v1.11: D-16 확정]`: 사업자 등록 전까지는 알림톡 대신 카카오 '나에게 보내기' 메시지 API(`talk_message` 동의항목)로 발송합니다.
  * 사용자 본인의 '나와의 채팅'으로 보냅니다. 문구 분기와 알림 링크 규칙(§6)은 알림톡과 같습니다.
  * 발송하려면 사용자별 카카오 토큰이 필요하므로, 로그인 시 받은 refresh token을 애플리케이션 단에서 암호화해 저장합니다(§19 `KakaoMessageToken`). 동의하지 않았거나 토큰이 만료된 사용자의 슬롯은 수신 번호가 없는 경우와 같이 `SKIPPED`로 기록합니다.
  * 검수 전 카카오 앱에서는 앱 팀원 계정만 받을 수 있으므로 발표 시연은 발표자 계정으로 합니다.
  * 같은 `NotificationSender` 포트 뒤에 어댑터로 둡니다. 알림톡 어댑터(T31)는 사업자 등록 뒤에 추가합니다.
* **비밀값과 개인정보**: 알림톡 API 키, 카카오 로그인 Client Secret, 세션 서명 키는 Workers Secrets로 관리하며 저장소에 커밋하지 않습니다. 전화번호는 애플리케이션 단에서 암호화해 저장합니다 `[확정]`.
* **환경** `[확정]`: `dev`(로컬 `wrangler dev`), `staging`, `production` 세 환경을 두고 D1·R2·비밀값을 환경별로 분리합니다. `staging`에서는 알림톡을 실제로 보내지 않고 로그로 대체합니다.
* **시계 주입**: 모든 '현재 시각'은 주입 가능한 시계에서 얻습니다(Testing Decisions와 같음).

### 18. MVP 범위와 우선순위 `[v1.8 신규]` `[확정]`

| 우선순위 | 범위 | 사용자 스토리 |
| :--- | :--- | :--- |
| **P0 (MVP 필수)** | `GuardedService` 탐색·경로 A 등록, 날짜 산정, 상태 머신, 알림 3종, 해지 브릿지·`ExitPoll`, `RefundTemplate`, `SavedAmount`, 내 체험 목록, 기록 수정, `BrokenLinkReport`, 로그인·알림 수신 설정·탈퇴, 운영자 콘솔(카탈로그 등록·권한·변경 이력·버퍼 변경 적용) | 1, 2, 4~8, 10~32, 34, 38~42, 44~48 |
| **P1 (양면 시장)** | `SponsoredTrial` 라운지·피처드 슬롯·경로 B 프롬프트, 파트너 대리 제출·검수, `FeaturedEvent`, `AlternativeMatch`, 카탈로그 추가 요청 | 3, 9, 33, 35, 36, 43, 49 |
| **P2 (B2B 수익화)** | `ChurnReport` 생성과 `ReportGrant` 발급 | 37, 50 |

* P0만 배포해도 `ExitPoll` 응답은 쌓이므로, P2 리포트의 최소 표본을 미리 확보할 수 있습니다.
* 데이터 모델(§19)은 P0 단계부터 `kind`, `publicationStatus`, `ownerPartnerId`를 포함해 만들어, P1·P2 추가 시 핵심 테이블을 바꾸지 않게 합니다.
* P1·P2를 MVP 배포 일정에 넣을지는 사업계획서 일정에 맞춰 확정합니다.
* **발표용 범위** `[v1.11]`: 2026-12-09 발표에는 P0 일부를 간소화·보류한 범위와 B2B 화면 4종의 단순 버전(D-17)을 넣습니다. TASK별 범위는 `docs/implementation-plan.md` §7에 있습니다. 발표용 B2B 화면은 P1·P2 정식 구현(T41~T52)을 대신하지 않습니다.

### 19. 도메인 타입 형태 (v1.5 프로토타입 스니펫 기반, 결정 부분만 발췌, v1.8 갱신)

> `[v1.9]` 아래는 모듈 명령·조회의 입력 타입입니다. `[v1.10: D-06 확정]` HTTP 엔드포인트(경로·메서드)와 오류 응답 규격(상태 코드, 오류 코드 형식, 허용되지 않은 전이·검증 실패의 반환 형태)은 `api/openapi.yaml`에서 정의하며, 이 절은 그 파일을 참조합니다. 또 §16의 피처드 슬롯 구성(항목·순서), 전용 라운지의 '최근 게시 순' 정렬에 필요한 데이터(예: 게시 시각), §14 `CatalogRequest` `ADDED` 시 서비스 내 알림과 확인(읽음) 여부를 담는 타입이 없습니다 `[결정 필요 D-12]` (P1).

```ts
type CatalogItemKind = 'GUARDED_SERVICE' | 'SPONSORED_TRIAL';  // 방어 대상 서비스 vs 제휴 피처드 체험 (v1.5의 CatalogCategory를 개명)
type PublicationStatus = 'SUBMITTED' | 'PUBLISHED' | 'REJECTED' | 'UNPUBLISHED'; // GUARDED_SERVICE는 PUBLISHED로 생성
type ServiceCategory = 'BIGTECH' | 'AI' | 'DELIVERY' | 'OTT' | 'CLOUD' | 'LEARNING' | 'ETC'; // 서비스 분야
type DarkPatternLevel = 'HIGH' | 'MEDIUM' | 'LOW';              // 다크패턴 난이도 (상·중·하)
type EscapePattern = 'DIRECT_LINK' | 'SPA_MODAL_GUIDE' | 'PC_OR_APP_FORCED'; // 해지 경로 유형
type AccessRetentionPolicy = 'RETAIN_UNTIL_END' | 'IMMEDIATE_TERMINATION';   // 갱신 취소형 vs 즉시 종료형
type ExitReason =
  | 'PRICE_BURDEN'          // 가격 부담
  | 'LACK_OF_FEATURES'      // 기능·성능 부족
  | 'COMPLEX_UX'            // 사용성·UI 복잡
  | 'SHORT_TERM_GOAL_MET'   // 단기 목적 달성
  | 'MOVED_TO_ALTERNATIVE'; // 대체 서비스 이동

type TrialStatus =
  | 'TRACKING'           // 추적 중 (초기 생성 상태)
  | 'CANCEL_ATTEMPTED'   // 해지 시도 상태
  | 'CANCELED_CONFIRMED' // 해지 완료 확정 (종료)
  | 'KEPT'               // 유지 결정, 자발적 유료 전환 (종료)
  | 'MISSED_BILLED'      // 결제 추정 (BillingDate 경과, 사용자 정정 가능)
  | 'BILLED_CONFIRMED'   // 결제 확인, 사용자가 결제됨을 확인 (종료)
  | 'VOIDED';            // 등록 무효, 가입 포기·오등록 (종료)

type NotificationKind = 'ESCAPE_ALERT' | 'CANCEL_CONFIRM_CHECK' | 'BILLING_CHECK'; // 탈출 알림 / 해지 확인 알림 / 결제 확인 알림

interface CatalogItem {
  id: string;
  kind: CatalogItemKind;
  name: string;                            // [v1.8] 서비스명
  logoUrl?: string;                        // [v1.8] R2에 올린 로고
  signupUrl?: string;                      // [v1.8] 외부 가입 URL, SPONSORED_TRIAL이면 필수
  publicationStatus: PublicationStatus;
  ownerPartnerId?: string;                 // SPONSORED_TRIAL이면 필수, GUARDED_SERVICE는 소유 검증된 리포트 구매 파트너가 있을 때만
  serviceCategory: ServiceCategory;
  monthlyPrice: number;                    // 원화 정수
  defaultTrialDays: number;
  isGlobalTimeZoneBufferRequired: boolean;
  darkPatternScores: {                     // 기준표 원점수
    menuDepth: 0 | 1 | 2;
    persuasionPopups: 0 | 1 | 2;
    forcedPcOrApp: 0 | 2;
  };
  darkPatternLevel: DarkPatternLevel;      // darkPatternScores 합산으로 시스템이 계산
  escapePattern: EscapePattern;
  forcedChannel?: 'APP' | 'PC_WEB';        // [v1.9: D-15] escapePattern = PC_OR_APP_FORCED이면 필수, 그 밖에는 없음
  escapeGuideSteps: string[];              // 길이 1~3
  escapeLink: string;
  escapeLinkFallbackUrl?: string;          // forcedChannel = 'APP'이면 필수 (D-15)
  accessRetentionPolicy: AccessRetentionPolicy;
  backupChecklist?: string[];
  eduBenefit?: { description: string; url: string };
  supportContact: { email?: string; url?: string };
  lastVerifiedAt: string;                  // [v1.8] YYYY-MM-DD (KST), 운영자 최종 검증일
  publishedAt?: string;                    // [v1.11: D-12 일부] PUBLISHED가 된 시각(UTC), 라운지 '최근 게시 순' 정렬
  featuredOrder?: number;                  // [v1.11: D-12 일부] 피처드 슬롯 순서(1~슬롯 수, 유일), 없으면 슬롯 미노출
}

// [v1.8] 카탈로그 목록·상세 조회 응답: 직링크와 내부 관리 필드는 노출하지 않음 (§7)
// [v1.9: D-11·D-13 정합성] 목록·상세에는 PUBLISHED·UNPUBLISHED 항목만 나오므로(§2),
// publicationStatus를 두 값으로 좁혀 포함한다. 클라이언트는 이 값으로 '게시 중단' 안내와 등록·signupUrl 버튼 차단을 판단한다.
type CatalogItemPublicView = Omit<CatalogItem,
  'escapeLink' | 'escapeLinkFallbackUrl' | 'ownerPartnerId' | 'darkPatternScores' | 'publicationStatus'> & {
  publicationStatus: 'PUBLISHED' | 'UNPUBLISHED';
};

interface TrialRecord {
  id: string;
  userId: string;
  catalogItemId: string;
  source: 'MANUAL_CATALOG_SELECT' | 'SPONSORED_OUTBOUND_PROMPT';
  startDate: string;        // YYYY-MM-DD (KST)
  trialDays: number;
  bufferApplied: boolean;   // [v1.8] 생성 시 CatalogItem.isGlobalTimeZoneBufferRequired 복사 (§4)
  billingDate: string;      // startDate + trialDays
  safeEndDate: string;      // 글로벌이면 billingDate - 1일
  status: TrialStatus;
  exitReason?: ExitReason;  // TRACKING이면 없음, CANCEL_ATTEMPTED·CANCELED_CONFIRMED이면 필수 (기록당 1회)
  cancelAttemptedAt?: string;
  confirmedAt?: string;
  savedAmount: number | null; // [v1.8] 합산된 방어 금액(원) 스냅샷, 미합산이면 null (§8)
  statusChangedAt: string;    // [v1.8] 마지막 상태 변경 시각 (UTC ISO 8601)
}

// 1초 간편 등록 요청 계약 (startDate, trialDays 생략 시 서버가 Auto-fill)
interface CreateTrialRecordCommand {
  userId: string;
  catalogItemId: string;
  startDate?: string; // 미입력 시 오늘(KST)
  trialDays?: number; // 미입력 시 CatalogItem.defaultTrialDays
  source?: 'MANUAL_CATALOG_SELECT' | 'SPONSORED_OUTBOUND_PROMPT'; // 기본값 MANUAL_CATALOG_SELECT
}

// 브릿지의 사유 버튼 클릭: 응답 저장 + CANCEL_ATTEMPTED 전이를 한 트랜잭션으로 처리하고 이동 정보를 반환
interface StartCancelAttemptCommand {
  userId: string;
  trialRecordId: string;
  exitReason: ExitReason;
}
interface StartCancelAttemptResult {
  escapeLink: string;
  escapeLinkFallbackUrl?: string;
  escapePattern: EscapePattern; // 클라이언트가 PC 안내 표시 여부를 결정
  forcedChannel?: 'APP' | 'PC_WEB'; // [v1.10: G2 확정] PC_OR_APP_FORCED일 때 앱/PC 웹 분기 판단용
}

// 해지 완료 확정: 기록에 응답이 없으면(TRACKING에서 확정) exitReason 필수
interface ConfirmCancelCommand {
  userId: string;
  trialRecordId: string;
  exitReason?: ExitReason;
}

// 결제 확인 알림 이후의 정정
interface ResolveMissedBillingCommand {
  userId: string;
  trialRecordId: string;
  resolution: 'BILLED' | 'CANCELED_BEFORE_BILLING' | 'KEEP_USING';
  exitReason?: ExitReason; // CANCELED_BEFORE_BILLING이고 기존 응답이 없으면 필수
}

interface FeaturedEvent {
  catalogItemId: string;
  placement: 'LOUNGE' | 'FEATURED_SLOT' | 'ALTERNATIVE_MATCH_BANNER';
  type: 'IMPRESSION' | 'CLICK';
  userId: string;
  occurredAt: string;
}

// ---------- [v1.8 신규] ----------

// 기록 수정: TRACKING·CANCEL_ATTEMPTED에서만 허용 (§5)
interface UpdateTrialRecordCommand {
  userId: string;
  trialRecordId: string;
  startDate?: string;
  trialDays?: number;
}

// ExitPoll 응답 원본 (§7). TrialRecord.exitReason은 같은 값의 사본
interface ExitPollResponse {
  trialRecordId: string;     // 유일: 기록당 1건
  catalogItemId: string;
  serviceCategory: ServiceCategory; // 응답 시점 스냅샷
  reason: ExitReason;
  respondedAt: string;
}

interface BrokenLinkReport {
  id: string;
  userId: string;
  catalogItemId: string;
  trialRecordId: string;
  target: 'ESCAPE_LINK' | 'ESCAPE_GUIDE';
  status: 'OPEN' | 'FIXED' | 'REJECTED';
  createdAt: string;
  resolvedAt?: string;
}

interface Partner {
  id: string;
  companyName: string;
  contactEmail: string;
  createdAt: string;
}

type UserRole = 'USER' | 'OPERATOR' | 'ADMIN';
interface User {
  id: string;
  kakaoId: string;
  nickname?: string;             // [v1.10: G6 확정] 카카오 프로필 닉네임(선택), 탈퇴 시 삭제(§15)
  phoneNumberEncrypted?: string; // 알림톡 수신 번호 (암호화 저장)
  notificationEnabled: boolean;
  notificationConsentAt?: string;
  role: UserRole;
  createdAt: string;
  // 탈퇴 시 행 삭제, 관련 기록도 모두 삭제 (§15, D-08)
}

type NotificationSlot =
  | 'D3' | 'D1' | 'LATE_REGISTRATION'   // ESCAPE_ALERT
  | 'D1_CONFIRM' | 'SAME_DAY_CONFIRM'   // CANCEL_CONFIRM_CHECK
  | 'BILLING_CHECK';                    // BILLING_CHECK
interface NotificationSchedule {
  id: string;
  trialRecordId: string;
  kind: NotificationKind;
  slot: NotificationSlot;
  safeEndDate: string;      // (trialRecordId, slot, safeEndDate) 유일 제약 (§17)
  sendAt: string;           // UTC ISO 8601
  status: 'PENDING' | 'SENDING' | 'SENT' | 'FAILED' | 'EXPIRED' | 'CANCELED' | 'SKIPPED';
  attempts: number;
  lastAttemptAt?: string;
}

// [v1.11: D-16] 카카오 '나에게 보내기' 발송용 토큰. 사용자당 1건, 탈퇴 시 삭제 (§15)
interface KakaoMessageToken {
  userId: string;
  refreshTokenEncrypted: string;   // 애플리케이션 단 암호화 저장
  refreshTokenExpiresAt: string;   // UTC ISO 8601
  scopes: string[];                // talk_message 포함 여부로 발송 가능 판단
  updatedAt: string;
}

interface CatalogRequest {
  id: string;
  userId: string;
  serviceName: string;
  normalizedName: string;   // 공백·대소문자 정규화, (userId, normalizedName) 유일
  serviceUrl?: string;
  status: 'OPEN' | 'ADDED' | 'REJECTED';
  catalogItemId?: string;   // ADDED일 때 연결
  rejectReason?: string;
  createdAt: string;
}

interface ReportGrant {
  id: string;
  partnerId: string;
  catalogItemId: string;    // ownerPartnerId = partnerId 인 항목만
  periodStart: string;      // YYYY-MM (BillingDate 코호트 월)
  periodEnd: string;
  issuedBy: string;         // ADMIN userId
  issuedAt: string;
}

interface CatalogChangeLog {
  id: string;
  catalogItemId: string;
  changedBy: string;        // OPERATOR·ADMIN userId
  changedAt: string;
  changes: { field: string; before: unknown; after: unknown }[];
  appliedToActiveRecords: boolean; // 버퍼 변경을 진행 중 기록에 적용했는지
}
```

### 20. 스토리별 규칙·검증 추적표 `[v1.9]`
각 스토리가 어떤 규칙(§)과 Testing Decisions 항목으로 완료를 판정하는지 연결합니다. 검증 열의 약어는 Testing Decisions의 모듈입니다(TT: Trial Tracking & Schedule, EB: EscapeBridge & Recovery, BA: B2B Analytics & Matching, CM: Catalog & Marketplace, IA: Identity & Account). **V-nn**은 v1.9에서 추가한 검증 항목입니다.

| 스토리 | 우선순위 | 관련 규칙 | 검증 |
| :--- | :--- | :--- | :--- |
| 1 | P0 | §2 표시 필드, §7 상세 노출 범위 | EB 상세 응답 직링크 비노출, CM `name`·`lastVerifiedAt` 필수, **V-03** |
| 2 | P0 | §2 `serviceCategory` | **V-01** (기존 항목 없음) |
| 3 | P1 | §2 게시 상태, §16 라운지 | CM 게시 상태 전이, **V-02** (D-12 확정 후) |
| 4 | P0 | §2 기준표 | CM 원점수→등급 변환, **V-03** |
| 5 | P0 | §2 `EduBenefit`, §7 상세 | **V-03** (기존 항목 없음) |
| 6 | P0 | §2, §6 문구 분기, §7 상세 | TT `AccessRetentionPolicy`별 문구 분기, **V-03** |
| 7 | P0 | §3, §4 | TT Auto-fill, 입력 검증, **V-08** |
| 8 | P0 | §3 경로 A | TT Auto-fill, HTTP 통합(기본값 주입) |
| 9 | P1 | §3 경로 B | **V-04** (기존 항목 없음) |
| 10 | P0 | §3 등록 무효화, §5 | TT 상태 머신(`TRACKING → VOIDED` 허용, `CANCEL_ATTEMPTED → VOIDED` 불허) |
| 11 | P0 | §4 | TT 날짜 산정 |
| 12 | P0 | §4 | TT 날짜 산정(글로벌/국내, 경계) |
| 13 | P0 | §6 D-3·D-1 | TT 알림 스케줄 |
| 14 | P0 | §6 문구 분기 | TT `AccessRetentionPolicy`별 문구 분기 |
| 15 | P0 | §6 늦은 등록 | TT 늦은 등록 즉시 알림·문구 분기 |
| 16 | P0 | §6 링크 규칙, §7 진입 경로, §15 로그인 | EB 상태별 진입 범위, IA 알림 링크 로그인 후 복귀 |
| 17 | P0 | §7 `EscapePattern`별 동작 | EB `EscapePattern`별 동작 |
| 18 | P0 | §2 1~3단계, §7 | CM `EscapeGuide` 4단계 이상 거부 |
| 19 | P0 | §7 배치 순서 | **V-05** (기존 항목 없음) |
| 20 | P0 | §5 전이표, §7 단일 명령 | TT `ExitPoll` 불변식, EB 사유 1회로 `EscapeLink` 반환 |
| 21 | P0 | §7 | EB 사유 선택 후 `EscapeLink` 반환 |
| 22 | P0 | §5, §7 재진입 | EB 재진입 시 투표 생략 |
| 23 | P0 | §7 진입 경로, §13 버튼 | EB 진입 범위, TT 내 체험 목록 상태별 버튼 |
| 24 | P0 | §2 `forcedChannel`, §7 `PC_OR_APP_FORCED` | EB `forcedChannel`별 동작(앱 대체 URL, PC 웹 모바일 안내), CM `forcedChannel` 필수 검증 |
| 25 | P0 | §5 | TT 상태 머신 |
| 26 | P0 | §6 D-1 교체 | TT `CANCEL_ATTEMPTED` 시 D-1 교체 |
| 27 | P0 | §6 당일 해지 확인 알림 | TT 당일 해지 확인(글로벌 20:00, 국내 10:00/1시간 뒤/21:00 이후 미발송) |
| 28 | P0 | §5 확정 전이 | TT 상태 머신, `ExitPoll` 불변식(응답 없는 확정 거부) |
| 29 | P0 | §5 `KEPT`, §6 알림 취소 | TT 상태 머신, 종료 상태 전이 시 알림 취소 |
| 30 | P0 | §8 | TT `SavedAmount` |
| 31 | P0 | §5 `MISSED_BILLED`, §6 결제 확인, §17 배치 | TT 상태 머신, 발송 멱등성(배치 중복 실행) |
| 32 | P0 | §9 | EB `RefundTemplate` 자동 기입·결제일 빈칸 |
| 33 | P1 | §11 | BA `AlternativeMatch` |
| 34 | P0 | §10 | EB `BrokenLinkReport` 중복 제한·상태 전환 |
| 35 | P1 | §2 게시 흐름 | CM 게시 상태 전이, `ownerPartnerId` 필수 |
| 36 | P1 | §11 | BA `AlternativeMatch` 후보·빈도 제한 |
| 37 | P2 | §12 | BA `ChurnReport` 지표·최소 표본·열람 범위 |
| 38 | P0 | §2 | CM 필수 필드·대체 URL·`ownerPartnerId` 검증 |
| 39 | P0 | §2 기준표 | CM 원점수→등급, 기준표 변경 시 재계산 |
| 40 | P0 | §10, §16 최종 검증일 | EB `BrokenLinkReport` 처리 상태 전환 |
| 41 | P0 | §13 | TT 내 체험 목록(탭·정렬·D-Day·버튼) |
| 42 | P0 | §4, §5 수정 범위, §6 재예약 | TT 기록 수정 |
| 43 | P1 | §14 | CM `CatalogRequest` 중복 처리 |
| 44 | P0 | §6 수신 거부, §15 | TT 알림 수신 거부, **V-07** |
| 45 | P0 | §15 | IA 탈퇴(식별 정보 삭제·알림 취소·관련 기록 전체 삭제), **V-09** |
| 46 | P0 | §7 '이미 가입했어요' | EB '이미 가입했어요' 후 브릿지 진입, **V-08** |
| 47 | P0 | §16 | IA 역할별 관리 API 차단, CM 변경 이력, **V-06** |
| 48 | P0 | §2 반영 규칙, §5 | TT 버퍼 변경 적용 |
| 49 | P1 | §14 | CM `CatalogRequest` `ADDED` 시 요청자 알림 |
| 50 | P2 | §12 발급 | BA `ReportGrant` 범위 밖 생성 거부, 최소 표본 |

---

## Non-functional Requirements `[v1.9]`
본문에 흩어진 비기능 규칙을 모으고, 정해지지 않은 항목을 표시합니다. 이 절은 새 규칙을 만들지 않습니다.

| 분야 | 이 문서에서 정한 규칙 (근거) | 정해지지 않은 사항 |
| :--- | :--- | :--- |
| 보안 | 관리 API 역할 검사와 Cloudflare Access(§16), 세션 쿠키 HttpOnly·Secure·SameSite=Lax·30일(§15 `[확정]`), 비밀값은 Workers Secrets(§17), 알림 링크에 로그인 토큰 미포함(§15) | — |
| 개인정보 | 전화번호 암호화 저장(§17 `[확정]`), 탈퇴 시 식별 정보와 관련 기록 전체 삭제(§15, D-08 확정), 운영자 탈퇴 시 변경 이력·발급권 삭제(§15, D-14 확정), `ChurnReport` 개인 식별 정보 미포함(§12) | 법률 검토(Further Notes §5) |
| 신뢰성 | 알림 발송 멱등성·재시도·`SENDING` 복구(§17), `MISSED_BILLED` 배치 조건부 UPDATE(§17), 상태 전이 단일 진입점(§5), 트랜잭션 처리는 D1 batch(§17) | — |
| 시간 정확성 | 날짜는 KST `YYYY-MM-DD`, 시각은 UTC ISO 8601, 주입 가능한 시계(§4, §17) | — |
| 성능 | 없음 | 목표를 둘지, 둔다면 어떤 지표인지 `[결정 필요 D-04]` |
| 비용 | 비용 발생 요인은 알림톡 발송 건수(비즈메시지 딜러사 과금)와 Cloudflare Workers·D1·R2·Cron 사용량(§17 구성 기준) | 월 예산 상한과 Cloudflare 요금제 `[결정 필요 D-03]` |
| 접근성 | 모바일 우선 반응형 웹(§17) 외 기준 없음 | 적용할 기준 `[결정 필요 D-05]` |
| 환경 | `dev`·`staging`·`production` 분리, `staging`은 알림톡 미발송(§17) | — |

---

## Testing Decisions

* **좋은 테스트의 기준**: 모듈의 공개 인터페이스(명령·조회 API)를 통해 외부에서 관찰 가능한 결과만 검증합니다. 내부 저장 구조나 private 함수는 테스트하지 않습니다. 날짜·시각에 의존하는 모든 로직은 주입 가능한 시계(clock)를 통해 테스트하며, 실제 카카오톡 발송은 발송 포트를 대체한 테스트 더블로 확인합니다.
* **테스트 seam** `[확정]`: 가능한 가장 높은 지점인 각 모듈의 애플리케이션 서비스 계층(명령 핸들러)을 seam으로 삼고, 알림 발송과 시계만 경계에서 교체합니다. HTTP 계층은 Auto-fill 기본값 주입 등 요청 계약 검증에 한해 소수의 통합 테스트로 다룹니다.
* **Trial Tracking & Schedule Module**:
  * Auto-fill: `startDate`·`trialDays` 생략 시 오늘(KST)과 `defaultTrialDays`가 적용되는지.
  * 날짜 산정: 글로벌/국내 항목별 `SafeEndDate`, 월말·연말·윤년 경계.
  * 입력 검증: 미래 `startDate`, 이미 끝난 체험, 중복 진행 중 기록.
  * 상태 머신: 전이표의 모든 허용 전이와 대표적인 불허 전이(예: `KEPT → CANCEL_ATTEMPTED`, `CANCEL_ATTEMPTED → VOIDED`, `BILLED_CONFIRMED`에서의 모든 전이).
  * `ExitPoll` 불변식: `StartCancelAttempt`에서 응답 저장과 전이가 함께 반영되거나 함께 실패하는지, `TRACKING`·`MISSED_BILLED`에서 응답 없이 `CANCELED_CONFIRMED`로 가는 요청 거부, `CANCEL_ATTEMPTED`에서 넘어간 기록의 기존 응답 보존.
  * 알림 스케줄: D-3/D-1 발송 대상, `CANCEL_ATTEMPTED` 시 D-1을 `CANCEL_CONFIRM_CHECK`로 교체, 당일 20:00 해지 확인 알림과 그 이후 시도 기록의 미발송, 늦은 등록 즉시 알림(`BillingDate` 당일 등록 포함)과 세 가지 문구 분기(글로벌·국내 각각), 종료 상태 전이 시 알림 취소, `AccessRetentionPolicy`별 문구 분기.
  * `SavedAmount`: `SafeEndDate` 당일 확정 포함, 다음 날 확정·정정 확정·`BILLED_CONFIRMED` 제외, 합산 후 `monthlyPrice`를 바꿔도 `savedAmount`가 바뀌지 않음.
  * `[v1.8]` 기록 수정: 허용 상태(`TRACKING`·`CANCEL_ATTEMPTED`)와 거부 상태, 수정 후 `BillingDate`가 과거이면 거부, 재계산과 알림 재예약(미래 슬롯 재예약, 정규 슬롯이 모두 지났을 때 즉시 1회). `[v1.10: G3]` 정규 슬롯이 모두 지난 경우 상태별 처리: `TRACKING`은 `LATE_REGISTRATION` 즉시 1회, `CANCEL_ATTEMPTED`는 당일 확인 마감 시각 이전이면 `SAME_DAY_CONFIRM` 1회(글로벌 20:00, 국내는 변경일이 전날이면 당일 10:00·당일이면 1시간 뒤), 마감 시각 이후이면 추가 알림 없음. `CANCEL_ATTEMPTED` 기록에 `ESCAPE_ALERT`가 예약되지 않는지도 확인합니다.
  * `[v1.8]` 버퍼 변경 적용: 적용을 선택하면 `BillingDate`가 지나지 않은 진행 중 기록만 재계산, 선택하지 않으면 기존 기록 불변.
  * `[v1.8]` 국내 항목 당일 해지 확인 알림: 전날 시도 → 당일 10:00, 당일 시도 → 1시간 뒤, 21:00 이후 시도 → 미발송. 글로벌 항목은 20:00 유지.
  * `[v1.8]` 알림 수신 거부: `SKIPPED` 기록과 상태 전이 지속, 다시 켠 뒤에는 이후 슬롯만 발송.
  * `[v1.8]` 발송 멱등성: Cron이 겹쳐 실행되거나 `MISSED_BILLED` 배치가 두 번 돌아도 알림·전이가 한 번만 일어나는지, 00:00~09:00 KST(= 전날 UTC) 구간의 '오늘(KST)' 계산.
  * `[v1.10: G5]` 발송 시각 설정 변경: 기본 발송 시각을 바꾼 뒤 이미 예약된 `PENDING` 행의 `sendAt`은 그대로이고, 변경 이후 새로 만들거나 재예약한 슬롯만 새 시각을 쓰는지.
  * `[v1.8]` 내 체험 목록: 탭 구분, 정렬, D-Day 표기, 상태별 행동 버튼.
* **EscapeBridge & Recovery Module**:
  * `TRACKING` 진입 시 사유 버튼만 표시, 사유 선택 한 번으로 `EscapeLink` 반환, 재진입 시 투표 생략, 상태별 진입 허용 범위와 `MISSED_BILLED`·`BILLED_CONFIRMED` 안내 모드.
  * `EscapePattern`별 동작: `forcedChannel = APP`의 앱 미설치 시 대체 URL 연결, `forcedChannel = PC_WEB`의 모바일 안내와 PC에서의 즉시 이동.
  * `RefundTemplate` 국/영문 변수 자동 기입(`name` 포함), 실제 결제일 빈칸 처리와 공식 결제 예정일 참고 표시.
  * `[v1.8]` 카탈로그 목록·상세 조회 응답에 `escapeLink`·`escapeLinkFallbackUrl`이 없는지, '이미 가입했어요' 경로로 기록 생성 후 브릿지 진입.
  * `BrokenLinkReport` 24시간 중복 제한과 처리 상태 전환.
* **B2B Analytics & Matching Module**:
  * `AlternativeMatch`: `SHORT_TERM_GOAL_MET` 제외, 같은 `serviceCategory`·`PUBLISHED` 한정, 이미 기록이 있는 항목 제외, 후보 선정 순서, 7일 1회 빈도 제한.
  * `ChurnReport`: 지표 계산, `VOIDED` 제외, 최소 표본 미달 시 미발행, 소유하지 않은 항목 열람 차단, 리포트 전용 파트너의 소유 항목 열람.
  * `FeaturedEvent`: 노출 하루 1회 중복 제거.
  * `[v1.8]` `ChurnReport` 코호트(`BillingDate` 월 기준)와 분모, `ReportGrant` 범위 밖 생성 거부, 최소 표본 미달 시 생성 불가.
* **Catalog & Marketplace Module**: `EscapeGuide` 4단계 이상 거부, `DarkPatternLevel` 원점수→등급 변환과 기준표 변경 시 재계산, `PC_OR_APP_FORCED` 항목의 `forcedChannel` 필수·그 밖의 유형에서 비어 있음 검증, `forcedChannel = APP` 항목의 대체 URL 필수 검증 `[v1.9: D-15]`, `[v1.10: G4]` URL 스킴 검증(`signupUrl`·`supportContact.url`·`eduBenefit.url`·`escapeLinkFallbackUrl`·`CatalogRequest.serviceUrl`은 `https:` 외 거부, `escapeLink`의 커스텀 스킴은 `forcedChannel = APP`이고 `catalog.allowedDeepLinkSchemes`에 등록된 경우에만 허용, 기본값 `[]`에서는 거부), `SPONSORED_TRIAL`의 `ownerPartnerId` 필수 검증, 게시 상태 전이(`SUBMITTED → PUBLISHED`·`REJECTED`, `PUBLISHED → UNPUBLISHED`), `[v1.8]` `name`·`lastVerifiedAt` 필수와 `SPONSORED_TRIAL`의 `signupUrl` 필수 검증, 필드별 진행 중 기록 반영 규칙, 변경 이력 기록, `CatalogRequest` 중복 처리와 `ADDED` 시 요청자 알림.
* **Identity & Account Module** `[v1.8 신규]`: 역할별 관리 API 접근 차단, 탈퇴 시 식별 정보 삭제·예약 알림 취소·관련 기록 전체 삭제(삭제 후 해당 기록이 배치·알림 예약·`ChurnReport` 집계에 나타나지 않음) `[v1.9]`, 세션 없이 알림 링크로 들어온 경우 로그인 후 원래 화면 복귀.
* **v1.9 추가 검증 항목** `[v1.9]`: 기존 Testing Decisions에 대응 항목이 없던 스토리를 위한 검증입니다. 모두 본문 규칙을 확인하며 새 규칙을 만들지 않습니다.
  * **V-01** (스토리 2): `serviceCategory`로 조회하면 해당 분야 항목만 반환하는지. 또 목록·검색 결과에 `PUBLISHED`·`UNPUBLISHED` 항목만 포함되고 `SUBMITTED`·`REJECTED` 항목은 제외되는지(D-11).
  * **V-02** (스토리 3, P1): 전용 라운지가 `PUBLISHED` `SponsoredTrial`만 최근 게시 순으로 반환하는지, 피처드 슬롯이 운영자가 지정한 항목·순서와 슬롯 수(기본 3)를 따르는지. `[결정 필요 D-12]` 확정 후 구체화합니다.
  * **V-03** (스토리 1, 4, 5, 6): 카탈로그 상세 응답에 `EscapePattern`, `DarkPatternLevel`, `EscapeGuide` 단계, `AccessRetentionPolicy`, `BackupChecklist`(있을 때), `EduBenefit`(있을 때), `lastVerifiedAt`이 포함되는지.
  * **V-04** (스토리 9, P1): 경로 B 프롬프트로 만든 기록의 `source`가 `SPONSORED_OUTBOUND_PROMPT`이고 Auto-fill 기본값이 적용되는지.
  * **V-05** (스토리 19): `IMMEDIATE_TERMINATION` 항목의 브릿지에서 `BackupChecklist`가 `ExitPoll` 위에 배치되고, `BackupChecklist`가 없는 항목에서는 표시되지 않는지.
  * **V-06** (스토리 47): 변경 이력에서 이전 값으로 되돌리면 새 `CatalogChangeLog`가 생성되는지.
  * **V-08** (스토리 7, 8, 46, D-13): `UNPUBLISHED` 항목은 목록·상세에 '게시 중단' 안내와 함께 표시되고, 경로 A·경로 B·'이미 가입했어요' 어느 경로로도 새 기록이 만들어지지 않으며, `signupUrl` 버튼이 표시되지 않는지. 그 항목의 기존 기록은 알림과 브릿지 안내를 계속 받는지. 목록·상세 응답의 `publicationStatus`가 `PUBLISHED`·`UNPUBLISHED` 중 하나로만 내려가는지.
  * **V-09** (스토리 45, 47, D-14): 운영자 계정이 탈퇴하면 그 계정의 `CatalogChangeLog`·`ReportGrant`가 삭제되고, 삭제된 발급권 범위로는 리포트를 생성할 수 없는지.
  * **V-07** (스토리 44): 알림 수신을 끌 때 확인 창이 표시되고, 확인해야만 `notificationEnabled = false`가 되는지.
* **v1.11 추가 검증 항목** `[v1.11]`:
  * **V-10** (D-16): '나에게 보내기' 어댑터는 발송 전에 만료된 access token을 refresh token으로 갱신합니다. Kakao가 새 refresh token을 주면 암호화해 교체 저장합니다. `talk_message` 동의가 없거나 refresh token이 만료된 사용자의 슬롯은 `SKIPPED`이고, API 오류는 기존 재시도 규칙(§17)을 따릅니다. 카카오 API를 모의한 테스트로 확인하며 실제 발송 테스트는 만들지 않습니다.
* **선행 사례(Prior art)**: 신규 코드베이스이므로 참고할 기존 테스트가 없습니다. 첫 구현 시 Trial Tracking 모듈의 테스트를 이후 모듈의 기준 사례로 삼습니다.

---

## Out of Scope

* 외부 서비스에 대한 대리 해지, 자동 해지 버튼, 해지 API 연동 (`ADR-0001`, 용어집 `EscapeLink` 정의).
* 신용카드·계좌 연동 및 결제 내역 기반 자동 감지 (`ADR-0004`).
* 외부 해지 화면의 봇 크롤링 및 자동 경로 검증 (`ADR-0005`).
* 환불 요청의 대행 발송, 소비자원 신고 대행 (용어집 `RefundTemplate` 정의).
* `@ac.kr` 재학생 인증 자체의 수행. 구독컷은 `EduBenefit` 안내 정보만 제공하고, 인증은 외부 서비스가 수행합니다.
* 가입 시각(시/분) 입력 및 시각 단위 알림 정밀화 (`ADR-0002`).
* 카카오톡 외 알림 채널(앱 푸시, SMS)의 정식 지원. 대체 채널은 Further Notes의 미결 사항으로 남깁니다.
* `Partner` 대상 결제·정산 시스템과 피처드 슬롯 입찰·가격 정책.
* `[v1.8]` 카탈로그에 없는 서비스의 직접 추적 등록. 추가 요청만 지원합니다(§14).
* `[v1.8]` 네이티브 앱(iOS·Android)과 앱 푸시. MVP는 모바일 우선 웹입니다(§17).
* `[v1.8]` 파트너 로그인·셀프서비스 포털과 포털 내 리포트 열람. MVP는 운영자 대리 입력과 파일 전달입니다(§2, §12).
* `[v1.8]` 피처드 슬롯 노출 순서의 자동 최적화. MVP는 운영자가 수동으로 구성합니다(§16).

---

## Further Notes

### 1. 검토가 필요한 `[제안]` 결정 목록
아래 항목은 용어집·ADR에 근거가 없어 개정 과정에서 임의로 정한 값입니다. 확정 또는 수정이 필요합니다. `[v1.9]` 각 항목 앞의 `[P0]`·`[P1]`·`[P2]`는 §18 우선순위 기준의 범위 구분이며, `[P0]` 항목은 구현 착수 전에 확정합니다(D-01). 여러 범위에 걸친 항목은 앞쪽 범위를 기준으로 합니다. **P0 범위 17개 항목은 제안값 그대로 확정했습니다(v1.9).** 아직 `[제안]`으로 남은 것은 P1·P2 범위이며, 해당 기능을 구현하기 전에 확정합니다.
* `[P0]` `[확정]` `serviceCategory`에 `ETC` 추가, 외화 항목의 `monthlyPrice` 원화 환산 방식.
* `[P0]` `[확정]` `DarkPatternLevel` 기준표의 점수 구간과 등급 경계.
* `[P0]` `[확정]` `trialDays` 상한 365일, 진행 중 기록 중복 생성 금지.
* `[P0]` `[확정]` `KEPT`·`VOIDED`·`BILLED_CONFIRMED` 상태 추가, `MISSED_BILLED`의 "결제 추정" 해석과 무응답 기록 처리.
* `[P0]` `[확정]` 알림 3종 분리, 기본 발송 시각(오전 10:00 KST), 당일 해지 확인 알림 시각(20:00 KST), D-1 탈출 알림을 해지 확인 알림으로 교체한다는 ADR-0003 해석.
* `[P0]` `[확정]` `SavedAmount`의 `SafeEndDate` 당일 확정 포함 여부.
* `[P0]` `[확정]` `BrokenLinkReport` 24시간 중복 제한.
* `[P2]` `ChurnReport` 최소 표본(해지 확정 응답 30건, 분야 내 항목 3개), 소유 항목 기준 열람 범위, 시도 후 잔류 사유 별도 집계.
* `[P2]` `ownerPartnerId`로 리포트 전용 파트너를 `GuardedService`에 연결하는 방식. 용어집의 `GuardedService`는 운영자가 구축한 대중적 서비스로 정의되어 있어, 스타트업 제품이 피처드 등록 없이 리포트만 구매하는 경우 어느 종류로 등록할지 별도 결정이 필요합니다. (필드 자체는 §18에 따라 P0 데이터 모델에 포함)
* `[P0]` `[확정: 상태 값]` `SponsoredTrial` 제출·검수 흐름과 `PublicationStatus` 값. (`PublicationStatus` 값은 P0 검색 노출 범위(D-11)에 쓰이므로 P0, 제출·검수 흐름은 P1)
* `[P0]` `[확정]` `EscapePattern`별 브릿지 동작, `MISSED_BILLED`·`BILLED_CONFIRMED` 기록의 브릿지 안내 모드.
* `[P1]` `[v1.11: 확정]` `FeaturedEvent` 노출 중복 제거 기준, `AlternativeMatch` 후보 선정 순서. (발표용 D-17 구현에 제안값 그대로 사용)
* `[P1]` `MOVED_TO_ALTERNATIVE` 사유를 `AlternativeMatch` 대상에 포함하는 것은 용어집 규칙을 따랐지만, 이미 대체 서비스로 이동한 사용자라 매칭 효과가 낮을 수 있어 재검토를 권합니다.
* `[P0]` `[확정]` `[v1.8]` `CatalogItem` 표시 필드와 로고 저장 방식, 카탈로그 변경의 필드별 진행 중 기록 반영 규칙.
* `[P0]` `[확정]` `[v1.8]` 기록 수정 허용 상태, 알림 재예약 규칙, 국내 항목의 당일 해지 확인 알림 시점(전날 시도 10:00, 당일 시도 1시간 뒤, 21:00 이후 미발송).
* `[P0]` `[확정]` `[v1.8]` 카탈로그 상세의 `EscapeLink` 비노출과 '이미 가입했어요' 흐름.
* `[P0]` `[확정: 내 체험 목록]` `[v1.8]` 내 체험 목록의 정렬·D-Day 표기, `CatalogRequest` 처리와 서비스 내 알림. (`CatalogRequest`는 P1)
* `[P0]` `[확정]` `[v1.8]` 카카오 로그인 기본안, 세션 30일. (탈퇴 시 `userId` 무작위 교체 보존안은 D-08 결정으로 폐기)
* `[P0]` `[확정: 역할·Cloudflare Access]` `[v1.8]` 운영자 역할 구분, Cloudflare Access 추가 보호, 피처드 슬롯 수동 구성(기본 3개). (피처드 슬롯은 P1)
* `[P2]` `[v1.8]` `ChurnReport` 월 단위 `BillingDate` 코호트, 분모 정의, `ReportGrant` 기반 발급과 인쇄 화면·CSV 전달.
* `[P0]` `[확정]` `[v1.8]` 기술 스택 전체(§17)와 MVP 우선순위(§18).
* `[P0]` `[확정]` 테스트 seam 위치 (to-spec 절차상 사용자 확인 필요).

### 2. 용어집 동기화 필요 사항
이 spec은 용어집 v1.4에 없는 개념을 사용하거나 일부 정의를 넓혀 씁니다. 용어집을 v1.5로 갱신하고, 아래 결정을 ADR로 기록할 것을 권합니다.
* 신규 용어 후보: 1초 간편 등록(Auto-fill), 원클릭 추적 프롬프트, 해지 확인 알림, 결제 확인 알림, 유지 결정(`KEPT`), 등록 무효(`VOIDED`), 결제 확인(`BILLED_CONFIRMED`), 서비스 분야(`serviceCategory`), 게시 상태(`PublicationStatus`), 피처드 노출 이벤트(`FeaturedEvent`).
* 정의 수정 후보: `EscapeAlert`를 "안전 만료일 도래 전(D-3, D-1)"에서 "공식 결제 예정일 이전의 사전 해지 경고(정규 D-3·D-1, 늦은 등록 즉시 알림)"로 확장. `EscapeBridge`의 진입 경로에 체험 기록 상세 화면 추가. `ExitPoll`을 "사유 선택이 곧 직링크 이동인 단일 클릭"으로 명시. `Partner`와 `CatalogItem`의 소유 관계 추가.
* `ADR-0006` 후보: "1초 간편 등록을 위한 기본값 자동 채움 및 `SponsoredTrial` 외부 이동 시 원클릭 추적 프롬프트 채택".
* `ADR-0007` 후보: "`ExitPoll` 응답과 `CANCEL_ATTEMPTED` 전이의 단일 트랜잭션 처리" (`ADR-0001`·`ADR-0003` 보완).
* `[v1.8]` 신규 용어 후보: 내 체험 목록, 카탈로그 추가 요청(`CatalogRequest`), 리포트 발급권(`ReportGrant`), 최종 검증일(`lastVerifiedAt`).
* `[v1.9]` 신규 용어 후보 추가: 결제 추정(`MISSED_BILLED`), 소유 파트너(`ownerPartnerId`), 게시 중단(`UNPUBLISHED`, 검색 노출·신규 등록 불가, D-13).
* `[v1.8]` `ADR-0008` 후보: "Cloudflare 기반 배포 구조(Workers·D1·Cron Trigger)와 알림 발송 멱등성".
* `[v1.9]` 정의 수정 후보 추가:
  * `ChurnReport`: 용어집은 "1초 이탈 투표 응답과 **전환 지표**를 **카테고리** 평균과 비교"로 정의하지만, 이 SPEC은 실제 유료 전환을 관측할 수 없어 **대리 지표**를 쓰고(§12) 비교 기준을 **서비스 분야(`serviceCategory`)**로 정했습니다. `ExitReason`의 "동일 카테고리"도 서비스 분야로 바꿉니다.
  * `SavedAmount`: 용어집은 "안전 만료일 **이전**에 해지를 확정"으로 정의하지만, §8은 `SafeEndDate` **당일 포함**입니다(`[확정]`).
  * `ExitPoll`: 용어집은 브릿지에서의 응답만 정의하지만, 이 SPEC은 해지 확정 시점(`TRACKING → CANCELED_CONFIRMED`)과 결제 확인 정정 시점의 응답 경로를 추가했습니다(§5).
  * `EscapeBridge`: 체험 기록 상세 외에 카탈로그 상세의 '이미 가입했어요' 진입(§7)과 `MISSED_BILLED`·`BILLED_CONFIRMED`의 안내 모드(§7)가 추가되었습니다.
  * `CancelAttempted` / `ADR-0003`: "D-1에 1회 더"를 D-1 알림 교체로 해석하고(§6 `[확정]`), D-1 이후 시도에 대한 당일 해지 확인 알림을 추가했습니다.
  * `DarkPatternLevel`: 용어집의 상·중·하 등급에 원점수 기준표(§2 `[확정]`)를 추가했습니다.

### 3. 카카오톡 알림톡 제약
알림톡은 정보성 메시지 전용 채널이므로 `ESCAPE_ALERT`, `CANCEL_CONFIRM_CHECK`, `BILLING_CHECK`만 보내고, `AlternativeMatch` 같은 추천·홍보성 내용은 포함하지 않습니다. 알림톡 템플릿은 사전 심사가 필요하므로 세 알림 종류, `AccessRetentionPolicy`별 문구 분기, 늦은 등록 경고 문구까지 템플릿 단위로 준비해야 합니다. 발송 실패 시 대체 채널(SMS 등) 여부는 미결입니다.

### 4. 사용자 식별 및 온보딩 (미결)
`[v1.11]` 발표용으로는 D-16에 따라 전화번호 없이 카카오 계정의 '나에게 보내기'로 발송하므로 이 항목이 발표를 막지 않습니다. 아래 결정은 사업자 등록 후 알림톡을 도입할 때 합니다.
알림톡 발송에는 전화번호 또는 카카오 계정 연결이 필요합니다. v1.8에서 카카오 로그인을 기본안으로 제안했습니다(§15). 남은 결정은 알림톡 수신 번호 확보 방법입니다. 카카오 로그인 동의항목으로 전화번호를 받으려면 비즈 앱 전환과 별도 검수가 필요할 수 있으므로, 그 전까지 가입 직후 전화번호를 직접 입력·인증받는 대안을 함께 검토해야 합니다. 어느 방식이든 1초 간편 등록 전에 거치는 단계는 한 화면 이내로 제한합니다.

### 5. 개인정보 및 데이터 판매
`ChurnReport`는 집계 데이터만 판매하지만, 이용약관과 개인정보 처리방침에 이탈 투표 응답의 제3자 제공(통계 형태) 고지가 필요합니다.
`[v1.9]` 탈퇴 시 관련 기록을 모두 삭제하므로(D-08), 이전 버전의 '`userId` 무작위 교체 보존' 방식에 대한 익명 처리 검토는 필요하지 않습니다. 법령상 보존 의무가 있는 기록이 있는지는 법률 검토에 포함합니다. 전화번호 암호화 저장, 처리 위탁(알림톡 딜러사, Cloudflare) 고지도 처리방침에 포함해야 합니다.

### 6. 위험 요소 `[v1.9]`
이 문서에 이미 적힌 위험을 모은 것입니다. 대응은 문서에 있는 것만 적었습니다.

| ID | 위험 | 영향 | 문서상 대응 |
| :--- | :--- | :--- | :--- |
| R-01 | 알림톡 템플릿 사전 심사 지연·반려 (§3) | P0 핵심인 알림 3종 출시 지연 | 알림 종류·문구 분기별 템플릿 사전 준비. 대체 채널은 미결 |
| R-02 | 알림톡 수신 번호 확보 (§4) | 알림 발송 불가 | 카카오 로그인 동의항목 또는 직접 입력·인증 대안 검토(미결) |
| R-03 | 외부 서비스 UI 개편으로 해지 경로 변경 (`ADR-0005`) | 잘못된 `EscapeLink`·`EscapeGuide` 안내 | `BrokenLinkReport`와 운영자 핫픽스, `lastVerifiedAt` 표시 |
| R-04 | 금융 무연동 구조상 실제 결제 관측 불가 (§5, §12) | `MISSED_BILLED`는 추정치이며 리포트 지표가 대리 지표에 의존 | 결제 확인 정정, 대리 지표 정의 |
| R-05 | `ChurnReport` 최소 표본 미달 (§12) | P2 리포트 판매 지연 | P0 배포 단계부터 `ExitPoll` 응답 축적(§18) |
| R-06 | 데이터 제3자 제공(통계 형태)의 적법성 (§5) | 리포트 판매 방식 변경 가능 | 법률 검토(미정) |
| R-07 | 사용자의 알림 수신 거부 (§6) | 결제 직전 경고 공백 | 끌 때 확인 창, '내 체험' 화면 안내 |

### 7. 사용자 결정 필요 항목 `[v1.9]`
구현 에이전트는 아래 항목을 임의로 정하지 않습니다. 각 항목의 선택지는 검토를 돕기 위한 예시이며 권고가 아닙니다. 결정 시점이 된 항목이 미정이면 해당 작업을 시작하지 않고 보고합니다.

| ID | 결정할 내용 | 관련 위치 | 선택지 예시 | 결정 시점 |
| :--- | :--- | :--- | :--- | :--- |
| D-01 | `[제안]` 항목의 효력 | 머리말, §17, Further Notes §1 | **확정**: (B) P0 범위의 `[제안]`은 구현 전 확정, P1·P2는 해당 기능 착수 전 확정 | 확정 |
| D-02 | MVP 성공 기준 | Goals §2 | **확정**: 알림톡 템플릿 사전 심사 통과. `[v1.11]` 발표용 기준을 따로 둠(Goals §2) | 확정 |
| D-03 | 비용 상한 | NFR 비용 | 알림톡 월 예산, Cloudflare 요금제 | 배포 전 (권장) |
| D-04 | 성능 목표 | NFR 성능 | 목표 없음 / 주요 API 응답 시간 등 지표 지정 | 배포 전 (권장) |
| D-05 | 접근성 기준 | NFR 접근성 | 기준 없음 / 적용할 기준 지정 | 배포 전 (권장) |
| D-06 | HTTP 엔드포인트와 오류 응답 규격 | §19 | **확정** `[v1.10]`: `api/openapi.yaml`에서 정하고 이 문서는 참조 | 확정 |
| D-07 | 프런트엔드 프레임워크 | §17 | **확정** `[v1.10]`: React + Vite SPA, `docs/adr/ADR-0008-cloudflare-stack-and-frontend.md`에 기록 | 확정 |
| D-08 | 탈퇴 사용자의 기록 처리 | §5, §15, §17, §12 | **확정**: 탈퇴 시 해당 사용자의 모든 기록 삭제 | 확정 |
| D-09 | `MISSED_BILLED` 기록의 브릿지 안내 모드 진입 지점 | §7, §13 | **확정** `[v1.10]`: `MISSED_BILLED` 카드에 '다음 달 결제 막기' 추가 | 확정 |
| D-10 | 스토리 번호 정책 | User Stories, §18, §20 | 현재 번호를 고정하고 새 스토리는 끝 번호부터 부여 / 영역별 고정 ID 도입 | 다음 SPEC 개정 전 |
| D-11 | 카탈로그 목록·검색에서 게시 상태별 노출 범위 | §2 | **확정**: `PUBLISHED`·`UNPUBLISHED` 노출, `SUBMITTED`·`REJECTED` 비노출 | 확정 |
| D-12 (P1) | P1 기능의 데이터 모델 보완: 피처드 슬롯 구성, 라운지 정렬 기준 시각, `CatalogRequest` 서비스 내 알림·확인 여부 | §14, §16, §19 | 필드 추가(예: 게시 시각, 알림 확인 시각) / 별도 타입 추가(예: 슬롯 구성, 서비스 내 알림) | `[v1.11]` **일부 확정**: `CatalogItem.publishedAt`·`featuredOrder` 필드 추가(§19). `CatalogRequest` 서비스 내 알림은 P1 착수 전 |
| D-13 | `UNPUBLISHED` 항목의 신규 등록 허용 여부 (D-11에서 파생) | §2, §3 | **확정**: 검색·상세에 '게시 중단' 안내와 함께 표시, 새 기록 생성 불가, `signupUrl` 버튼 비표시 | 확정 |
| D-14 | 운영자 계정 탈퇴 시 `CatalogChangeLog`·`ReportGrant` 처리 (D-08에서 파생) | §15, §16 | **확정**: 함께 삭제 | 확정 |
| D-15 | `PC_OR_APP_FORCED` 항목의 '전용 앱 강제'와 'PC 웹 강제' 구분 기준 (교차 검증 r1에서 발견, P0) | §2, §7, §19 | **확정**: 명시 필드 `forcedChannel: 'APP' \| 'PC_WEB'` 추가 (`PC_OR_APP_FORCED`일 때 필수) | 확정 |
| D-16 `[v1.11]` | 사업자 미등록 상태의 발표용 알림 채널 | §17, §19, FN §4 | **확정**: 카카오 '나에게 보내기' 메시지 API, refresh token 암호화 저장 | 확정 |
| D-17 `[v1.11]` | 발표용 B2B 화면 범위 | §11, §12, §16, §18 | **확정**: 제휴 체험 라운지·피처드 슬롯, 파트너 대리 제출·검수 콘솔, 대안 매칭 배너, 이탈 분석 리포트 4종을 실데이터 단순 집계로 구현. `ReportGrant`·최소 표본·CSV는 적용하지 않음 | 확정 |

기존 미결 사항인 알림톡 수신 번호 확보 방법(§4)과 법률 검토(§5)도 함께 결정해야 합니다.
