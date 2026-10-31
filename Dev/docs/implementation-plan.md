# 구독컷(SubCut) 구현 계획

> 기준: `SPEC.md` v1.11 §18(우선순위), [architecture.md](architecture.md), [tasks.md](tasks.md)
> 작성일: 2026-10-23, 발표용 범위 추가: 2026-10-27 (§7)
> **2026-12-09 발표까지는 §7의 발표용 범위와 일정이 §2~§3보다 우선합니다.**

## 1. 원칙

- **우선순위**: P0(MVP 필수) → P1(양면 시장) → P2(B2B 수익화) 순서로 진행합니다(SPEC §18). P1·P2를 MVP 배포에 넣을지는 아직 정하지 않았습니다.
- **테스트 우선**: 백엔드 TASK는 Testing Decisions 항목을 먼저 실패하는 테스트로 쓰고 구현합니다. Trial Tracking 테스트를 이후 모듈의 기준 사례로 삼습니다(SPEC Testing Decisions "선행 사례").
- **의존 순서**(AGENTS §3):
  - `TrialRecord` 생성은 `CatalogItem`과 `User` 뒤에 만듭니다.
  - `EscapeBridge`는 `StartCancelAttempt` 뒤에 만듭니다.
  - `ChurnReport`·`AlternativeMatch`는 `ExitPollResponse`·`FeaturedEvent` 뒤에 만듭니다.
- **승인 지점**: 아래 작업은 사용자의 명시적 승인을 받은 뒤에만 합니다(AGENTS §6).
  - 스키마 마이그레이션의 원격(staging·production) 적용
  - `wrangler deploy`
  - 비밀값 등록
  - 실제 알림톡 발송
- **착수 차단**: 미결 결정(FN §4, D-12, P1·P2 `[제안]`)에 닿는 TASK는 결정을 받은 뒤에 시작합니다(G1~G6은 2026-10-23 해결 완료).

## 2. 단계와 마일스톤

| 단계 | 내용 | TASK | 완료 조건 (마일스톤) |
| :--- | :--- | :--- | :--- |
| **Phase 0** 결정·계약 | 아키텍처, ADR-0008, API 계약, TASK 분할, SPEC D-06·07·09 반영 | T00 | **M0** 문서 승인 (이번 작업) |
| **Phase 1** 기반 | 스캐폴드, shared kernel, P0 스키마, HTTP 골격 | T01~T04 | **M1** `npm test`·`npm run typecheck`·`npm run lint`가 로컬에서 통과하고, 빈 Worker가 `wrangler dev`로 뜬다 |
| **Phase 2** Identity | 카카오 로그인·세션, 역할, 알림 수신 설정 | T05~T07 | **M2** 로그인과 관리 API 차단 테스트 통과 |
| **Phase 3** Catalog | 검증, 관리 CRUD·이력, 공개 조회, 로고, 기준표 | T08~T12 | **M3** CM 테스트·V-01·V-03·V-06 통과 |
| **Phase 4** Trial Tracking | 등록, 상태 머신, 알림 계획·저장·발송, 배치, 대시보드 | T13~T19 | **M4** TT 테스트 전체 통과 (P0 핵심) |
| **Phase 5** EscapeBridge | 브릿지 조회, 사유 선택, 환불 템플릿, 제보 | T20~T23 | **M5** EB 테스트·V-05·V-08 통과 |
| **Phase 6** 탈퇴 | 모듈 횡단 삭제 | T24 | **M6** IA 탈퇴·V-09 통과 |
| **Phase 7** 프런트엔드 | SPA, 사용자 화면, 관리 콘솔 | T25~T30 | **M7** 로컬에서 S-01~S-05 흐름을 화면으로 수행 가능 |
| **Phase 8** 연동·검증 | 알림톡 어댑터, staging 구성, 시나리오 테스트 | T31~T33 | **M8 (P0 완료)** S-01~S-05 시나리오 테스트 통과, staging 점검 목록 완료 |
| **P1** 양면 시장 | D-12 모델, 파트너·검수, 라운지·슬롯, 경로 B, 이벤트, 대안 매칭, 추가 요청 | T40~T46 | **M9** BA·CM P1 테스트·V-02·V-04 통과 |
| **P2** B2B 수익화 | 발급권, 리포트 집계, 인쇄·CSV | T50~T52 | **M10** BA P2 테스트 통과 |

## 3. 크리티컬 패스

```
T01 → T02 → T03 → T04 → T05 → T06 → T09 ─┐
                   └──────────────→ T08 ──┤
                                    T10 ──┴→ T13 → T14 → T15 → T16 → T17 → T18
                                                     └→ T20 → T21 ─→ T28 → T33
                                                                T19 → T27 ─┘
```

- 가장 긴 경로는 **Trial Tracking(T13~T18)**입니다. 날짜·알림 규칙이 가장 많고 테스트 경계값도 가장 많기 때문입니다.
- 프런트엔드 T25(골격)는 T04 이후 언제든 병행할 수 있습니다. 화면 TASK는 해당 API TASK가 끝난 뒤에 붙입니다.
- **비코드 N1(알림톡 템플릿 심사)**은 MVP 성공 기준(D-02)이고 심사 지연 위험(R-01)이 있습니다. 코드와 무관하게 **지금 바로 시작**합니다. 템플릿 단위는 [architecture.md §5.5](architecture.md#55-알림-문구와-템플릿-코드-6-fn-3) 표를 따릅니다.

## 4. 비코드 병행 작업

| ID | 작업 | 담당(예상) | 필요 시점 |
| :--- | :--- | :--- | :--- |
| N1 | 알림톡 템플릿 문안 작성과 사전 심사 제출 (3종 × 문구 분기). 발표 전에는 문안 작성까지만 합니다(사업자 미등록, D-02 발표용 기준) | 기획 | 발표 자료 전 (문안) |
| N2 | 비즈메시지 딜러사 선정과 API 문서 확보 (보류: 사업자 등록 후) | 기획·개발 | T31 전 |
| N3 | 알림톡 수신 번호 확보 방식 결정 (보류: 사업자 등록 후) | 사용자 결정 | T31 전 |
| N8 | 카카오 개발자 앱 등록: 카카오 로그인 활성화, Web 플랫폼 도메인(로컬·배포) 등록, 동의항목(닉네임, '카카오톡 메시지 전송'), 발표자 계정을 앱 팀원으로 등록 | 운영 | T05 전 (1주차) |
| N4 | 이용약관·개인정보 처리방침, 법률 검토 (FN §5) | 기획 | 배포 전 |
| N5 | 초기 `GuardedService` 해지 경로 직접 검증과 데이터 준비 | 운영 | T30 이후 콘솔로 입력 |
| N6 | D-03(비용 상한)·D-04(성능)·D-05(접근성) 결정 | 사용자 결정 | 배포 전 (권장) |
| N7 | Cloudflare 계정, 도메인, Cloudflare Access(Zero Trust) 준비 | 운영 | T32 전 |

## 5. 결정이 필요한 사항과 막히는 TASK

| ID | 결정 | 막히는 TASK |
| :--- | :--- | :--- |
| ~~G1~~ | ~~AGENTS.md 경로 갱신 승인~~ (**해결됨**, 2026-10-23 반영) | — |
| ~~G2~~ | ~~`StartCancelAttemptResult.forcedChannel` 추가~~ (**해결됨**, 권장안 A 확정) | — |
| ~~G3~~ | ~~`CANCEL_ATTEMPTED` 기록 재예약 시 정규 슬롯이 모두 지났을 때의 처리~~ (**해결됨**, 권장안 A 확정: `SAME_DAY_CONFIRM` 규칙 적용) | — |
| ~~G4~~ | ~~`escapeLink` 딥링크 허용 스킴~~ (**해결됨**, 권장안 A 확정: `https:` + `catalog.allowedDeepLinkSchemes`) | — |
| ~~G5~~ | ~~발송 시각 설정 변경 시 기존 `PENDING` 처리~~ (**해결됨**, 권장안 A 확정: 신규·재예약 슬롯부터 적용) | — |
| ~~G6~~ | ~~`User.nickname` 필드~~ (**해결됨**, 권장안 A 확정: 선택 필드로 추가) | — |
| FN §4 (N3) | 수신 번호 확보 방식 | T31 |
| D-12 | P1 데이터 모델 | T40 이후 P1 전체 |
| P1·P2 `[제안]` | FN §1의 P1·P2 항목 | 해당 기능 착수 전 |

## 6. 위험과 대응 (SPEC FN §6 + 구현 관점)

| 위험 | 대응 |
| :--- | :--- |
| R-01 템플릿 심사 지연 | N1을 즉시 시작합니다. 발송은 포트 뒤에 있으므로 심사 전에도 개발·테스트가 막히지 않습니다 |
| R-02 수신 번호 미확보 | `RecipientResolver` 포트로 분리했습니다. 확보 전에는 `SKIPPED`로 기록하고 '내 체험' 화면으로 안내합니다 |
| 카카오 인앱 브라우저에서 딥링크 fallback·로그인 복귀 동작 차이 | T33에서 실제 기기 수동 점검 목록으로 확인합니다 |
| D1 batch 한도와 버퍼 변경 대상 기록이 많은 경우 | `prepareBufferChange`를 청크 단위로 처리하는 방안을 T16에서 측정합니다. 청크를 나누면 원자성 범위가 바뀌므로, 나눠야 하면 보고합니다 |
| Cron 처리 지연 (10분 간격) | 늦은 등록 즉시 발송은 `waitUntil`로 따로 처리합니다. 대량 발송 시 `LIMIT`와 다음 회차 이월로 대응합니다 |

---

## 7. 발표용 범위와 일정 (2026-12-09 발표)

### 7.1 전제와 결정 (2026-10-27)

- **조건**
  - 1인 개발에 Claude Code와 Google Antigravity를 함께 씁니다.
  - 개발 시간은 주 20시간 기준이며, 필요하면 늘립니다.
  - 개발 기간은 10/27~12/5(약 5.7주), 12/6~12/8은 기능 동결과 리허설입니다.
- **사용자 결정**
  - P0 범위 축소를 승인했습니다.
  - D-16: 알림 채널은 카카오 '나에게 보내기'입니다.
  - D-17: B2B 화면 4종을 실데이터 단순 집계로 만듭니다.
  - D-02: 발표용 성공 기준을 SPEC Goals §2에 따로 두었습니다.
- **발표에서 반드시 보일 것**
  - 실제 카카오톡 알림 수신
  - B2B 화면
  - 핵심 시나리오 S-01~S-05

### 7.2 TASK별 범위

| 구분 | TASK | 발표용 처리 |
| :--- | :--- | :--- |
| **구현** | T01~T05, T07, T08, T10, T13~T15, T17~T22, T25~T28, T33 | tasks.md 완료 기준 그대로. T03에는 `kakao_message_tokens`·`featured_events`·발표용 B2B 컬럼을 포함하고, T05에는 `talk_message` 동의와 토큰 저장을 포함합니다 |
| **신규** | T34 | 카카오 '나에게 보내기' 어댑터 (D-16, V-10) |
| **신규** | T35 | 시드·시연 데이터: `GuardedService` 10개 안팎, 가상 파트너와 `SponsoredTrial` 3~4개, 리포트용 기록·`ExitPoll` 응답 |
| **신규** | T60~T63 | 발표용 B2B 4종 (D-17, §7.4) |
| **간소화** | T06 | `requireRole` 차단과 최초 ADMIN 시드만 만듭니다. 역할 부여 API는 뺍니다 |
| **간소화** | T09 | 생성·수정·게시 상태 변경과 변경 이력 기록만 만듭니다. 되돌리기(V-06)는 뺍니다 |
| **간소화** | T16 | 기록 수정과 재예약만 만듭니다. `prepareBufferChange`(스토리 48)는 뺍니다 |
| **간소화** | T23 | 사용자 제보 접수(24시간 중복 제한)와 관리 목록·상태 변경만 만듭니다. 일괄 FIXED와 `markVerified`는 뺍니다 |
| **간소화** | T30 | 카탈로그 등록·수정 폼, 게시 상태, 제보 목록만 만듭니다. 이력 화면, 역할·설정 화면은 뺍니다 |
| **필수 (환경만 간소화)** | T32 | **Cloudflare 최종 배포는 필수입니다.** staging 없이 production 하나만 두되 D1·Secrets·Cron을 실제로 구성합니다. 1주차에 빈 Worker를 먼저 배포해 계정과 배포 절차를 확인하고, 점검 B 전에 시험 배포, 12/5에 최종 배포합니다. Cloudflare Access는 짧은 시간에 적용되면 쓰고, 안 되면 서버 역할 검사만 씁니다. `wrangler deploy`와 원격 마이그레이션은 매번 사용자 승인 후 실행합니다 |
| **보류** | T11, T12, T24, T29, T31, T40~T52 정식 구현 | 발표 뒤에 진행합니다. T24(탈퇴)는 일반 사용자에게 공개하기 전에 반드시 끝냅니다 |

### 7.3 신규 TASK의 핵심

- **T34 카카오 '나에게 보내기' 어댑터**: 선행 T17, T05
  - `POST https://kapi.kakao.com/v2/api/talk/memo/default/send`로 text 템플릿과 링크 버튼(`/bridge/{id}`, `/trials/{id}`)을 보냅니다.
  - access token은 Identity의 `getKakaoMessageAccessToken`으로 받습니다. 이 함수가 refresh와 교체 저장을 맡습니다.
  - `null`이면 `SKIPPED`, API 오류는 재시도 규칙을 따릅니다.
  - 완료 기준: V-10(모의 `fetch`), 배포 환경에서 발표자 계정으로 늦은 등록 알림이 실제로 오는지 수동 확인
- **T35 시드·시연 데이터**: 선행 T03
  - `migrations/`가 아닌 시드 스크립트로 넣습니다.
  - 가상 파트너와 `SponsoredTrial`은 실존 회사를 사칭하지 않도록 가상 이름을 쓰고, 화면에 '시연용 데이터'로 표시합니다.
  - `GuardedService`의 해지 경로는 직접 확인한 값만 넣습니다(N5).

### 7.4 발표용 B2B 4종 (D-17)

공통 규칙:
- 정식 P1·P2 TASK(T41~T52)를 대신하지 않습니다.
- `ReportGrant`, 최소 표본, CSV는 만들지 않습니다.
- P1 `[제안]`(FN §1) 중 아래에 쓴 값은 발표용으로만 그대로 씁니다.

| TASK | 화면 | 내용 | 선행 | 우선순위 |
| :--- | :--- | :--- | :--- | :--- |
| T60 | 제휴 체험 라운지·피처드 슬롯 | 라운지는 `PUBLISHED` `SponsoredTrial`을 `published_at` 내림차순으로 보여 줍니다. 피처드 슬롯은 `featured_order` 순서로 최대 3개입니다. 노출과 클릭은 `featured_events`에 기록하고, 노출은 하루 1회로 중복 제거합니다 | T10, T35 | 필수 |
| T61 | 파트너 대리 제출·검수 콘솔 | T30 폼을 `kind = SPONSORED_TRIAL`로 재사용합니다(`ownerPartnerId`·`signupUrl` 필수, `SUBMITTED → PUBLISHED/REJECTED`). 파트너 목록·등록은 최소 폼으로 만듭니다 | T30 | 필수 |
| T62 | 대안 매칭 배너 | `CANCELED_CONFIRMED` 직후에만 보이고 `SHORT_TERM_GOAL_MET`은 제외합니다. 같은 `serviceCategory`의 `PUBLISHED` `SponsoredTrial` 중에서 고르되, 방금 해지한 항목과 이미 기록이 있는 항목은 뺍니다. 가장 오래전에 노출된 항목부터 고르고, 사용자당 7일 1회만 보입니다. 앱 안 배너로만 보여 주며 카카오톡으로는 보내지 않습니다 | T14, T60 | 지연 시 가장 먼저 축소 |
| T63 | 이탈 분석 리포트 | 항목·월을 고르면 다음을 보여 줍니다: `ExitReason` 분포, 해지 시도율·확정률, `KEPT`·`BILLED_CONFIRMED`·`MISSED_BILLED` 비율, 같은 분야 평균, 피처드 노출·클릭 수. TT 공개 조회의 집계값만 쓰고 `VOIDED`와 개인 식별 정보는 넣지 않습니다. 발표 중에 투표하면 다시 조회했을 때 결과에 반영됩니다 | T14, T60 | 필수 |

### 7.5 주차별 일정

예상 시간은 사람이 지시·검토·수정하는 시간의 추정치이며, 총 약 135~140시간(주 약 24시간)입니다. 주 20시간만 쓰면 T62와 간소화 항목부터 줄입니다(§7.6).

스킬 열은 TASK별로 쓸 프로젝트 Skill을 정리한 것입니다(`Dev/.agents/skills/`에 설치된 Skill, AGENTS §5).
- **공통**: 서버 TASK는 `tdd`로 구현하고, 모든 TASK는 끝낼 때 `verification-before-completion`과 `code-review`를 씁니다. 테스트가 실패하거나 버그가 나오면 `systematic-debugging`을 씁니다. 공개 인터페이스·`openapi.yaml` 변경처럼 사전 승인이 필요한 TASK는 `writing-plans`로 계획을 씁니다.
- **열에 적힌 것은 TASK 특화 Skill입니다.** 라이브러리·외부 API 문서(Hono, zod, TanStack Query, 카카오 메시지 API)는 Skill 대신 `context7`로 조회합니다.
- **설치가 필요한 Skill**: `wrangler`(`cloudflare/skills@wrangler`, 11/17 주 시험 배포 전), `agent-browser`(스킬은 2026-10-31 `vercel-labs/agent-browser`, Apache-2.0에서 재설치 완료. 스킬은 사용 안내일 뿐이라 브라우저를 조종하는 프로그램(CLI)은 쓰기 전에 따로 설치해야 하며, 11/24 주 전에 프로젝트 의존성 또는 `npx` 중 방식을 정합니다). 설치는 사용자 승인 후 AGENTS §5 절차로 합니다.

| 기간 | Claude Code (`src/worker`, `tests`, `migrations`, `api`, `src/shared`) | Antigravity (`src/web`) | 비코드 | 점검 | 스킬 |
| :--- | :--- | :--- | :--- | :--- | :--- |
| 10/27~11/2 | T01~T04, 빈 Worker 첫 배포(T32 일부) | — | N7 Cloudflare 계정, N8 카카오 앱 등록, 현재 문서 커밋 | M1, workers.dev 접속 확인 | 공통만 |
| 11/3~11/9 | T05·T06·T07, T08, T09(간소), T10 | T25 | N5 해지 경로 검증 시작 | M2·M3 | 서버: `workers-best-practices`(T05~T10), T07 `codebase-design`·`writing-plans`(포트·`openapi.yaml` 변경 계획), T08 `domain-modeling`<br>화면: T25 `frontend-design`, `vercel-react-best-practices` |
| 11/10~11/16 | **T13~T15** | T26 | | **점검 A**: T15 테스트 통과 | 서버: T13~T15 `codebase-design`, T14 `workers-best-practices`(D1 `batch`)<br>화면: T26 `frontend-design`, `design-taste-frontend`, `vercel-react-best-practices` |
| 11/17~11/23 | T16(간소), T17, **T34**, T18, T19 | T27 | 시험 배포 1회 | **점검 B**: 실제 카카오톡 수신 확인 | 서버: T17·T18 `workers-best-practices`(Cron·`scheduled`), T34 `context7`(카카오 메시지 API), 시험 배포 `wrangler`(설치 필요)<br>화면: T27 `frontend-design`, `vercel-react-best-practices` |
| 11/24~11/30 | T20~T23 | T28, T30(간소)·T61 | N5 데이터 입력 | **점검 C**: T62 범위 결정 | 서버: T20~T23 `codebase-design`(EscapeBridge 모듈 경계)<br>화면: T28·T30·T61 `frontend-design`, `design-taste-frontend`, 브라우저 점검 `agent-browser`(CLI 설치 필요) |
| 12/1~12/5 | T35, T60·T62·T63 서버, T33, **Cloudflare 최종 배포** | T60·T62·T63 화면 | N1 문안 | 기능 동결·최종 배포(12/5) | 서버: T35 전용 Skill 없음, T33 `agent-browser`(CLI 설치 필요), 최종 배포 `wrangler`<br>화면: T60·T62·T63 `frontend-design`, `design-taste-frontend` |
| 12/6~12/8 | 버그 수정만 | 버그 수정만 | 리허설, 시연 영상 백업, 발표 자료 | | `systematic-debugging`, `verification-before-completion` |

### 7.6 지연 시 줄이는 순서

점검 A·B·C에서 일정이 밀렸으면 아래 순서로 줄입니다.

1. T62는 조건 필터만 남기고 후보 선정 순서와 7일 빈도 제한을 뺍니다.
2. T23 제보 기능은 버튼과 접수만 남깁니다.
3. T30·T61 관리 콘솔은 T35 시드 스크립트로 대신합니다. 시연에서는 미리 넣은 데이터를 씁니다.
4. T16 기록 수정을 보류합니다. S-05는 시연에서 뺍니다.

다음 TASK는 줄이지 않습니다: T13~T15, T17, T34, T20·T21, T63, T32(Cloudflare 배포).

### 7.7 두 에이전트 병행 규칙

- 위 표처럼 디렉터리로 담당을 나눕니다.
  - `api/openapi.yaml`과 `src/shared`는 Claude Code만 고칩니다.
  - Antigravity는 생성된 타입을 읽기만 합니다.
- 두 에이전트가 같은 TASK를 동시에 맡지 않습니다. 화면 TASK는 해당 API TASK가 끝나고 커밋된 뒤에 시작합니다.
- TASK가 하나 끝날 때마다 사용자가 직접 커밋해 되돌릴 지점을 남깁니다. 에이전트는 커밋하지 않습니다(AGENTS §6).

### 7.8 발표용 범위의 위험

| 위험 | 대응 |
| :--- | :--- |
| 검수 전 카카오 앱은 앱 팀원 계정만 `talk_message` 동의·수신이 가능할 수 있습니다 | 발표자 계정을 팀원으로 등록하고, 점검 B에서 실제 수신을 확인합니다 |
| 발표장 네트워크나 Cron 10분 지연 | 늦은 등록(S-02)은 즉시 발송 경로를 쓰므로 시연에 활용합니다. 실패에 대비해 시연 영상을 미리 녹화합니다 |
| 탈퇴(T24) 보류로 저장된 토큰을 지울 방법이 없음 | 발표 전에는 팀원 계정만 씁니다. 일반 공개 전에 T24를 끝냅니다 |
| 발표용 B2B 데이터 대부분이 시드 데이터 | 화면에 '시연용 데이터'로 표시합니다 |
