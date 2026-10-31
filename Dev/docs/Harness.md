# 하네스 엔지니어링 통합본

AI 에이전트 기반 개발 워크플로우 및 하네스 엔지니어링 통합 가이드

> 💡 **문서 개요**
> 본 가이드는 Google Antigravity, Claude Code, OpenAI Codex 세 에이전트와 멀티 모델(Gemini, Claude, OpenAI)을 함께 활용하는 해커톤(24~48시간·6시간 현장)·일반 프로젝트 단계별 워크플로우와, 에이전트가 안정적으로 코드를 구현·검증할 수 있도록 돕는 하네스 엔지니어링(Harness Engineering) 구축 지침을 하나로 통합한 매뉴얼입니다. 팀 협업과 개인 프로젝트 모두에 같은 구조를 적용합니다.
>
> - 기준일: 2026-10-21 (모델 가용성, 도구 경로, 기능 지원 여부는 이 날짜 기준이며 변경될 수 있습니다. 실제 모델명·요금제는 부록 A)
> - Skills 기준일: 2026-10-31 (단계별 Skills 매핑은 PART 1 §4에서만 관리. 기획 1~3단계는 Claude·Gemini 데스크톱 앱, 4단계부터는 AI 에이전트에서 진행)
> - 하네스 원칙 검토일: 2026-10-28 (OpenAI·Anthropic 공식 사례, martinfowler.com, ICLR 2026 연구, Skills 보안 감사 보고서와 대조. 근거는 문서 끝 「참고한 공식 자료」)
> - 협업·검증 규칙 검토일: 2026-10-29 (사람별 기능 담당, 브랜치·병합 규칙, 실행 결과 중심 완료 판정, Antigravity 제품별 경로)
> - 변경 이력: 문서 맨 끝의 「문서 변경 이력」 참고

## 빠른 시작: 처음 적용할 때의 최소 구성

이 문서 전체를 한 번에 구축하지 않습니다. 첫 프로젝트에서는 작은 기능 하나로 운영 방식을 검증하고, 반복해서 생긴 문제만 규칙·테스트·스킬로 보완합니다(PART 3 §7-2, §8).

1. `SPEC.md`에 핵심 기능 2~3개와 완료 조건을 쓴다.
2. 사람별 기능 담당자와 공통 파일 담당자를 정한다(PART 1 §0-1).
3. 모든 팀원의 컴퓨터에서 설치·실행·`verify`가 되는지 확인한다(PART 3 §2).
4. 각자 작은 기능 하나를 기능 브랜치에서 구현하고 바로 합친다(PART 1 §3 ⑧).
5. 반복해서 발생한 문제만 규칙·테스트·스킬로 보완한다.

처음부터 필요한 문서는 `SPEC.md`, 짧은 `AGENTS.md`(+ `@AGENTS.md` 한 줄짜리 `CLAUDE.md`), `README.md`, 진행 기록(`docs/progress.md`, 1-B는 `SPEC.md` 5절)뿐입니다. 나머지 문서·스킬·CI·Evals는 필요가 확인될 때 추가합니다.

| 상황 | 먼저 읽을 부분 |
| --- | --- |
| 6시간 현장 해커톤 | PART 1 §0-1, §1-B, §3 ⑧ |
| 24~48시간 해커톤 | PART 1 §0, §1-A, §3 |
| 캡스톤·일반 프로젝트 | PART 1 §2·§3 → PART 2 → PART 3·4 |
| 모델·요금제·추론 설정값 확인 | 부록 A |

---

# PART 1. 프로젝트 유형별 개발 워크플로우 및 운영 규칙

## 0. 역할 분담과 모델 등급

역할은 **사람 → 기능**을 먼저 정하고, **에이전트 → 도구**는 그다음에 고릅니다. 협업 충돌은 어떤 AI를 썼느냐가 아니라 여러 사람이 같은 파일과 계약을 동시에 바꿀 때 생기므로, 책임 단위는 사람과 기능입니다.

### 0-1. 사람별 기능 담당 (가장 먼저 정함)

- **기능 단위 수직 분할이 기본값입니다.** 팀원 각자가 사용자 기능 하나를 화면 → API → DB까지 끝까지 책임집니다. 모두 풀스택으로 개발해도 되며, 프런트엔드/백엔드 분할은 숙련 분야가 뚜렷하게 다를 때만 선택합니다.
- **공통 기반은 담당자를 한 명 정합니다.** 대상: API 계약(`SPEC.md` §6 또는 `api/openapi.yaml`), 공통 타입, 라우팅, 패키지·의존성 설정과 잠금 파일, DB 마이그레이션, 환경 변수 목록, 배포 설정.
- **병합 담당자를 정합니다.** 충돌 해결과 "`main`은 항상 `verify`를 통과한다"는 상태를 책임집니다. 공통 기반 담당자가 겸해도 됩니다.
- **에이전트는 담당자가 고릅니다.** §0-2의 에이전트별 역할은 권장 기본값입니다. 각자 자기 환경에서 구현하고, 상대방(사람)과 다른 계열 모델이 변경 위험에 맞게 검토합니다(§3 ①).
- **기록 위치:** 1-A·2 워크플로우는 `docs/03-plan.md`의 담당 표, 1-B는 `SPEC.md` 5절. 인원 수와 역할은 프로젝트마다 정합니다(§3 ⑥).
- 협업 운영 규칙(브랜치, 공통 파일, API 변경, 병합 주기)은 §3 ⑧을 따릅니다.

담당 표 예시 (추천 서비스, 2인 기준):

| 담당 | 책임 기능 | 작업 범위 |
| --- | --- | --- |
| 팀원 A | FR-001 검색하고 추천 결과 보기 | 검색 화면 → 추천 API → 결과 표시 |
| 팀원 B | FR-002 결과 저장하고 다시 보기 | 저장 버튼 → 저장 API·DB → 목록 화면 |
| 팀원 A | 공통 기반 | API 계약, 공통 타입, DB 마이그레이션, 의존성·배포 설정 |
| 팀원 B | 병합 | 기능 브랜치 병합, 충돌 해결 |

기능 단위로 나누면 각자 "사용자가 실제로 쓸 수 있는 기능 하나"를 완성해 설명할 수 있어 개인 기여도 분명해집니다. 개인 프로젝트는 본인이 모든 담당을 맡되, 여러 에이전트를 동시에 돌릴 때는 §3 ⑧의 브랜치·worktree 규칙을 그대로 적용합니다.

### 0-2. 에이전트별 기본 역할 (권장값)

| 에이전트 | 기본 역할 | 주로 쓰는 모델 |
| --- | --- | --- |
| Claude·Gemini 데스크톱 앱 | 기획 1~3단계: 아이디어 브레인스토밍(`/brainstorming`), 아이디어 구체화(`/grill-with-docs`), 요구사항 명세서 작성(`/to-spec`) | Gemini T1·T2·T3, Claude T1 |
| Google Antigravity | 구현 계획·작업 분해(Planning 모드), 리서치, 발표 문서 초안, 브라우저 기반 UI 확인 | Gemini T1·T2·T3 |
| Claude Code | 구현 계획·작업 분해(Plan 모드), 핵심 구현, 통합·버그 수정, 배포 | Claude T1·T2 |
| OpenAI Codex | 교차 코드 리뷰, 독립 모듈 병렬 구현(선택), 문서 교차 검증 | OpenAI T1·T2 (반복 작업은 T3) |

- 이 표는 기본값입니다. 기능 담당자가 다른 에이전트로 구현해도 되며, 사용한 에이전트와 실제 모델명은 `docs/progress.md` 세션 로그와 리뷰 파일에 남깁니다.
- **"다른 계열" 정의:** 교차 검증에서 "다른 계열 모델"은 작성한 모델과 다른 회사의 모델을 뜻합니다(Gemini / Claude / OpenAI 중 작성 모델이 아닌 것).

### 0-3. 모델 등급과 추론 수준

모델 이름과 추론 단계 명칭은 자주 바뀌므로, 본문과 워크플로우 표에는 **모델 계열 + 등급(T1·T2·T3) + 공통 추론 수준(Low·Medium·High)** 만 적습니다. 실제 모델명, 요금제 조건, 도구별 설정값은 **부록 A**에서만 관리하고, 모델이 바뀌면 부록 A만 고칩니다.

| 등급 | 용도 |
| --- | --- |
| T1 · 상위 추론 | 설계, 복잡한 버그, 중요 리뷰 |
| T2 · 표준 | 일반 구현, 테스트 작성, 일반 리뷰 |
| T3 · 경량 | 아이디어 초안, 단순·반복 작업 |

추론 수준 운용 원칙:

- 등급별 권장 기본값(부록 A-3 ②)으로 시작하고, 결과가 부족할 때만 한 단계씩 올립니다. 수준을 높이면 시간과 사용량이 함께 늘어납니다.
- 예외 상향(공통 High 초과)은 High로 2회 이상 실패했거나, 아키텍처 결정·대규모 코드 리뷰처럼 판단 비중이 큰 작업에서만 쓰고 사유를 리뷰 파일에 기록합니다.
- 추론 수준은 세션을 시작할 때 정하고 세션 중에는 바꾸지 않습니다. Claude Code의 추론 수준은 모델별로 저장되며, 세션 중 변경은 프롬프트 캐시를 무효화할 수 있습니다. 결과가 부족하면 수준을 올리는 대신 T1 모델로 전환합니다.

### 0-4. 모델 대체 규칙

- Gemini T1을 쓸 수 없으면 Claude T1로 대체합니다.
- Codex T1을 쓸 수 없으면 Codex T2를 High로 사용합니다. T2도 쓸 수 없으면 검증은 작성 모델과 다른 계열의 T1이 맡습니다.
- Claude Code를 쓸 수 없는 팀원은 Antigravity에서 제공하는 Claude 모델을 사용합니다(Gemini와 별도 한도).
- 대체 결과 작성 모델과 검증 모델이 같은 계열이 되면, 남은 다른 계열 모델이 검증합니다.
- 프로젝트 시작 시 각 팀원의 요금제와 사용 가능 모델(부록 A-2로 확인)을 `docs/00-brainstorm.md` 상단 또는 `README.md`(1-B는 `SPEC.md` 상단)에 기록합니다.

## 1-A. 해커톤 워크플로우 (24~48시간)

- 해커톤에서는 빠른 의사결정과 데모 구현이 핵심입니다. 교차 검증은 2·3·6단계의 필수 3회를 기본으로 하고, 전체 최대 6회를 넘기지 않습니다. 표의 횟수는 상한이며 실제 리뷰 강도는 변경 위험(§3 ①)을 우선합니다.
- **필수 문서는 `SPEC.md`, `AGENTS.md`, `CLAUDE.md`, `README.md`, `docs/03-plan.md`, `docs/progress.md`뿐입니다.** 기능 목록·데모 시나리오·API 계약은 별도 파일을 만들지 않고 `SPEC.md`에 바로 씁니다. 나머지는 스킬이 자동으로 만들거나 선택 문서이며, 각 `.md`는 한 화면 안에 들어오는 분량이면 충분합니다.
- 표의 슬래시 명령(`/grill-with-docs` 등)은 모두 Skills입니다. 1~3단계(기획) 스킬은 Claude·Gemini 데스크톱 앱에 등록해 쓰고, 4단계부터의 스킬은 세 에이전트에서 호출하려면 프로젝트 폴더의 `.agents/skills/`(원본)와 `.claude/skills/`(원본을 가리키는 링크)에 모두 보여야 합니다(§4-3 ⑦, PART 3 §4).
- 3단계가 끝나면 기획 문서를 프로젝트 폴더로 옮기고, `SPEC.md` 기준으로 필요한 프로젝트 스킬을 설치한 뒤 4단계를 시작합니다(§4-3 ⑦).
- 스킬별 출처·적용 조건은 §4에서 관리합니다. `†`는 추가 설치가 필요한 스킬, **조건부**는 기술 스택이 맞을 때만 쓰는 스킬(React·Next.js → `vercel-react-best-practices`, Postgres → `supabase-postgres-best-practices`, 랜딩·소개 페이지 → `design-taste-frontend`, Vercel 배포 → `/deploy-to-vercel`)입니다.
- mattpocock/skills를 쓰므로 4단계 전에 프로젝트 폴더에서 `/setup-matt-pocock-skills`†를 한 번 실행합니다(§4-3 ①).

| 단계 (명령/스킬) | 업무 | 주 담당 모델 · 환경 | 추론 수준 | 교차 검증 (횟수) | 결과물 |
| --- | --- | --- | --- | --- | --- |
| 1 (`/brainstorming`) | 주제·심사기준 분석 및 아이디어 브레인스토밍 | Gemini T2 · Gemini 데스크톱 | High | 생략 (0회) | `docs/00-brainstorm.md` (아이디어 후보, 심사기준별 점수표, 팀원별 사용 가능 모델) |
| 2 (`/grill-with-docs`, 필요 시 `/research`) | 아이디어 확정 및 MVP 범위 정의 | Gemini T1 · Gemini 데스크톱 + 팀원 (불가 시 Claude T1 · Claude 데스크톱) | High | 필수 1회, Claude T1 Medium (대체 시 Codex T1) | `docs/01-mvp-scope.md` (문제 정의, 필수/제외 기능, 성공 기준), `docs/02-glossary.md`·`docs/adr/` (`/grill-with-docs` 결과를 옮겨 작성), `docs/reviews/02-review-r1.md` |
| 3 (`/to-spec`) | 기능 요구사항·데모 시나리오를 `SPEC.md`로 확정 | 작성: Gemini T1 · Gemini 데스크톱 / 검증: Claude T1 | Medium | 필수 1회 (최대 2회), Claude T1 | `SPEC.md` (기능 요구사항·완료 조건, 데모 클릭 순서·보여줄 화면 포함) |
| 4 (Plan 모드 + `/to-tickets`†) | 기획 문서 인계·프로젝트 Skills 설치(§4-3 ⑦), 사람별 기능 담당·공통 파일 담당·병합 담당 지정, 구현 계획 및 Task 분할 | Claude T1 · Claude Code (Plan 모드) 또는 Antigravity (Planning 모드) + 팀원 | High | 사용자 승인 필수 (승인 1회, 재승인 최대 1회) | `docs/03-plan.md` (담당 표, Task 목록), `docs/progress.md` (§3 ⑦), `SPEC.md` §6 API 계약(엔드포인트, 요청·응답 형식), `AGENTS.md` (공통 규칙), `CLAUDE.md` (`@AGENTS.md` import) |
| 5 (`verification-before-completion`, 선택 `/implement`†, 조건부 스택 스킬) | 기능 담당자별 병렬 개발(화면 → API → DB), 첫 기능부터 작게 병합 (§3 ⑧) | 담당자가 선택. 권장: Claude T2 · Claude Code / 단순 작업: Gemini T3 · Antigravity / 독립 모듈: Codex T2 | Claude T2 Medium / Gemini T3 Low / Codex T2 Medium | 생략 (0회), `verify`와 실제 동작 확인으로 대체 | 소스 코드, 핵심 로직 최소 테스트, `.env.example`, `README.md` (실행 방법) |
| 6 (`/diagnosing-bugs`†, 검증 시 `/code-review`, `agent-browser`) | 통합 및 버그 수정 | Claude T2 · Claude Code (막히면 Claude T1) | T2 Medium / T1 High | 데모 핵심 경로만 필수, Codex T1 Medium (1회, 치명적 버그 시 최대 2회) | `docs/bugs.md` (선택, 이슈 트래커를 쓰면 생략), `docs/reviews/06-review-r1.md` |
| 7 (조건부 `/deploy-to-vercel`, `agent-browser`) | 배포 및 데모 리허설 | Claude T2 · Claude Code | Low | 생략, 스모크 테스트로 대체 (0회) | 배포 URL, `README.md` 배포 절, 데모 백업 영상 (배포 장애 대비) |
| 8 (`/pptx`) | 발표 자료 및 피치 스토리 | 초안: Gemini T3 / 검토: Gemini T1 · Antigravity | Low → Medium | 선택 (0~1회) | `docs/08-pitch.md` (발표 스크립트, 예상 질문·답변), 발표 슬라이드 |

해커톤 권장 디렉터리 구조

```text
hackathon/
├── SPEC.md, AGENTS.md, CLAUDE.md, README.md, .env.example, .gitignore
├── backend/  frontend/
├── scripts/            # verify (sync_skills.py는 링크를 쓸 수 없을 때만)
├── .agents/skills/     # Skills 원본 (Antigravity·Codex)
├── .claude/skills/     # Skills 링크 (Claude Code, 원본은 .agents/skills/, 커밋 안 함)
└── docs/
    ├── 00-brainstorm.md  01-mvp-scope.md  02-glossary.md
    ├── 03-plan.md  progress.md
    ├── 08-pitch.md  bugs.md (선택)
    ├── adr/  agents/   # agents/: setup-matt-pocock-skills 설정
    └── reviews/
```

## 1-B. 현장 해커톤 워크플로우 (6시간)

6시간 현장 해커톤은 1-A를 줄여서 쓰지 않고 이 워크플로우를 별도로 사용합니다. 핵심은 **문서와 절차는 최소화하고, 배포·통합 위험은 앞당기며, 준비는 행사 전에 끝내는 것**입니다.

- 아래 시간표는 6:00 종료 기준입니다. 제출 마감이나 발표 시작이 다르면 「시간 조정 규칙」에 따라 조정합니다.
- 참여 인원과 역할 분담은 고정하지 않습니다. 병렬로 표시된 단계는 동시에 작업할 여력이 있을 때만 병렬로 진행합니다(§3 ⑥).

### 운영 원칙

- **단일 문서:** 기획·설계 문서는 루트의 `SPEC.md`(경량 5개 섹션) 하나만 작성합니다. `docs/` 폴더와 `docs/reviews/` 리뷰 파일은 만들지 않습니다. 발표 대본만 `pitch.md`로 따로 둡니다.
- **기능 단위 분담과 잦은 병합:** 2단계에서 기능 담당·공통 기반 담당·병합 담당을 정하고, 3단계 뼈대(공통 타입·API 계약 포함)를 `main`에 합친 뒤 각자 기능 브랜치에서 작업하며 Task가 끝날 때마다 합칩니다(§0-1, §3 ⑧).
- **인라인 교차 검증 2회:** 구현 계획 확정 시점(2단계)과 데모 경로 점검 시점(6단계)에만 수행합니다. 검증 결과 중 결정된 사항만 `SPEC.md`에 반영하며, 다른 계열 모델이 검증한다는 원칙(§3 ①)과 의견이 갈리면 사람이 즉시 결정한다는 원칙은 그대로 유지합니다.
- **완료 판정은 실행 결과로:** Task 완료는 경량 `verify` 통과와 화면·API에서의 실제 동작 확인으로 판정합니다. 모델의 동의는 완료의 증거가 아닙니다(§3 ①).
- **추론 수준은 세션 시작 시 고정:** 세션 중에 바꾸지 않습니다(§0-3). 결과가 부족하면 추론 수준을 올리는 대신 T1 모델로 전환합니다.
- **막힘 20분 규칙:** 한 문제로 20분 이상 막히면 T1으로 전환하거나, 해당 기능을 Non-goals로 옮기거나(구현하지 않음), 데모에 꼭 필요하면 Mock 대상으로 바꿔 샘플 데이터로 대체합니다.
- **첫 배포는 1:40까지:** 빈 화면이라도 먼저 배포해 배포 환경 문제를 초반에 드러냅니다.
- **4:30 기능 동결:** 이후에는 버그 수정, 배포, 발표 준비만 합니다.
- **Skills 최소화:** 표에 적은 스킬만 씁니다. 1단계 기획은 데스크톱 앱에서 `/grilling` 하나로 끝내고, 1-A·2의 3단계 기획 흐름(`/brainstorming` → `/grill-with-docs` → `/to-spec`)은 40분 안에 끝낼 수 없으므로 쓰지 않습니다(`/brainstorming`은 새 프로젝트를 항상 무거운 아키텍처 경로로 처리하고, `/to-spec`은 경량 템플릿과 구조가 다름). 현장에서 `/find-skills`로 새 스킬을 찾지 않으며, `/implement`·`/tdd`(테스트 우선 전 과정이라 6시간에는 무거움, 핵심 로직의 최소 테스트는 직접 작성)도 쓰지 않습니다(§4).

### 사전 준비 (행사 전)

주제와 무관하게 할 수 있는 작업은 모두 행사 전에 끝내고 템플릿 저장소에 커밋해 둡니다.

- **대회 규정 확인:** 사전 작성 코드와 AI 도구 사용 허용 범위를 먼저 확인합니다. 규칙 파일·스크립트 같은 도구는 허용되어도 앱 코드 뼈대는 금지하는 대회가 많습니다.
- **하네스 파일:** 짧게 작성한 `AGENTS.md`(`verify` 명령과 브랜치·공통 파일 규칙 포함), 첫 줄이 `@AGENTS.md`인 `CLAUDE.md`, `.agents/skills/` 원본과 이를 가리키는 `.claude/skills/` 링크(둘 다 커밋하지 않고 `skills-lock.json`으로 복원). 레거시 `.agents/workflows/`는 미리 마이그레이션합니다(PART 3 §4-5).
- **경량 `verify`:** 아래 「경량 `verify`」 기준으로 미리 구성하고 모든 참가자의 컴퓨터에서 실행되는지 확인합니다(PART 3 §2 완료 기준).
- **`SPEC.md` 빈 템플릿:** 아래 경량 템플릿을 미리 넣어 둡니다.
- **배포 환경:** 배포 플랫폼 계정 로그인, 필요한 환경 변수 목록 정리.
- **Skills 설치:** `/grilling`은 데스크톱 앱에 미리 등록합니다. `verification-before-completion`, `agent-browser`, `/pptx`와 예상 스택에 맞는 조건부 스킬만 §4-3 ⑦ 절차로 프로젝트 폴더에 미리 설치합니다(SPEC이 현장에서 정해지므로 1-B만 예외적으로 SPEC 전에 설치). `/to-tickets`나 `/diagnosing-bugs`를 쓸 경우 `/setup-matt-pocock-skills`를 미리 실행합니다(블록은 `AGENTS.md`에, §4-3 ①). 이때 생기는 `docs/agents/`는 「단일 문서」 원칙의 유일한 예외이며, 이슈 트래커는 로컬 마크다운으로 지정합니다. `/grilling`만 쓴다면 실행하지 않아도 됩니다. `setup-pre-commit`은 대회 규정과 일정이 허락할 때만 구성합니다.
- **MCP:** 브라우저 검증 등에 MCP 서버를 쓴다면 행사 전에 연결과 인증까지 끝냅니다(PART 3 §9).
- **모델 확인:** 참가자별 요금제와 사용 가능 모델·한도를 확인하고(부록 A-2), 세 에이전트에서 규칙과 Skills가 적용되는지, 데스크톱 앱에서 `/grilling`이 호출되는지 확인합니다(§3 ⑤).

### 현장 타임라인 (총 360분)

| 시간 | 단계 (명령/스킬) | 업무 | 주 담당 모델 · 환경 | 추론 수준 | 교차 검증 (횟수) | 결과물 |
| --- | --- | --- | --- | --- | --- | --- |
| 0:00‒0:40 | 1 기획 및 `SPEC.md` 작성 (`/grilling`) | 주제·심사기준 분석, 아이디어 확정, 데모 시나리오 작성 | 후보 생성: Gemini T2 · Gemini 데스크톱 / 확정·작성: Gemini T1 · Gemini 데스크톱 (불가 시 Claude T1 · Claude 데스크톱) | High / Medium | 생략 (2단계에서 함께 검증) | `SPEC.md` (1~4 섹션) |
| 0:40‒1:10 | 2 구현 계획·Task 분할 (Plan 모드, 선택 `/to-tickets`†: 결과는 `SPEC.md` 5절에 기록) | Plan 모드로 Task 분할, 기능 담당·공통 기반 담당·병합 담당 확정, Mock 대상 확정 | Claude T1 · Claude Code (Plan 모드) + 참가자 | High | 필수 1회 (10분 제한): Codex T1이 `SPEC.md`와 계획을 함께 검토 + 사용자 승인 1회 | `SPEC.md` 갱신 (5. Task Split) |
| 1:10‒1:40 | 3 뼈대 및 첫 배포 (조건부 `/deploy-to-vercel`) | 프로젝트 골격과 공통 기반(API 계약·공통 타입) 생성 후 `main`에 커밋, `verify` 통과 확인, 빈 화면이라도 배포 | Claude T2 · Claude Code (공통 기반 담당) | Medium | 생략 | 배포 URL, `.env.example` |
| 1:40‒4:00 | 4 해피 패스 병렬 구현 (`verification-before-completion`, 조건부 스택 스킬) | 데모 시나리오에 나오는 화면·기능만 기능 담당자별로 구현(각자 브랜치, Task 완료마다 병합), Non-goals는 구현하지 않고 Mock 대상은 샘플 데이터로 대체, 결과 오류가 데모를 망칠 핵심 로직은 최소 테스트 작성, Task 완료마다 `verify` 실행 | 담당자가 선택. 권장: Claude T2 · Claude Code / UI·단순: Gemini T3 · Antigravity (브라우저 확인) / 독립 모듈: Codex T2 | Medium / Low / Medium | 생략, `verify`와 실제 동작 확인으로 대체 (0회) | 소스 코드 (`/backend`, `/frontend`) |
| 2:30–4:45 (병렬, 선택) | 5 발표 자료 초안 (`/pptx`) | 데모 시나리오를 바탕으로 발표 스크립트·슬라이드 초안 작성 | Gemini T3 · Antigravity | Low | 생략 | `pitch.md`, 슬라이드 초안 |
| 4:00‒4:45 | 6 통합·버그 수정, 4:30 기능 동결 (`agent-browser`로 스모크 테스트, 선택 `/diagnosing-bugs`†) | 남은 브랜치 병합, 데모 클릭 순서대로 스모크 테스트 | Claude T2 · Claude Code (막히면 Claude T1), 병합 담당 | Medium / High | 데모 경로만 1회: Codex T1이 데모 경로 코드의 런타임 오류 가능성 점검 (스킬 없이 프롬프트로, `/code-review`는 표준·spec 축이라 목적이 다름) | 데모 경로가 끝까지 동작하는 상태 |
| 4:45‒5:15 | 7 최종 배포 및 백업 영상 (조건부 `/deploy-to-vercel`, `agent-browser`) | 배포 환경에서 데모 경로 확인 후 백업 영상 최우선 녹화 | Claude T2 · Claude Code | Low | 생략, 스모크 테스트로 대체 (0회) | 배포 URL, 데모 백업 영상 |
| 5:15‒6:00 | 8 발표 마무리 및 리허설 (`/pptx`) | 구현 화면 스크린샷 반영, 예상 질문·답변 준비, 리허설 2회 | 검토: Gemini T1 · Antigravity | Medium | 생략 | 최종 슬라이드, `pitch.md` |

- 5단계를 병렬로 진행할 여력이 없으면 발표 자료는 8단계에서 초안부터 작성합니다. 이 경우 리허설은 1회로 줄입니다.
- 2단계 검증에서 Codex T1을 쓸 수 없으면 §0-4 대체 규칙을 따르되, 작성 모델(Claude)과 다른 계열이 검증하도록 합니다.

### 시간 조정 규칙

- **제출·발표가 6:00보다 이르면:** 7·8단계를 마감에 맞춰 앞당기고, 줄어든 시간은 4단계(구현)에서 뺍니다. 기획(1·2단계), 첫 배포(3단계), 통합(6단계) 시간은 줄이지 않습니다.
- **주제가 사전에 공개되면:** 1단계의 아이디어 탐색을 행사 전에 진행하고, 남는 시간을 4단계에 배정합니다.
- **전체 시간이 6시간이 아니면:** 비율을 유지합니다. 기획·계획 약 20%, 뼈대·첫 배포 약 8%, 구현 약 40%, 통합·최종 배포 약 20%, 발표 약 12%이며, 기능 동결은 전체 시간의 약 1/4이 남은 시점에 합니다.
- **행사 후:** 단계별 실제 소요 시간과 회고 지표(기능별 구현 시간, 병합 시 충돌·통합 오류 수, 사람이 직접 고친 횟수)를 `README.md` 끝에 기록해, 다음 행사의 시간 배분과 하네스 개선 근거로 사용합니다.

### `SPEC.md` 경량 템플릿 (10개 섹션 → 5개 섹션)

PART 2 §2-3의 템플릿에서 비기능 요구사항, 위험 요소, 테스트 계획 등은 생략합니다.

```markdown
# SPEC.md (현장 해커톤)
> 참가자별 사용 가능 모델·요금제:
> 종료 시각 / 제출 마감:

## 1. Overview, Non-goals, Mock
- 보여줄 것:
- Non-goals (이번에 구현하지 않는 기능):
- Mock 대상 (데모에 필요하지만 실제 연동 대신 샘플 데이터·하드코딩으로 보여줄 부분):

## 2. Demo Scenario
1. (심사위원에게 보여줄 화면 이동·클릭 순서, 5단계 이내)

## 3. Core Functional Requirements (최대 4개)
### FR-001: [기능명]
- 성공 조건:

## 4. Minimal API Contract (변경은 공통 기반 담당자가, 코드보다 먼저)
- (엔드포인트, 요청·응답 JSON 형식)

## 5. Owners & Task Split
- 기능 담당: (FR-ID → 참가자) / 공통 기반 담당: / 병합 담당:
- (Task, 담당 참가자 · 에이전트, 작업 디렉터리, 브랜치, 상태: 대기/진행/통과/보류)
```

예: 결제가 Non-goals라면 결제 화면은 만들지 않고, 추천 결과를 샘플 데이터로 보여준다면 추천 API를 Mock 대상으로 기록합니다.

### 경량 `verify`

- PART 3 §3-2의 `verify` 진입점 이름과 "세 에이전트가 같은 명령을 실행한다"는 원칙은 유지하되, 검사 항목은 **typecheck + build (+ 핵심 로직 최소 테스트)** 로 줄입니다.
- 전체 테스트 체계(단위·통합·E2E 테스트 스위트) 구축은 생략할 수 있습니다. 계산·추천·파싱처럼 결과 오류가 데모를 망칠 수 있는 핵심 로직은 필요한 최소 테스트를 작성하고 `verify`에 포함합니다. 핵심 사용자 흐름은 6·7단계에서 배포 환경 기준으로 직접 확인합니다(스모크 테스트).
- 빌드가 오래 걸리는 스택이면, 작업 중에는 typecheck만 실행하고 `verify`는 Task 완료 시점에 실행합니다.
- Skills 설치 상태(`.agents/skills/` 파일, `.claude/skills/` 링크, `skills-lock.json`)는 사전 준비 때 확인하고, 현장에서는 Skills를 바꾼 경우에만 다시 확인합니다.
- CI(GitHub Actions)는 구성하지 않습니다.

### 현장 해커톤 디렉터리 구조

```text
hackathon-6h/
├── SPEC.md, pitch.md, AGENTS.md, CLAUDE.md, README.md, .env.example, .gitignore
├── backend/  frontend/
├── scripts/            # verify (typecheck + build + 최소 테스트). sync_skills.py는 링크를 쓸 수 없을 때만
├── .agents/skills/     # Skills 원본 (사전 준비)
└── .claude/skills/     # Skills 링크 (원본은 .agents/skills/, 커밋 안 함)
```

## 2. 프로젝트 워크플로우 (캡스톤 · 일반 프로젝트)

중장기 프로젝트나 캡스톤 디자인에서는 요구사항 검증, 아키텍처 설계, 테스트 및 산출물 문서화의 정합성을 높이는 데 집중합니다.

- 스킬 표기(†, 조건부)는 1-A와 같으며, 출처·적용 조건은 §4를 따릅니다. 1~3단계는 Claude·Gemini 데스크톱 앱, 4단계부터는 AI 에이전트에서 진행하며, 3단계 이후 기획 문서 인계와 프로젝트 Skills 설치는 §4-3 ⑦을 따릅니다. 4단계 전에 프로젝트 폴더에서 `/setup-matt-pocock-skills`†를 한 번 실행합니다(§4-3 ①).
- 7단계의 CI/CD 설정(`.github/workflows/`)을 만드는 스킬은 없으므로 PART 3 §6에 따라 구성합니다.

| 단계 (명령/스킬) | 업무 | 주 담당 모델 · 환경 | 추론 수준 | 교차 검증 (횟수) | 결과물 |
| --- | --- | --- | --- | --- | --- |
| 1 (`/brainstorming`) | 아이디어 브레인스토밍 | Gemini T3 · Gemini 데스크톱 | High | 선택 (0~1회) | `docs/00-brainstorm.md` |
| 2 (`/grill-with-docs`, `/research`, 선택 `/prototype`†: 에이전트에서 실행) | 아이디어 구체화 및 실현 가능성 검증 | Gemini T1 · Gemini 데스크톱 + 팀원 (불가 시 Claude T1 · Claude 데스크톱) | High | 필수, Claude T1 High (1~2회) ※대체 시 Codex T1 | `docs/01-concept.md` (문제 정의, 타깃 사용자, 경쟁 서비스 비교), `docs/01-feasibility.md` (기술·일정·인력 검토, 리스크), `docs/meetings/` (회의록) |
| 3 (`/to-spec`, `/grill-with-docs`) | 요구사항 명세서 작성·검토 및 `SPEC.md` 확정 | 초안: Gemini T1 · Gemini 데스크톱 / 검토: Claude T1 | 초안 Medium → 검토 High | 필수 (2회, 최대 3회) | `docs/02-requirements.md` (기능·비기능 요구사항, 유스케이스, 우선순위), `docs/02-glossary.md` (도메인 용어집), `SPEC.md` |
| 4 (Plan 모드 + `/to-tickets`†) | 기획 문서 인계·프로젝트 Skills 설치(§4-3 ⑦), 아키텍처 설계, 사람별 기능 담당·공통 파일 담당·병합 담당 지정, 구현 계획 및 Task 분할 | Claude T1 · Claude Code (Plan 모드) 또는 Antigravity (Planning 모드) + 팀원 | High | 필수, Gemini T1 High (2회, 최대 3회) + 사용자 승인 1회 | `docs/03-architecture.md` (구조도, ERD는 Mermaid로), `docs/adr/` (주요 기술 결정 기록), `api/openapi.yaml`, `docs/03-plan.md` (담당 표, 마일스톤, Task·이슈 번호), `docs/progress.md` (§3 ⑦), `AGENTS.md`, `CLAUDE.md` (`@AGENTS.md` import) |
| 5 (`/implement`†, `/tdd`†, `verification-before-completion`, 조건부 스택 스킬) | 기능 담당자별 개발(화면 → API → DB), 기능 브랜치·PR 단위로 작게 병합 (§3 ⑧) | 담당자가 선택. 권장: 일반 Claude T2 / 단순 Gemini T3 / 복잡 Claude T1 / 독립 모듈 Codex T2 | Medium / Low / High / Medium | 변경 위험 기준 (§3 ①): 일반 PR은 상대 팀원 리뷰, 복잡한 모듈은 Codex T1 추가 (PR당 1회) | 소스 코드, 단위 테스트, PR 설명 (변경 내용·테스트 방법), `CHANGELOG.md` |
| 6 (`/code-review`, `verification-before-completion`, `agent-browser`, `improve-codebase-architecture`, 선택 `/diagnosing-bugs`†) | 코드 리뷰 및 통합 테스트 | 테스트: Claude T2 / 리뷰: 상대 팀원 + Codex T1 (작성 모델과 다른 계열) / 중요 영역: Codex T1 + Gemini T1 | Medium / Medium / High | 필수 (일반 PR당 1회, 인증·결제·개인정보·공통 파일·API 계약 변경 PR은 2회: 두 계열이 1회씩, 사람 리뷰 별도) | 통합·E2E 테스트 코드, `docs/06-test-report.md` (테스트 범위, 결과, 미해결 이슈), `docs/reviews/` |
| 7 (`finishing-a-development-branch`, 조건부 `/deploy-to-vercel`) | 배포 및 운영 | Claude T2 · Claude Code (장애 시 Claude T1) | 일반 Medium / 고위험 High | 위험도에 따라 (일반 0회, DB 마이그레이션·인프라 변경 1~2회, Codex T1) | CI/CD 설정 (`.github/workflows/` 등), `docs/07-deploy.md`, `docs/07-runbook.md` (장애 대응 절차), `.env.example` |
| 8 (`/pptx`) | 문서화 및 발표 | 초안: Gemini T1 / 검토: Claude T1 | Medium | 보고서 권장 (보고서 1회, 발표 자료 0~1회) | `README.md` (최종본), 최종 보고서, 발표 자료, 사용자 매뉴얼 (캡스톤 제출용) |

> 💡 **작성 모델과 검증 모델**
> 5·6단계의 코드를 Claude가 작성했다면 모델 리뷰는 Codex(OpenAI)가 맡습니다. Gemini나 Codex가 작성한 모듈이라면 그와 다른 계열(예: Claude T1)이 리뷰합니다. 모델 리뷰는 시각을 넓히는 도구이며, 완료 판정은 §3 ①의 실행 결과 기준을 따릅니다.

일반 프로젝트 권장 디렉터리 구조

```text
project/
├── SPEC.md, AGENTS.md, CLAUDE.md, README.md, CHANGELOG.md, .env.example, .gitignore
├── src/  tests/  api/openapi.yaml
├── scripts/            # verify (sync_skills.py는 링크를 쓸 수 없을 때만)
├── .agents/skills/     # Skills 원본
├── .claude/skills/     # Skills 링크 (원본은 .agents/skills/, 커밋 안 함)
├── .github/workflows/
└── docs/
    ├── 00-brainstorm.md
    ├── 01-concept.md  01-feasibility.md
    ├── 02-requirements.md  02-glossary.md
    ├── 03-architecture.md  03-plan.md  progress.md
    ├── 06-test-report.md
    ├── 07-deploy.md  07-runbook.md
    ├── adr/  meetings/  reviews/
    └── agents/         # setup-matt-pocock-skills 설정 (이슈 트래커·문서 위치)
```

## 3. 워크플로우 공통 운영 규칙

### ① 완료 판정과 교차 검증 원칙

**완료 판정 (4조건 모두 충족):**

1. `SPEC.md`의 해당 요구사항 완료 조건을 충족한다.
2. 필요한 자동 검사(`verify`)를 실제로 실행해 통과한다.
3. 실제 화면·API에서 해당 동작을 확인한다(브라우저·`agent-browser`·API 호출).
4. 변경 위험에 맞는 리뷰를 받는다(아래 표).

다른 모델이 "문제없다"고 답한 것은 정확성의 증거가 아닙니다. 완료의 증거는 실행 결과입니다. 다른 계열 모델 리뷰는 작성 모델이 놓친 관점을 찾는 데 씁니다.

**리뷰 강도는 변경 위험으로 정합니다.** 워크플로우 표의 교차 검증 횟수는 상한이며, 아래 기준이 우선합니다.

| 변경 위험 | 예시 | 리뷰 |
| --- | --- | --- |
| 낮음 | 문구·스타일, 담당 기능 내부의 작은 수정 | `verify` + 직접 동작 확인으로 충분, 리뷰 생략 가능 |
| 보통 | 일반 기능 추가·수정 | 기능 담당자 외 1명(상대 팀원 또는 다른 계열 모델) 1회 |
| 높음 | 인증·결제·개인정보, DB 마이그레이션, 공통 파일, API 계약 변경, 배포 설정 | 상대 팀원 리뷰 + 다른 계열 모델 리뷰 |

**운영 규칙:**

- **지적에는 근거가 필요합니다.** 재현 절차, 실패한 테스트·로그, 또는 코드 위치와 구체적 실패 시나리오 중 하나가 있어야 "치명·중요"로 분류합니다. 근거가 없는 지적은 확인한 뒤 반영 여부를 정합니다.
- **1회 라운드의 정의:** 검증 → 수정 → 재검증을 1회로 봅니다.
- **검증 모델 선택:** 모델 리뷰는 작성 모델과 다른 계열 모델이 수행합니다(§0-2 정의).
- **조기 종료 조건:** 치명적·중요 이슈가 0건이면 최대 횟수가 남아 있어도 즉시 종료하며, 사소한 이슈만 남은 경우 수정 반영만 하고 다음 단계로 넘어갑니다.
- **의견 충돌 해결:** 최대 횟수에 도달해도 의견이 갈리면 사람(해당 기능 담당자, 공통 파일이면 공통 기반 담당자)이 최종 결정하고, 그 이유를 해당 `.md` 파일이나 `docs/adr/`에 기록합니다. 개인 프로젝트에서는 본인이 결정하고 같은 방식으로 기록합니다.
- **컨텍스트 전달:** 2회차 검증부터는 이전 리뷰 파일을 검증 모델에게 함께 전달하여, 이미 해결된 문제를 반복해서 지적하지 않도록 방지합니다.

### ② 리뷰 파일 표준 양식

리뷰 문서(`docs/reviews/`)는 상단에 메타 정보를 적고, 본문은 아래 5개 컬럼의 표로 통일합니다. 이 양식을 유지하면 추후 캡스톤 보고서 등에 "AI 교차 검증 과정"의 객관적 근거로 바로 활용할 수 있습니다.

```markdown
# 06-review-r1
- 대상: (파일 또는 PR 번호)
- 기능 담당: (팀원)
- 작성: Claude T2 (실제 모델명) · Claude Code
- 검증: Codex T1 (실제 모델명) · Codex / 상대 팀원
- 변경 위험: 낮음 · 보통 · 높음
- 라운드: 1 / 최대 2
```

| 지적 사항 | 근거 (재현·로그·코드 위치) | 심각도 (치명 · 중요 · 사소) | 반영 여부 | 반영하지 않은 이유 (해당 시) |
| --- | --- | --- | --- | --- |
| 예시: 토큰 만료 시 예외 처리 누락 | `auth/session.ts:42`, 만료 토큰 요청 시 500 응답 재현 | 중요 | 반영 완료 | - |

### ③ 세 에이전트의 공통 규칙 관리 원칙

- `AGENTS.md`를 Antigravity, Claude Code, OpenAI Codex가 공유하는 프로젝트 공통 규칙의 단일 기준으로 사용합니다.
- Claude Code는 `AGENTS.md`를 직접 읽지 않으므로, `CLAUDE.md` 첫 줄에서 `@AGENTS.md`로 공통 규칙을 불러옵니다. 내용을 복사하거나 "동기화"하지 않습니다.
- Claude Code 전용 지침만 `CLAUDE.md`의 import 아래에 작성합니다.
- `GEMINI.md`와 `AGENTS.override.md`는 원칙적으로 만들지 않습니다. 꼭 필요하면 PR 리뷰를 거쳐 커밋하고 사유를 `docs/adr/`에 기록합니다.
- `.agents/rules/`는 Antigravity 전용 세부 규칙에만 사용하며, 공통 규칙을 그곳에 중복 작성하지 않습니다.
- Skills의 원본은 `.agents/skills/` 하나이며, `.claude/skills/`는 원본을 가리키는 링크입니다(PART 3 §4-2).
- 각 에이전트에서 공통 규칙이 실제로 적용되는지 ⑤의 방법으로 확인합니다.
- `SPEC.md`는 요구사항의 기준이며, `AGENTS.md`는 작업 규칙의 기준입니다.

### ④ 팀 공유 설정과 개인 설정의 구분

팀 저장소에는 팀 전체에 적용할 설정만 커밋하고, 개인 취향은 개인 영역에 둡니다. 개인 전역 규칙이 팀 `AGENTS.md`와 충돌하면 팀 규칙을 우선하고 개인 규칙을 수정합니다.

| 에이전트 | 팀 공유 (저장소에 커밋) | 개인 (커밋 금지 또는 홈 디렉터리) |
| --- | --- | --- |
| Antigravity | `AGENTS.md`, `.agents/rules/*.md`, `.agents/skills/` | `~/.gemini/AGENTS.md`, `~/.gemini/GEMINI.md`, `~/.gemini/config/rules/`, 전역 Skills·MCP 설정 (제품별 경로가 다름: PART 3 §4-1, §9) |
| Claude Code | `CLAUDE.md`, `.claude/settings.json`, `.claude/skills/` (링크이므로 커밋하지 않고 `skills-lock.json`으로 복원), `.mcp.json` | `CLAUDE.local.md`, `.claude/settings.local.json`, `~/.claude/CLAUDE.md`, `~/.claude/skills/` (`find-skills`만, PART 3 §4-2) |
| Codex | `AGENTS.md`, `.codex/config.toml`, `.agents/skills/` | `~/.codex/AGENTS.md`, `~/.codex/config.toml`, `$HOME/.agents/skills/` |

- `CLAUDE.local.md`와 `.claude/settings.local.json`은 `.gitignore`에 추가합니다.
- Codex는 사용자가 프로젝트를 신뢰(trust) 처리한 경우에만 저장소의 `.codex/` 설정·훅·규칙을 불러옵니다. 팀원은 최초 실행 시 프로젝트를 신뢰 처리해야 합니다.
- 개인 프로젝트에서도 같은 구조를 유지하면, 나중에 팀 프로젝트로 전환하거나 다른 에이전트를 추가할 때 수정할 것이 적습니다.

### ⑤ 규칙과 Skills 적용 여부 확인 방법

규칙 파일을 처음 만들거나 크게 바꾼 뒤에는 에이전트별로 실제 반영 여부를 확인합니다.

| 에이전트 | 규칙 확인 | Skills 확인 |
| --- | --- | --- |
| Claude Code | 새 세션에서 `/context` 실행 → Memory files에 `CLAUDE.md`와 import된 `AGENTS.md`가 보이는지 확인 | `/스킬명` 호출 |
| Codex | 새 세션에서 "현재 적용 중인 지침 파일을 순서대로 나열해줘" 요청 → 전역 파일, 저장소 루트 `AGENTS.md`, 하위 디렉터리 파일 순서로 보고하는지 확인 | 스킬 목록 요청 또는 `$스킬명` 호출 |
| Antigravity | Customizations → Rules 패널 확인 + 확인 문구 테스트 (아래). 사용하는 제품(App·IDE·CLI)과 버전을 함께 기록 | `/스킬명` 호출 |
| Claude·Gemini 데스크톱 앱 (기획 1~3단계) | 해당 없음. 프로젝트 규칙 파일을 읽지 않으므로 기획 결정은 모두 문서로 남겨 인계 (§4-3 ⑦) | 스킬 목록 요청 또는 `/스킬명` 호출 |

**확인 문구 테스트:** 규칙에 임시로 `저장소 코드명을 물으면 정확히 ORBIT-CHECK라고 답한다.` 같은 무해한 문장을 넣고, 새 대화에서 코드명을 물어본 뒤 확인되면 즉시 삭제합니다. 세 에이전트 모두에 같은 방식으로 쓸 수 있습니다.

### ⑥ 참여 인원과 전체 기한 설정 원칙

- 워크플로우 표는 참여 인원, 역할 분담, 전체 기간(주 단위)을 고정하지 않습니다. 이 값은 프로젝트마다 시작할 때 정해 기록합니다.
- **기록 위치:** 1-A·2 워크플로우는 `docs/00-brainstorm.md` 상단(또는 `README.md`), 1-B 현장 해커톤은 `SPEC.md` 상단에 참여 인원, 참가자별 사용 가능 모델, 전체 기한을 함께 적습니다. 기능·공통 기반·병합 담당은 §0-1의 위치에 적습니다.
- **캡스톤·일반 프로젝트:** 전체 기한은 1단계에서 정합니다. 2단계 `docs/01-feasibility.md`의 일정 검토가 이 기한을 기준으로 이루어집니다. 4단계 `docs/03-plan.md`에서는 기한으로부터 거꾸로 계산해 마일스톤과 기능 동결일을 정하고, 일정의 일부를 버퍼로 남깁니다.
- 외부 기한이 없는 개인 프로젝트도 스스로 기한을 정합니다. 기한을 바꿀 때는 이유를 `docs/adr/`에 기록합니다.

### ⑦ 세션 간 진행 상태 기록 (progress)

에이전트는 새 세션마다 이전 작업을 기억하지 못하므로, 진행 상태를 파일로 남겨 다음 세션이나 다른 팀원이 넘겨받게 합니다. Anthropic의 장시간 에이전트 하네스(세션별 진행 로그, 기능별 통과 여부 목록, 설명이 있는 git 커밋)를 이 문서의 구조에 맞춘 것입니다.

- **위치:** 1-A·2 워크플로우는 `docs/progress.md`, 1-B 현장 해커톤은 `SPEC.md` 5절(Owners & Task Split)의 상태 열을 씁니다.
- **형식:** Task 표(ID, Task, 담당(사람 · 에이전트), 브랜치, 상태, 마지막 verify 결과, 메모)와 세션 로그(날짜·담당·한 일·다음 할 일, 3줄 이내)로 구성합니다.
- **상태 값:** 대기 / 진행 / 통과 / 보류. "통과"는 §3 ①의 완료 판정(`verify` 또는 스모크 테스트를 실제로 실행한 증거 포함)을 충족했을 때만 바꿉니다(`verification-before-completion`).
- **세션 시작:** progress 파일과 최근 git log를 읽고, `verify`를 먼저 실행해 기준 상태를 확인한 뒤 Task 하나를 고릅니다.
- **세션 종료·인수인계:** 상태와 세션 로그를 갱신하고, 무엇을 했는지 알 수 있는 메시지로 커밋합니다.
- **변경 금지:** Task 목록은 4단계 `docs/03-plan.md`(또는 `/to-tickets` 결과)에서 만듭니다. 진행 중에 에이전트가 Task를 지우거나 완료 조건을 바꾸지 않으며, 바꿔야 하면 사람이 결정하고 `SPEC.md`부터 고칩니다.

```markdown
# progress.md

| ID | Task | 담당 | 브랜치 | 상태 | 마지막 verify | 메모 |
| --- | --- | --- | --- | --- | --- | --- |
| T-01 | 로그인 API | 팀원 A · Claude Code | feat/fr-auth-01-login | 통과 | 2026-11-02 통과 | |
| T-02 | 로그인 화면 | 팀원 B · Antigravity | feat/fr-auth-04-login-ui | 진행 | 2026-11-02 typecheck 실패 | 오류 응답 형식 미정 → 공통 기반 담당 확인 중 |

## 세션 로그
- 2026-11-02 · 팀원 A · Claude Code · T-01 완료, main 병합. 다음: SPEC.md §6 오류 응답 형식 확정 후 팀원 B에게 공유
```

### ⑧ 브랜치·병합·공통 파일 규칙 (협업)

기능으로 나눠도 공통 파일에서는 충돌이 생깁니다. 아래 규칙을 `AGENTS.md`에도 짧게 반영합니다(PART 2 §3-2 템플릿 §4).

- **기능 브랜치에서 작업합니다.** 브랜치 이름은 `feat/<기능ID>-<짧은이름>`처럼 기능 ID를 포함합니다. `main`에 직접 커밋하지 않으며, `main`은 항상 `verify`를 통과하는 상태로 유지합니다.
- **같은 컴퓨터에서 여러 에이전트가 동시에 수정하면 작업 폴더를 분리합니다.** 한 폴더에서 두 에이전트가 같은 파일을 고치지 않도록 `git worktree add ../<프로젝트>-<기능ID> feat/<기능ID>`처럼 브랜치별 worktree를 만듭니다.
- **공통 파일은 담당자만 수정합니다.** 대상은 §0-1의 공통 기반 목록입니다. 다른 사람이 고쳐야 하면 담당자에게 먼저 알리고 승인 후 수정합니다. 에이전트는 공통 파일 수정이 필요하면 멈추고 보고합니다.
- **API 요청·응답 형식은 코드보다 계약을 먼저 바꿉니다.** `SPEC.md` §6(또는 `api/openapi.yaml`)을 수정 → 상대방에게 공유 → 양쪽 코드 반영 순서로 진행합니다. 변경 PR은 "높음" 위험으로 리뷰합니다(§3 ①).
- **DB 마이그레이션은 공통 기반 담당자가 만듭니다.** 마이그레이션 파일 번호 충돌을 막기 위해서입니다. 잠금 파일(lockfile)도 의존성 담당자만 바꾸고, 충돌 시 직접 편집하지 말고 재설치로 다시 만듭니다.
- **첫 기능부터 작게 합칩니다.** 마지막 통합 단계까지 각자 따로 개발하지 않습니다. 병합 주기는 해커톤에서는 Task 완료마다, 일반 프로젝트에서는 최소 하루 1회 또는 PR 단위입니다. 병합 전에 최신 `main`을 반영하고 `verify`를 다시 실행합니다.
- **병합 담당:** 해커톤은 병합 담당 1명이 병합과 충돌 해결을 맡습니다. 일반 프로젝트는 PR 작성자가 리뷰 승인을 받은 뒤 병합하고, 충돌 해결이 어려우면 병합 담당이 맡습니다.

## 4. 단계별 Skills 매핑과 사용 원칙

워크플로우 표의 "단계 (명령/스킬)" 열에는 스킬 이름만 적고, 스킬의 출처·용도·적용 조건은 이 섹션에서만 관리합니다. 스킬 이름과 구성은 자주 바뀌므로(예: mattpocock/skills v1.1에서 `/to-prd` → `/to-spec`, `/to-issues` → `/to-tickets`) 바뀌면 이 섹션과 표의 이름만 수정합니다.

- **기준일:** 2026-10-31. 설치 수와 순위는 빠르게 바뀌므로 기록하지 않습니다.
- **기본 흐름:** 기획(데스크톱 앱)은 superpowers의 `brainstorming`(아이디어 브레인스토밍) → mattpocock/skills의 `grill-with-docs`(아이디어 구체화) → `to-spec`(요구사항 명세서), 실행(AI 에이전트)은 Plan 모드 + mattpocock/skills의 `to-tickets`(작업 분해) → `implement` → `code-review`를 뼈대로 씁니다. obra/superpowers에서는 `brainstorming`, `verification-before-completion`, `finishing-a-development-branch`만 가져옵니다. 나머지는 기술 스택이 맞을 때만 사용합니다.
- **실행 환경 분리:** 1~3단계 기획 스킬은 Claude·Gemini 데스크톱 앱에 한 번 등록해 두고 프로젝트마다 다시 받지 않습니다. 4단계부터 쓰는 스킬만 프로젝트 폴더에 둡니다(§4-3 ⑦).
- **기획 스킬 중복 금지:** `brainstorming`(superpowers)과 `grill-with-docs`(mattpocock)는 둘 다 한 번에 하나씩 질문하고 승인 게이트를 두므로 같은 단계에서 함께 쓰지 않습니다. `brainstorming`은 1단계(아이디어 후보 도출), `grill-with-docs`는 2단계(고른 아이디어 구체화)로 나눠 씁니다.
- **† 표시:** 2026-10-28 기준 팀 설치 목록에 없어 추가 설치가 필요한 스킬입니다. 4단계 이후 스킬은 §4-3 ⑦ 절차로 프로젝트 폴더에 설치하고 `.claude/skills/` 링크가 생겼는지 확인합니다.
- **설치 시점:** 기획 스킬은 데스크톱 앱에 미리 등록해 둡니다. 프로젝트 폴더의 스킬은 `SPEC.md`가 확정된 뒤 4단계 전에 정하고(1-B는 SPEC을 현장에서 쓰므로 예상 스택 기준으로 사전 준비 때 설치), 이후 필요가 생긴 스킬은 PART 4 Step 5~6에서 결정합니다. PART 3 §1-2 진단과 PART 4 §2-2 개선 작업 중에는 새 스킬을 제안·설치하지 않는다는 원칙을 그대로 유지합니다.

### 4-1. Skills 목록 (출처 · 용도 · 적용 조건)

| 스킬 | 출처 저장소 | 하는 일 | 적용 조건 · 주의 |
| --- | --- | --- | --- |
| `setup-matt-pocock-skills`† | mattpocock/skills | 이슈 트래커·문서 위치를 설정해 다른 mattpocock 스킬이 참조하게 함 | 레포당 1회, 프로젝트 폴더에서 4단계 전에 실행. `to-tickets`·`implement`·`tdd`·`diagnosing-bugs`·`code-review`·`improve-codebase-architecture`를 쓰기 전에 필요(데스크톱 앱에서 쓰는 `to-spec`에는 필요 없음). 생성되는 `## Agent skills` 블록은 `AGENTS.md`에만 둠 (§4-3 ①) |
| `grill-with-docs` | mattpocock/skills | 한 번에 하나씩 질문해 계획을 검증하고, 용어집·ADR을 진행 중에 갱신 | 데스크톱 앱(2단계). 내부에서 `grilling`·`domain-modeling`을 사용하므로 둘을 표에 따로 나열하지 않음. 앱에서는 저장소 파일을 직접 갱신하지 못하므로 용어집·ADR은 결과를 받아 프로젝트 폴더로 옮김 (§4-3 ⑦) |
| `grilling` | mattpocock/skills | 한 번에 하나씩 질문해 계획을 검증 (문서 갱신 없음) | 시간 제약이 큰 1-B에서 사용 (데스크톱 앱) |
| `research` | mattpocock/skills | 백그라운드 에이전트가 1차 자료(공식 문서·소스·스펙)를 조사해 출처를 단 마크다운으로 저장 | 데스크톱 앱(2단계). 기술·API 실현 가능성 검토용. 백그라운드 에이전트 실행이 데스크톱 앱에서 동작하는지 처음 한 번 확인하고, 안 되면 같은 지시를 대화로 진행. 경쟁 서비스 비교처럼 2차 자료가 필요한 조사는 프롬프트로 진행 |
| `prototype`† | mattpocock/skills | 비즈니스 로직·상태 전이·데이터 모델을 본구현 전에 빠르게 시험 | 선택. 위험한 핵심 로직이 있을 때. 코드를 실행하므로 AI 에이전트에서 사용 |
| `to-spec` | mattpocock/skills | 대화를 spec(PRD)으로 정리해 이슈 트래커에 게시 | 데스크톱 앱(3단계). 이슈 트래커에 게시하지 않고 결과를 루트 `SPEC.md`로 옮겨 확정 (§4-3 ②). 1-B 경량 템플릿에는 쓰지 않음 |
| `to-tickets`† | mattpocock/skills | spec을 tracer-bullet 티켓으로 나누고 티켓 간 선후 관계를 표시 | AI 에이전트(4단계, Plan 모드와 함께). `docs/03-plan.md`의 Task·이슈 번호에 대응. 티켓마다 기능 담당자를 지정 |
| `implement`† | mattpocock/skills | spec·티켓을 테스트 우선으로 구현 | 6시간 1-B에서는 사용하지 않음(테스트 우선 전 과정이 무거움, 핵심 로직 최소 테스트는 직접 작성) |
| `tdd`† | mattpocock/skills | 테스트 주도로 기능·버그 수정 구현 | 단위 테스트가 결과물인 §2 5단계 |
| `diagnosing-bugs`† | mattpocock/skills | 버그 원인 진단 (구 `/diagnose`) | 통합·버그 수정 단계에서 선택 |
| `code-review` | mattpocock/skills | diff를 레포 코딩 표준(Fowler 코드 스멜 12종 포함)과 spec 충실도 두 축으로 병렬 검토 | 린터가 강제하는 항목은 건너뜀. 런타임 오류·메모리 누수 점검용이 아님. Codex에서 두 축이 분리되어 나오는지 확인 (§3 ⑤) |
| `improve-codebase-architecture` | mattpocock/skills | 기존 코드에서 얕은 모듈·강결합을 찾아 개선 기회를 제시 | 코드가 쌓인 뒤 사용 (§2 6단계, 마일스톤 사이). 새로 짜는 단계에는 쓰지 않음 |
| `setup-pre-commit` | mattpocock/skills | Husky + lint-staged(Prettier) + typecheck·test pre-commit 훅 설정 | Node 스택 전용. 시크릿 검사는 포함하지 않음. 마지막에 직접 커밋함. 하네스 구축 단계에서 사용 (PART 3 §3-3, §4-3 ⑤) |
| `brainstorming` | obra/superpowers | 구현 전에 질문으로 의도·요구사항을 다듬어 설계안을 만들고, 승인 전까지 코딩을 막음 | 데스크톱 앱(1단계) 아이디어 브레인스토밍용. 발산형이 아니라 수렴형(설계안 최대 2~3개, 추천안 우선)이고 새 프로젝트는 항상 무거운 아키텍처 경로로 처리하므로, 후보를 먼저 넓게 나열하도록 지시하고 설계·구현 계획 단계로 넘어가지 않게 범위를 정함. 1-B에서는 사용하지 않음 (§4-3 ③) |
| `verification-before-completion` | obra/superpowers | 완료를 주장하기 전에 검증 명령을 실제로 실행하고 결과로 확인 | 구현·통합·배포 단계 전체. `AGENTS.md` §8과 겹치므로 규칙 파일에는 호출 지시 한 줄만 둠 |
| `finishing-a-development-branch` | obra/superpowers | 테스트·베이스 브랜치 확인 후 merge·PR·유지·폐기 선택지를 안내 | 브랜치 마무리용(§3 ⑧). 배포·컨테이너 스킬이 아님 |
| `vercel-react-best-practices` | vercel-labs/agent-skills | React·Next.js 성능 규칙(워터폴, 번들 크기, 서버·클라이언트 렌더링) | React·Next.js 프로젝트일 때만 |
| `deploy-to-vercel` | vercel-labs/agent-skills | Vercel 배포·프리뷰 배포 | Vercel로 배포할 때만. CI YAML은 만들지 않음 (PART 3 §6) |
| `design-taste-frontend` | Leonxlnx/taste-skill (개인 저장소, Anthropic 공식 아님) | 디자인 방향을 먼저 정해 템플릿 같은 기본 디자인을 피함 | 랜딩·포트폴리오·리디자인 페이지 전용. 대시보드·데이터 테이블·다단계 제품 UI에는 쓰지 않음 |
| `supabase-postgres-best-practices` | supabase/agent-skills | Postgres 스키마·인덱스·RLS·마이그레이션·쿼리 성능 규칙 | Postgres를 쓸 때만 (Supabase 호스팅이 아니어도 적용) |
| `agent-browser` | vercel-labs/agent-browser | 실제 브라우저를 자동화해 화면·사용자 흐름을 확인 | 스모크·E2E 확인용(§3 ① 완료 조건 3). Antigravity는 내장 브라우저가 있으므로 Claude Code·Codex 위주로 사용 |
| `pptx` | anthropics/skills | PowerPoint 파일 생성·편집 | 발표 자료 |
| `find-skills` | vercel-labs/skills | 레지스트리에서 스킬을 검색·설치 | 개인 전역 경로에 두는 유일한 스킬. `SPEC.md` 확정 후 프로젝트 스킬 후보를 찾을 때 사용 (§4-3 ④·⑦) |

### 4-2. 공통 사용 규칙

- 각 단계에서는 표에 적은 스킬만 호출합니다. 설치된 모든 스킬을 매 작업에 실행하지 않습니다(`AGENTS.md` §5).
- `verification-before-completion`은 Task 완료를 보고하기 전에 매번 사용합니다(1-B에서는 경량 `verify` 실행과 스모크 확인이 그 증거입니다).
- 기술 스택 조건부 스킬(`vercel-react-best-practices`, `supabase-postgres-best-practices`, `deploy-to-vercel`, `setup-pre-commit`)은 `SPEC.md`의 기술 스택이 확정된 뒤 §4-3 ⑦ 절차로 설치 여부를 정하고, 결정을 `docs/adr/`(1-A·1-B는 `README.md`)에 기록합니다.
- 스킬 이름이 바뀌거나 deprecated 되면 이 섹션과 워크플로우 표를 함께 고치고, 「문서 변경 이력」에 남깁니다.

### 4-3. 하네스 규칙과 충돌하지 않게 쓰는 방법

- **① `setup-matt-pocock-skills` 결과 위치:** 이 스킬은 `AGENTS.md`나 `CLAUDE.md`에 `## Agent skills` 블록을 쓰고 `docs/agents/`를 만듭니다. `CLAUDE.md`는 `@AGENTS.md` import와 전용 지침만 둔다는 §3 ③ 규칙에 따라 블록은 반드시 `AGENTS.md`에 둡니다. 이슈 트래커는 GitHub Issues 또는 로컬 마크다운 중 하나로 정하고, 용어집·ADR 위치는 `docs/02-glossary.md`, `docs/adr/`로 지정합니다.
- **② `to-spec`과 `SPEC.md`:** 요구사항의 유일한 기준은 루트 `SPEC.md`입니다(PART 2 §2-0). `to-spec`은 원래 대화 단위 spec을 이슈 트래커에 게시하지만, 데스크톱 앱에서는 게시하지 말고 `SPEC.md` 템플릿 항목에 맞춰 마크다운으로 출력하게 한 뒤 프로젝트 폴더의 `SPEC.md`로 옮겨 확정합니다. 앱에서 `SPEC.md` 템플릿 항목대로 출력되는지는 처음 한 번 실제 호출로 확인합니다.
- **③ `brainstorming`을 쓰는 경우:** 데스크톱 앱(1단계)에서만 씁니다. 원래 설계 문서를 `docs/superpowers/specs/`에 저장·커밋하고 구현 계획(`writing-plans`)까지 이어가는 스킬이므로, "아이디어 후보와 비교까지만 정리하고 설계·구현 계획은 만들지 마"처럼 범위를 정하고 결과는 `docs/00-brainstorm.md`로 옮깁니다. 범위를 정하지 않으면 아키텍처 경로의 마지막 단계에서 설치되지 않은 `writing-plans`를 호출하므로, 구현 계획은 4단계 Plan 모드에서 만든다고 명시합니다. 같은 스킬을 프로젝트 폴더에도 설치했다면 저장 위치를 `docs/` 구조에 맞게 지정하고, 시각 보조 도구로 생기는 `.superpowers/`는 `.gitignore`에 추가합니다. 1-B에서는 사용하지 않습니다.
- **④ `find-skills`:** 개인 전역 경로(Claude Code는 `~/.claude/skills/`)에 두는 유일한 스킬입니다. 프로젝트 스킬은 `-g` 없이 프로젝트 폴더에서 설치하고(`-g`를 붙이면 개인 전역에 설치되어 이름이 겹칩니다), 절차는 ⑦을 따릅니다. 구독컷에서 확인한 결과 `npx skills add`는 `.agents/skills/`에 파일을, `.claude/skills/`에 그 폴더를 가리키는 링크(Windows는 Junction)를 만들므로 단일 원본이 유지됩니다. **`npx skills remove -g`는 쓰지 않습니다.** 전역 삭제 명령이 프로젝트 `.agents/skills/`의 폴더까지 지운 사례가 있어, 제거는 `-g` 없이 `npx skills remove <이름>`으로 하고 실행 뒤 `SKILL.md` 존재 여부를 확인합니다.
- **⑤ `setup-pre-commit`:** 훅에 들어가는 typecheck·test 명령을 `verify`(또는 경량 `verify`의 일부)로 바꿔 "단일 `verify`" 원칙(PART 3 §3)과 맞춥니다. 스킬이 마지막에 커밋까지 하므로 팀 저장소에서는 브랜치에서 실행합니다. 시크릿 검사는 별도로 구성합니다.
- **⑥ `code-review`를 Codex에서 쓸 때:** 서브에이전트 병렬 실행을 전제로 만든 스킬이므로, Codex에서 Standards·Spec 두 축이 분리되어 보고되는지 처음 한 번 확인합니다. 리뷰 결과는 §3 ② 양식으로 `docs/reviews/`에 옮깁니다.
- **⑦ 기획(데스크톱 앱) → 실행(AI 에이전트) 인계와 프로젝트 Skills 설치:** 데스크톱 앱은 `AGENTS.md` 등 프로젝트 규칙 파일을 읽지 않고 저장소에 직접 쓰지도 못하므로, 3단계까지의 결정은 모두 문서로 옮긴 뒤 4단계를 시작합니다.
  1. **인계:** `docs/00-brainstorm.md`, 2단계 결과(1-A `docs/01-mvp-scope.md`, 2 `docs/01-concept.md`·`docs/01-feasibility.md`), `docs/02-glossary.md`, `docs/adr/`, `SPEC.md`를 프로젝트 폴더에 저장하고 커밋합니다(1-B는 `SPEC.md`만).
  2. **탐색:** `SPEC.md`는 요구사항 문서라 스킬 후보를 직접 알려 주지 않습니다. 기술 스택(`SPEC.md` 기술 스택 절·ADR)과 TASK 목록(`docs/tasks.md`)의 작업 종류·주차 일정으로 후보를 정합니다. 먼저 이미 설치된 스킬로 충분한지 확인하고, 비어 있는 영역만 AI 에이전트에서 `/find-skills`에 "`SPEC.md`의 기술 스택과 `docs/tasks.md`의 작업 종류 기준으로, 이미 설치된 스킬을 제외한 후보를 표로 나열하고 설치하지 마. 출처 저장소와 필요한 이유를 적어"라고 요청합니다. §4-1 목록에 있는 스킬은 그 목록을 우선합니다. 한꺼번에 설치하지 않고 해당 TASK에 들어가기 직전에 필요한 것만 설치합니다(스킬 설명은 매 세션 컨텍스트에 올라가고 비슷한 스킬은 잘못 호출될 수 있습니다). Hono·zod·TanStack Query 같은 라이브러리나 외부 API 문서는 스킬 대신 context7 MCP로 조회합니다. 결과는 일정 문서의 주차별 '스킬' 열에 기록합니다(구독컷: `docs/implementation-plan.md` §7.5).
  3. **검토:** 후보마다 원본 저장소·라이선스와 `SKILL.md` 본문·동봉 파일을 확인합니다(PART 3 §4-6 보안 검토, 점검 체크리스트 7번). 필요가 분명한 스킬만 고릅니다.
  4. **설치:** 고른 스킬만 프로젝트 폴더에서 `npx skills add <owner/repo> --skill <이름> -y`(`-g` 없이)로 설치합니다. `--skill`을 빼면 저장소의 모든 스킬이 설치됩니다. 설치 경로는 CLI 버전과 에이전트마다 다를 수 있으므로 `.agents/skills/`에 파일이, `.claude/skills/`에 연결이 생겼는지와 `skills-lock.json`이 갱신되었는지 확인합니다. 연결이 없으면 PART 3 §4-2의 방법으로 만듭니다. 출처가 없어 CLI로 설치할 수 없는 스킬은 `.agents/skills/`에 폴더째 복사하고 같은 방식으로 연결하되, 잠금 파일로 복원되지 않는 로컬 전용임을 기록합니다.
  5. **기록·확인:** 원본 저장소와 라이선스를 `README.md`의 Skills 표에(버전은 `skills-lock.json`), 설치 결정을 `docs/adr/`(1-A·1-B는 `README.md`)에 남기고, §3 ⑤ 방법으로 에이전트별 인식을 확인합니다.
  - 1-B는 현장에서 2~3을 할 시간이 없으므로 예상 스택 기준으로 사전 준비 때 같은 절차로 설치를 끝냅니다.

---

# PART 2. 하네스 엔지니어링 핵심 문서 설계 (`SPEC.md` & `AGENTS.md`)

## 1. 하네스 엔지니어링 개요

> 📌 **핵심 요약**
> 하네스 엔지니어링(Harness Engineering)은 단순히 `SPEC.md`와 `AGENTS.md`를 작성하는 데서 끝나지 않습니다. 두 문서로 구현 목표와 작업 규칙을 정의한 뒤, 실제 실행 환경 · 자동 테스트 · 보안 · 검증 · 피드백 루프까지 유기적으로 연결하는 작업입니다. 목표는 **AI가 잘못 구현했을 때 사람이 계속 설명하는 대신, 요구사항·환경·검증 도구를 통해 에이전트가 스스로 오류를 발견하고 수정하게 만드는 것**입니다.

- OpenAI가 공개한 하네스 엔지니어링 사례에서도 에이전트가 작업을 제대로 수행하지 못할 때 지시문(프롬프트)만 반복해서 수정하기보다, 에이전트가 활용할 도구, 프로젝트 구조, 검증 환경을 개선하는 접근을 강조합니다.
- 본 가이드는 Google Antigravity, Claude Code, OpenAI Codex를 함께 사용해 풀스택 프로젝트를 개발하는 상황을 기준으로 다루며, AI Agent 서비스를 직접 제작할 때의 런타임 하네스와는 구분됩니다.

## 2. 기준 문서 `SPEC.md` 준비 및 작성

`SPEC.md`는 개발 에이전트에게 무엇을 만들어야 하는지, 어디까지 구현해야 완료인지 알려주는 기준 문서입니다. 프로젝트 아이디어를 구체적인 기능과 검증 가능한 조건으로 변환하는 단계입니다.

### 2-0. `SPEC.md`의 생성 시점과 `docs/` 문서와의 관계

| 구분 | 생성 시점 | 원천 문서 |
| --- | --- | --- |
| 해커톤 (1-A) | 3단계 (기능 요구사항·데모 시나리오를 `SPEC.md`에 바로 작성) | `docs/01-mvp-scope.md` |
| 현장 해커톤 (1-B) | 1단계 (경량 템플릿) | 없음 (`SPEC.md`가 유일한 문서) |
| 일반 프로젝트 | 3단계 교차 검증 완료 시 확정 | `docs/01-concept.md`, `docs/02-requirements.md`, `docs/02-glossary.md` |

- `SPEC.md`가 생성된 뒤에는 `SPEC.md`가 요구사항의 유일한 기준입니다. `docs/`의 원천 문서는 결정 과정을 보여주는 이력 문서로 유지합니다.
- 요구사항이 바뀌면 `SPEC.md`를 먼저 수정하고, 필요하면 원천 문서에 변경 사유를 덧붙입니다. API 계약(§6)은 공통 기반 담당자가 수정합니다(PART 1 §3 ⑧).
- `SPEC.md`와 `docs/` 문서의 내용이 충돌하면 에이전트는 추측하지 않고 충돌을 보고합니다.

### 2-1. `SPEC.md` 필수 구성 항목 (6가지)

1. **프로젝트 개요와 목표:** 해결하려는 문제, 대상 사용자, 핵심 가치와 성공 기준 정의
2. **범위와 기능 요구사항:** 필수 기능, 선택 기능, 구현 제외 기능(Non-goals) 구분 및 중요 기능의 고유 ID·우선순위 부여. 데모·초기 버전에서 실제 연동 대신 샘플 데이터로 보여줄 부분은 Non-goals와 별도로 Mock 대상으로 표시
3. **완료 조건과 예외 상황:** 기능 성공 판단 조건, 예상 오류, 잘못된 입력 처리 방식 정의
4. **기술 스택과 시스템 설계:** 프런트엔드, 백엔드, DB, 외부 API, 인증 구조 등 확정된 기술과 제약 정리
5. **비기능 요구사항과 운영 제약:** 보안, 성능, 비용, 배포 환경, 컴퓨팅 자원 및 외부 서비스 제약 정리
6. **미확정 사항과 위험 요소:** 추가 조사·결정이 필요한 내용 분리 표시 (확인하지 않은 기술이나 API 동작을 확정된 사실처럼 작성 금지)

> 💡 **작성 팁**
> 간단한 프로젝트는 핵심 기능과 완료 조건만 구체화하고, 복잡한 풀스택 프로젝트는 데이터 모델과 API 계약까지 명시합니다. 여러 사람이 기능을 나눠 개발한다면 API 계약은 규모와 관계없이 명시합니다. 모든 요구사항은 실제로 테스트할 수 있는 형태로 작성해야 합니다(Anthropic 에이전트 평가 권장 사항).

### 2-2. 기능 요구사항을 구체적으로 작성하는 방법

단순히 `로그인 기능 구현`이라고만 적으면 에이전트가 로그인 버튼 UI만 만들고 완료했다고 판단할 수 있습니다. 아래처럼 요구사항과 완료 조건을 분리해 작성합니다.

| ID | 요구사항 | 완료 조건 |
| --- | --- | --- |
| FR-AUTH-01 | 정상적인 인증 정보로 로그인할 수 있다. | 인증에 성공하고 로그인 상태가 설정된다. |
| FR-AUTH-02 | 잘못된 인증 정보를 거부한다. | 인증이 실패하고 적절한 오류 응답을 반환한다. |
| FR-AUTH-03 | 보호된 API에 대한 접근을 통제한다. | 인증되지 않은 요청이 거부된다. |
| FR-AUTH-04 | 오류 상황을 사용자에게 안내한다. | UI에 적절한 오류 상태가 표시된다. |

### 2-3. `SPEC.md` 기본 템플릿

실제 요구사항에 없는 항목은 제외하고, 미확정 사항은 미확정으로 남겨둡니다.

```markdown
# SPEC.md

## 1. Project Overview
- 프로젝트 목적:
- 해결하려는 문제:
- 대상 사용자:
- 핵심 가치:

## 2. Goals, Non-goals, Mock
### Goals
- 반드시 달성해야 하는 목표:
### Non-goals
- 이번 범위에서 구현하지 않을 항목:
### Mock 대상 (해당 시)
- 실제 연동 대신 샘플 데이터로 보여줄 부분과 대체 방식:

## 3. User Scenarios
- 사용자 유형:
- 주요 이용 흐름:
- 예상되는 예외 상황:

## 4. Functional Requirements
### FR-001: [기능명]
- Description:
- Priority: Must / Should / Could
- Owner: (기능 담당자)
- Input:
- Expected output:
- Failure cases:
- Acceptance criteria:
- Verification method: (자동 테스트 / 화면·API 직접 확인)

### FR-002: [기능명]
- Description:
- Priority:
- Owner:
- Acceptance criteria:
- Verification method:

## 5. Technology and Architecture
- Frontend:
- Backend:
- Database:
- External APIs:
- Authentication:
- Deployment:
- Confirmed constraints:

## 6. Data and API Contracts (변경은 공통 기반 담당자가, 코드보다 먼저)
- 주요 데이터 모델:
- API 엔드포인트 및 입출력:
- 오류 응답 규격:
- 데이터 검증 규칙:

## 7. Non-functional Requirements
- Security:
- Performance:
- Reliability:
- Accessibility:
- Cost constraints:

## 8. Testing and Acceptance
- 핵심 테스트 시나리오:
- 필수 완료 조건:
- 성능 및 보안 검증:
- 최종 검수 기준:

## 9. Risks and Dependencies
- 외부 의존성:
- 예상 위험:
- 대응 방안:

## 10. Open Questions
- 아직 결정되지 않은 사항:
- 추가 조사가 필요한 사항:
```

### 2-4. `SPEC.md` 작성 및 검수 프롬프트 (세 에이전트 공통)

- 이미 `SPEC.md`가 존재한다면 새로 만들지 않고 아래 기준에 맞춰 누락 사항만 검토합니다.
- 워크플로우상 기본 작성 환경은 Antigravity이지만, 같은 프롬프트를 Claude Code와 Codex에서도 그대로 사용할 수 있습니다.

```markdown
# SPEC.md 작성 및 요구사항 검수

현재 프로젝트 아이디어와 제공된 자료(docs/ 폴더의 기획·요구사항 문서 포함)를 분석하여 SPEC.md를 작성하라.

## 목적
개발 에이전트가 구현해야 할 기능, 기술적 제약, 완료 조건을 명확하게 이해하고 검증할 수 있는 요구사항 명세서를 만든다.

## 조사 및 작성 항목
1. 해결하려는 문제와 대상 사용자
2. 프로젝트 목표, 비목표(Non-goals), Mock 대상
3. 사용자 시나리오
4. 기능 요구사항 및 우선순위
5. 기능별 성공 조건과 예외 상황
6. 기술 스택과 시스템 제약
7. 데이터 모델과 API 계약(해당하는 경우)
8. 보안, 성능, 신뢰성 요구사항
9. 비용, 외부 서비스 및 배포 환경의 제약
10. 미확정 사항과 위험 요소

## 작성 원칙
- 제공된 자료에서 확인된 사실과 추정을 분리한다.
- 확인되지 않은 기술 스택이나 API 동작을 지어내지 않는다.
- 중요한 기능마다 식별 ID를 부여한다.
- 핵심 기능의 완료 조건을 테스트할 수 있는 형태로 작성한다.
- 필수 기능과 선택 기능을 구분하고, 구현하지 않는 기능과 Mock으로 대체할 부분을 구분한다.
- 모순되거나 불명확한 요구사항은 명시한다.
- docs/ 원천 문서와 내용이 다르면 차이를 목록으로 보고한다.

먼저 요구사항의 누락과 충돌을 검토하고, 미확정 사항을 분리한 뒤 SPEC.md 초안을 작성하라.
초안을 검토할 수 있게 제시하고, 확인되지 않은 사항을 임의로 확정하지 마라.
```

## 3. 작업 규칙 `AGENTS.md` 작성 및 설계

### 3-0. 세 에이전트의 규칙 파일 로딩 방식

| 에이전트 | 읽는 파일 | 탐색 방식 | 크기 제한 |
| --- | --- | --- | --- |
| Antigravity | `AGENTS.md`, `GEMINI.md`, `.agents/rules/*.md` | 작업 중인 파일의 폴더에서 워크스페이스 루트까지 올라가며 각 단계의 규칙을 모두 합침. 충돌 시 더 구체적인(하위) 디렉터리 규칙이 우선 | 규칙 파일당 24KB, 항상 활성 규칙 합산 20,000토큰 |
| Claude Code | `CLAUDE.md` (`AGENTS.md`는 직접 읽지 않음) | 실행 디렉터리에서 상위로 올라가며 `CLAUDE.md`·`CLAUDE.local.md`를 읽음. `@경로`로 다른 파일 import | 명시적 상한 없음. 짧을수록 준수율이 높음 |
| Codex | `AGENTS.override.md` → `AGENTS.md` (디렉터리마다 앞의 것 우선) | 전역(`~/.codex`) → 저장소 루트 → 현재 디렉터리 순으로 합침 | 모든 지침 합산 기본 32KiB (`project_doc_max_bytes`) |

- **분량 기준:** 지나치게 긴 문서는 핵심 지침을 묻히게 하므로 `AGENTS.md`는 약 100줄 수준의 간결한 안내서로 유지하고, 상세 내용은 별도 참조 문서로 분리합니다. 바이트 기준으로는 Codex 합산 32KiB, Antigravity 파일당 24KB를 넘지 않아야 하며, 하위 디렉터리 `AGENTS.md`까지 합친 크기로 관리합니다.
- **Antigravity의 `AGENTS.md`:** frontmatter 없이 해당 디렉터리 범위에서 항상 활성(`always_on`) 상태로 적용됩니다.
- **Codex의 `AGENTS.override.md`:** 같은 폴더의 `AGENTS.md`보다 먼저 선택되므로, 개인이 임의로 만들면 팀 규칙이 조용히 덮어써집니다. PART 1 §3 ③의 원칙대로 원칙적으로 만들지 않습니다.
- **최소 요구사항 원칙 (실증 근거):** ICLR 2026 연구 「Evaluating AGENTS.md」에서 컨텍스트 파일은 전체적으로 작업 성공률을 높이지 못하면서 추론 비용을 20% 이상 늘렸습니다. 에이전트가 자동 생성한 파일(`/init` 등)은 성공률을 평균 약 3% 낮췄고, 개발자가 직접 쓴 파일만 약 4% 개선했습니다. 따라서 `AGENTS.md`에는 에이전트가 레포를 읽어도 알 수 없거나 틀리기 쉬운 정보만 적고, 디렉터리 개요처럼 레포에서 바로 확인되는 내용이나 에이전트가 원래 하는 일반 행동은 적지 않습니다.

### 3-1. `AGENTS.md` 포함 항목 및 5대 작성 원칙

| 항목 | 작성 내용 |
| --- | --- |
| 프로젝트 개요 | 목적, 레포에서 알 수 없는 제약, 기준 문서 위치 |
| 기준 문서 (Source of Truth) | `SPEC.md`, 아키텍처 문서, 테스트 문서 간 역할 정의 |
| 작업 진행 규칙 | 세션 시작·전환 절차(진행 상태 파일), 복잡한 작업의 사전 계획 수립 |
| 협업·아키텍처 규칙 | 기능 브랜치, 공통 파일 담당, API 계약 변경 순서, 반드시 지켜야 하는 구조적 제약 |
| Skills 활용 원칙 | 작업에 맞는 스킬만 선택, 원본 경로 명시, 중복 지침 방지 (단계별 스킬 목록은 PART 1 §4) |
| 다중 에이전트 호환 | 공통 규칙 단일화, 에이전트별 설정 분리, override 파일 금지 |
| 보안 및 권한 | 비밀정보 관리, 위험한 DB 작업 및 배포 승인 |
| 검증 방법 | 실제 프로젝트에서 확인한 단일 `verify` 명령 |
| 완료 보고 | 변경 내용, 검사 결과, 공통 파일·계약 변경, 실패 및 남은 위험 보고 양식 |

**작성 시 지켜야 할 5가지 원칙**

1. **`SPEC.md`를 복사하지 않는다:** 기능 요구사항은 `SPEC.md`에 두고, `AGENTS.md`에는 구현 시 항상 지켜야 할 작업 규칙만 적습니다.
2. **기존 Skills의 상세 절차를 복제하지 않는다:** 체크리스트 전체를 복사하는 대신, 해당 작업 시 관련 Skill을 호출하도록 규정합니다.
3. **실제 프로젝트에서 확인한 정보만 확정적으로 작성한다:** 테스트 명령어, 디렉터리, 기술 스택은 저장소를 실제 조사한 결과를 기반으로 적습니다. (별도의 제출용 JSON 파일을 만들 필요는 없으며, 기존의 `package.json` 등을 조사에 활용합니다.)
4. **자동 강제 가능한 규칙은 자동 검증과 연결한다:** 문서에 적어두는 것에 그치지 않고 린터(Linter), API 스키마 검사, 테스트와 연결합니다. 린터·테스트로 강제되는 규칙은 `AGENTS.md`에서 지웁니다.
5. **레포에서 알 수 없는 것만 남긴다:** 각 줄마다 "이 줄이 없으면 에이전트가 틀리는가?"를 묻고, 아니라면 지웁니다. 에이전트가 만든 초안은 사람이 이 기준으로 줄인 뒤 커밋합니다(§3-0 최소 요구사항 원칙).

### 3-2. `AGENTS.md` 기본 템플릿

- `<VERIFY_COMMAND>`는 PART 3 §3-2에서 정한 실제 검증 명령(예: `npm run verify`)으로 바꿉니다.
- 다른 `<...>` 자리표시자는 실제 레포 고유 내용으로 바꾸고, 해당 내용이 없으면 줄째 지웁니다. 에이전트가 원래 하는 일반 행동(코드 읽기, 작은 단위 변경 등)은 템플릿에서 뺐습니다(§3-1 원칙 5).
- 1-B 현장 해커톤은 `docs/progress.md`와 `docs/03-plan.md`의 담당 표 대신 `SPEC.md` 5절을, API 계약은 `SPEC.md` 4절을 가리키도록 바꿉니다.

```markdown
# AGENTS.md

## 1. Project Overview
- Read SPEC.md before implementing features.
- <One-line project purpose and constraints not discoverable from the repo, e.g., deployment target, supported browsers>

## 2. Source of Truth
- SPEC.md defines functional requirements and acceptance criteria.
- docs/ planning files are history; SPEC.md wins once it exists.
- Architecture documentation defines system boundaries and dependencies.
- Tests and configuration files provide executable verification rules.
- If documents conflict, report the conflict instead of guessing.

## 3. Working Procedure
- At session start, read docs/progress.md and the recent git log, then run <VERIFY_COMMAND>.
- Start a fresh session for an independent task, a handoff, or when the context gets crowded; update docs/progress.md and commit first. Keep small follow-up fixes in the same session.
- Never delete tasks or change acceptance criteria in docs/progress.md; ask a human.
- Plan multi-file, architectural, API, or database changes before implementation.
- Preserve existing user changes.
- Report critical ambiguities rather than inventing requirements.

## 4. Collaboration and Architecture Rules
- Work on a feature branch (feat/<feature-id>-<name>); never commit directly to main.
- Shared files listed in the owner table of docs/03-plan.md are changed only by their owner; otherwise stop and report.
- Change the API contract in SPEC.md §6 (or api/openapi.yaml) before changing code that depends on it.
- <Repository-specific boundaries only, e.g., frontend/ must not import from database/>
- <Rules already enforced by linters or tests do not belong here; verify checks them>
- Update relevant documentation and tests when contracts change.

## 5. Skills Usage
- Use relevant installed Skills when the task matches their scope.
- Do not execute every available Skill for every task.
- Do not duplicate entire Skill instructions in this file.
- The source of project Skills is .agents/skills/.
- .claude/skills/ holds links to .agents/skills/; never edit skills through it.
  Skill files are not committed; skills-lock.json records their sources.
  Never run `npx skills remove -g` (it can delete project skills).
- Do not install new Skills or MCP servers yourself; propose them for human review.
- Before claiming any task is complete, use the verification-before-completion skill.
- The "## Agent skills" block created by setup-matt-pocock-skills belongs in this file, not in CLAUDE.md.

## 6. Multi-Agent Compatibility
- This file is the single source of shared rules for Antigravity, Claude Code, and Codex.
- CLAUDE.md only imports this file and adds Claude-specific rules.
- Do not create GEMINI.md or AGENTS.override.md without team review.
- Keep agent-specific settings in their own configuration files.
- Do not assume that one agent's hooks, rules, or permissions
  automatically apply to other agents.

## 7. Security and Permissions
- Never commit secrets, credentials, or private keys.
- Follow the project's environment-variable conventions.
- Do not modify production data or deploy to production without required approval.
- Treat destructive commands as high-risk operations.

## 8. Verification
- Run <VERIFY_COMMAND> as the single verification entry point.
- Run relevant tests during implementation, and the full verify before completion.
- Check user-facing behavior in the running app or API, not only static checks.
- Never claim a check succeeded without execution evidence.
- Report any check that failed or could not be executed, separately.

## 9. Completion Report
Report:
1. Changes made and their purpose.
2. Important files modified.
3. Verification commands actually executed and their results.
4. Behavior checked in the running app or API.
5. Shared files or API contract changed, and who must be notified.
6. Remaining issues and risks.
7. Required approvals or manual actions.
```

### 3-3. `CLAUDE.md` 기본 템플릿

- `@AGENTS.md`는 코드 블록이나 인라인 코드 밖의 일반 줄에 적어야 합니다. Claude Code는 코드 스팬과 코드 블록 안의 import는 처리하지 않습니다.
- Windows에서는 심볼릭 링크에 관리자 권한이나 개발자 모드가 필요하므로, 심볼릭 링크 대신 import 방식을 사용합니다.
- 작성 후 새 세션에서 `/context`로 로딩 여부를 확인합니다.
- 아래 내용을 그대로 `CLAUDE.md` 파일에 저장합니다(파일 안에서는 코드 블록 없이 작성).

```markdown
@AGENTS.md

## Claude Code
- .claude/skills/ links to .agents/skills/ (the source); do not edit skills here.
- Use Plan mode for multi-file or architectural changes and wait for approval.
- Personal preferences belong in CLAUDE.local.md (git-ignored), not in this file.
- Use /clear for an independent task or a handoff after updating docs/progress.md; keep small follow-up fixes in the same session.
```

### 3-4. `AGENTS.md` 작성 프롬프트 (세 에이전트 공통)

```markdown
# AGENTS.md 작성 및 프로젝트 하네스 설계

현재 프로젝트의 SPEC.md와 실제 저장소 구조를 조사하고, Antigravity, Claude Code, Codex가 공통으로 사용할 프로젝트 AGENTS.md를 작성하라.

## 조사 대상
- SPEC.md 및 README.md
- 디렉터리 구조와 실제 기술 스택
- 의존성 및 빌드 설정 파일
- 프런트엔드, 백엔드, 데이터베이스 구조
- 기존 테스트·린트·타입 검사·빌드 설정과 verify 명령
- 환경 변수 예시 및 DB 마이그레이션
- 기존 규칙 파일: AGENTS.md, AGENTS.override.md, CLAUDE.md, CLAUDE.local.md, GEMINI.md, .agents/rules/
- 에이전트 설정: .claude/settings.json, .codex/config.toml, .mcp.json(MCP 서버)
- 진행 상태 파일: docs/progress.md 존재 여부와 형식
- 협업 구조: docs/03-plan.md의 기능·공통 파일·병합 담당 표, 브랜치 규칙
- 설치된 Skills(.agents/skills/, .claude/skills/)의 이름, 역할, 두 경로의 일치 여부
- 레거시 .agents/workflows/ 존재 여부
- CI/CD 설정 및 Git 상태

## 작성할 내용
1. 프로젝트 개요와 기준 문서
2. 세션 시작·전환 절차(진행 상태 파일 읽기·갱신)
3. 계획 수립과 변경 범위 관리
4. 협업 규칙(기능 브랜치, 공통 파일 담당, API 계약 변경 순서)과 아키텍처 규칙
5. Skills 선택과 사용 원칙(원본 경로 포함)
6. 다중 에이전트 호환 규칙
7. 비밀정보·DB 변경·배포에 관한 보안 규칙
8. 실제 저장소에서 확인한 verify 명령과 실제 동작 확인 방법
9. 오류 수정 및 완료 보고 원칙

## 엄격한 작성 규칙
- SPEC.md의 기능 요구사항을 그대로 복사하지 않는다.
- 기존 Skills의 상세 지침을 중복해서 작성하지 않는다.
- 존재하지 않는 파일, 명령어, 기술 스택을 만들어 내지 않는다.
- 확인되지 않은 사항은 미확정으로 표시한다.
- 불필요한 장문보다 실제 작업에 영향을 주는 규칙을 우선한다(약 100줄, 32KiB 이내).
- 에이전트가 기본으로 따르는 일반 원칙(코드를 먼저 읽기, 작은 단위로 변경 등)과 레포에서 바로 확인되는 정보(디렉터리 개요, 의존성 목록 등)는 적지 않는다.
- 린터·테스트·verify로 이미 강제되는 규칙은 적지 않는다.
- 초안의 각 규칙 옆에 "이 줄이 없으면 에이전트가 틀릴 수 있는 이유"를 한 줄로 표시한다(검토용, 최종 파일에는 남기지 않음).
- 기존 파일과 사용자 변경 사항을 보존한다.
- 다른 규칙 파일과 충돌하는 내용이 있으면 목록으로 보고한다.

먼저 조사 결과와 AGENTS.md 초안(필요 시 CLAUDE.md 초안 포함)을 제시하라. 초안을 검토하기 전에는 기존 파일을 덮어쓰거나 다른 파일을 수정하지 마라.
```

초안은 사람이 §3-1 원칙 5로 줄인 뒤 커밋합니다. 에이전트가 쓴 초안을 그대로 커밋하지 않습니다(§3-0 최소 요구사항 원칙).

## 4. `SPEC.md`와 `AGENTS.md`의 역할 분담 및 관계

두 문서와 주변 도구의 위계 및 역할은 다음과 같이 명확히 분리되어야 합니다.

- **`SPEC.md`:** 무엇을 구현해야 하는가? (요구사항 · 사용자 흐름 · 완료 기준 · API 계약)
- **`AGENTS.md`:** 어떤 규칙을 지키며 작업해야 하는가? (작업 규칙 · 협업 규칙 · 아키텍처 제약 · 검증 원칙)
- **Skills 및 실행 도구:** 어떻게 특정 작업을 수행하는가? (단계별 작업 절차 · 테스트 · 코드 리뷰 · 보안 검사)
- **실제 검증 결과:** 제대로 구현되었는가? (통과한 테스트 · 실제 동작 확인 · 실패 원인 · 남은 문제)

| 구성 요소 | 역할 |
| --- | --- |
| `SPEC.md` | 구현할 기능과 완료 기준, API 계약 |
| `AGENTS.md` | 세 에이전트가 공유할 프로젝트 공통 규칙 |
| `CLAUDE.md` | `@AGENTS.md` import 및 Claude Code 전용 지침 (내용 복제 금지) |
| `.agents/rules/` | Antigravity 전용 세부 규칙 (frontmatter 필수) |
| Skills (`.agents/skills/` 원본) | 특정 작업을 수행하는 단계별 절차 |
| 에이전트별 설정 | 각 도구의 권한, 샌드박스, Hooks 등 전용 기능 |
| `verify` 명령 | 테스트·빌드 등 공통 검증 실행 (OS 무관 단일 진입점) |
| CI 및 Evals | 반복 검증과 품질 측정 |
| `docs/03-plan.md` 담당 표 | 기능·공통 파일·병합 담당 (PART 1 §0-1) |
| `docs/progress.md` | 세션 간 진행 상태와 Task 통과 여부 (PART 1 §3 ⑦) |
| MCP 서버 | 브라우저·DB·이슈 트래커 등 외부 시스템 접근 도구 (PART 3 §9) |

---

# PART 3. 하네스 환경 진단 및 구축 실무

## 1. 현재 프로젝트의 하네스 상태 진단

문서가 준비되었다면 곧바로 도구를 추가하기 전에, 현재 프로젝트에 어떤 환경이 존재하고 무엇이 부족한지 먼저 진단합니다.

### 1-1. 12대 진단 영역 및 분류 기준

| 영역 | 확인할 내용 |
| --- | --- |
| 1. 프로젝트 구조 | 프런트엔드·백엔드·DB가 실제로 구성되어 있는가? |
| 2. 실행 환경 | 의존성 설치와 개발 서버 실행이 가능한가? 다른 팀원이 새로 clone해 같은 결과를 얻는가? |
| 3. 환경 변수 | `.env.example`, `.gitignore` 및 비밀정보 관리가 준비되어 있는가? |
| 4. 테스트 | 테스트·린트·타입 검사·빌드 명령과 단일 `verify` 진입점이 존재하는가? |
| 5. DB | 스키마·마이그레이션·개발용 초기 데이터 생성 절차가 있는가? |
| 6. 규칙 | `AGENTS.md`의 규칙 중 자동 검사할 수 있는 항목이 있는가? |
| 7. Skills | 기존 Skills가 인식되고, 필요한 작업에서 활용되는가? 두 경로가 일치하는가? 외부 스킬의 출처와 고정 커밋이 기록되어 있는가? |
| 8. 자동화 | GitHub Actions 등에서 검증을 재실행할 수 있는가? |
| 9. 보안 | 위험한 명령이나 실제 배포에 대한 권한 통제가 있는가? MCP 서버의 권한과 비밀값 관리가 적절한가? |
| 10. 관측성 | 오류 로그와 검증 결과를 확인할 수 있는가? 세션 간 진행 상태를 `docs/progress.md`로 확인할 수 있는가? |
| 11. 다중 에이전트 정합성 | 세 에이전트 모두 같은 공통 규칙을 읽는가? `GEMINI.md`·`AGENTS.override.md`·개인 전역 규칙과의 충돌이나 레거시 `.agents/workflows/`가 남아 있지 않은가? |
| 12. 협업 구조 | 기능·공통 파일·병합 담당이 기록되어 있는가? 기능 브랜치, worktree, API 계약 변경 절차가 정해져 있고 실제로 지켜지는가? |

**상태 분류 기준 (5단계):** 확인 완료 / 구성되어 있으나 검증 필요 / 미구성 / 프로젝트 특성상 불필요 / 자료 부족으로 판단 불가

### 1-2. 하네스 상태 진단 프롬프트 (세 에이전트 공통)

```markdown
# 현재 하네스 환경 진단

현재 프로젝트에는 SPEC.md와 AGENTS.md가 준비되어 있고, 필요한 Skills 및 작업 워크플로우도 구성되어 있다.
추가 Skills를 설치하거나 새로운 파일을 만드는 대신, 현재 하네스 환경을 먼저 진단하라.

## 조사 항목
1. 프로젝트 디렉터리 구조와 실제 기술 스택
2. 의존성 설치, 개발 서버 실행 및 빌드 가능 여부
3. 프런트엔드·백엔드·데이터베이스 구성
4. 환경 변수와 비밀정보 관리
5. 테스트·린트·타입 검사·빌드 설정, verify 진입점 및 실제 실행 결과
6. SPEC.md의 요구사항을 검증할 방법
7. AGENTS.md와 Skills의 역할 및 중복 여부
8. DB 초기화·마이그레이션 절차
9. Git 상태, CI/CD, 로그 및 오류 확인 환경, 진행 상태 파일(docs/progress.md)
10. 위험한 명령·배포 작업·MCP 서버에 대한 권한 통제
11. 다중 에이전트 정합성: CLAUDE.md의 @AGENTS.md import, GEMINI.md·AGENTS.override.md 존재 여부,
    .agents/rules/ frontmatter, .agents/skills/와 .claude/skills/ 일치 여부, 레거시 .agents/workflows/
12. 협업 구조: 기능·공통 파일·병합 담당 기록, 브랜치 구성, 공통 파일의 최근 변경자, API 계약과 코드의 불일치

## 조사 원칙
- 실제 파일과 설정을 확인한다.
- 확인한 사실과 추정 사항을 구분한다.
- 안전한 검사 명령은 실제로 실행하고 결과를 보고한다.
- 테스트를 실행하지 않고 성공으로 간주하지 않는다.
- 기존 사용자 변경 사항을 보존한다.
- 파괴적인 DB 작업과 운영 배포는 수행하지 않는다.
- 추가 Skills 설치는 제안하지 않는다.

## 결과 형식
각 항목을 다음 상태로 분류하라: [확인 완료 / 구성되어 있으나 검증 필요 / 미구성 / 프로젝트 특성상 불필요 / 판단 불가]
각 항목의 근거, 영향도, 우선순위, 필요한 조치를 제시하고, 반드시 해결해야 할 문제부터 순서대로 개선 계획을 작성하라.
이 단계에서는 파일을 수정하지 마라.
```

## 2. 재현 가능한 실행 환경 구축

사람이나 에이전트가 프로젝트를 다시 실행할 때 환경 설정 문제로 막히지 않도록 재현성을 확보합니다. 목표는 **같은 도구가 아니라 같은 실행 결과**입니다.

| 맞춰야 하는 것 | 달라도 되는 것 |
| --- | --- |
| 런타임 버전, 패키지 관리자, 잠금 파일 | 편집기, 운영체제 |
| 환경 변수 이름과 의미 | 개인 API 키 |
| DB 스키마·마이그레이션·샘플 데이터 | 개인 개발 DB 주소 |
| 실행·검증 명령, API 계약 | 사용하는 AI 에이전트·요금제 |

**완료 기준:** 다른 팀원이 저장소를 새로 clone해 `README.md`대로 설치한 뒤, 샘플 데이터로 실행하고 같은 `verify` 명령을 통과할 수 있다.

| 구성 요소 | 준비 방법 | 완료 기준 |
| --- | --- | --- |
| 런타임·의존성 | 런타임 버전 고정(`.nvmrc`, `.python-version`, `package.json`의 `engines` 등), 패키지 관리자 및 잠금 파일(Lockfile) 확인 | 동일한 버전과 의존성을 다시 설치할 수 있음 |
| 실행 절차 | `README.md`에 설치·실행·`verify` 명령 작성 | 안내된 절차만으로 프로젝트 실행 가능 |
| 환경 변수 | `.env.example`에 필요한 변수명과 의미 작성 | 필수 설정을 파악할 수 있음 |
| 비밀정보 보호 | `.gitignore`와 비밀정보 관리 설정 | 실제 키와 인증 정보가 Git에 노출되지 않음 |
| 개인 설정 제외 | `.gitignore`에 `CLAUDE.local.md`, `.claude/settings.local.json` 추가 | 개인 설정이 팀 저장소에 섞이지 않음 |
| 데이터베이스 | 스키마·마이그레이션·샘플 데이터(seed)·초기화 절차 정리 | 개발용 DB를 같은 상태로 재현할 수 있음 |
| 실행 확인 | 서버 상태나 핵심 화면을 확인하는 절차 준비 | 정상 실행 여부를 판별할 수 있음 |

`.env.example` 작성 예시: 실제 값은 로컬 환경이나 비밀정보 관리 시스템에서 설정하고, 예시 구조만 제공합니다.

```bash
# 실제 값은 로컬 환경이나 비밀정보 관리 시스템에서 설정한다.
DATABASE_URL=
API_KEY=
```

`.gitignore` 추가 예시:

```gitignore
.env
.env.*
!.env.example
CLAUDE.local.md
.claude/settings.local.json
```

**진행 순서:** 패키지 설정 및 스크립트 확인 → 의존성 설치 및 서버 실행 → 실패 시 원인 해결 및 `README.md` 갱신 → 다른 팀원의 컴퓨터(다른 OS 포함)에서 새로 clone해 완료 기준 확인 → 개발·테스트·운영 환경 및 비밀정보 분리.

처음부터 Docker나 Dev Container를 도입할 필요는 없습니다. 위 절차로 해결되지 않는 환경 차이가 반복될 때 도입하고, 결정을 `docs/adr/`에 기록합니다.

## 3. 자동 검증 체계 구축 및 규칙 강제

**다중 에이전트 공통 검증 원칙**

- 세 에이전트와 CI가 동일한 `verify` 명령 하나를 실행하도록 합니다.
- 검증 명령은 실제 프로젝트 설정을 기준으로 구성합니다.
- 검증 성공 여부는 에이전트의 설명이나 다른 모델의 동의가 아니라 실행 결과로 판정합니다(PART 1 §3 ①).
- 실패한 검사와 미실행 항목을 구분합니다.
- 로컬 검증과 CI가 같은 핵심 검증 절차를 사용하도록 구성합니다.

### 3-1. 단계별 검증 항목

| 검증 단계 | 확인하는 내용 | 적용 조건 |
| --- | --- | --- |
| 정적 검사 (Lint) | 코드 스타일, 잘못된 패턴 | 적절한 린터가 존재할 때 |
| 타입 검사 (Typecheck) | 타입·인터페이스 일관성 | 타입 검사를 사용하는 프로젝트 |
| 단위 테스트 (Unit) | 개별 함수와 모듈의 정확성 | 테스트 가능한 로직이 있을 때 (1-B는 핵심 로직만) |
| 통합 테스트 (Integration) | API·DB 등 구성 요소 사이의 연동 | 외부 구성 요소와 연동할 때 |
| 빌드 검사 (Build) | 결과물이 정상적으로 생성되는지 | 빌드 단계가 있을 때 |
| E2E 테스트 | 핵심 사용자 흐름이 실제로 동작하는지 | 웹·앱 사용자 흐름이 있을 때 (1-A·1-B는 스모크 테스트로 대체 가능) |
| 보안 검사 | 인증·인가, 비밀정보, 의존성 문제 | 위험도와 기술 스택에 맞게 선택 |
| 하네스 정합성 검사 | Skills 동기화, 규칙 파일 크기, rules frontmatter | 세 에이전트를 함께 쓸 때 |

### 3-2. 통합 검증 명령(`verify`) 구성 조건

- 지원하는 검사 항목을 OS와 무관한 하나의 실행 진입점으로 묶습니다. 팀원의 OS(Windows/macOS/Linux)와 GitHub Actions 기본 러너(Ubuntu)가 같은 명령을 실행할 수 있어야 합니다.
- 진입점 이름은 `verify`로 고정하고, 구현 방식은 프로젝트 스택에 맞게 하나만 선택합니다.

| 스택 | 진입점 예시 | 비고 |
| --- | --- | --- |
| Node.js 중심 | `npm run verify` (`package.json`의 `scripts.verify`) | 내부에서 `node scripts/verify.mjs` 등 호출 |
| Python 중심 | `python scripts/verify.py` | Windows·macOS·Linux 공통 |
| 혼합·기타 | `just verify` 또는 `make verify` | Windows 팀원은 도구 설치 필요 여부를 README에 명시 |

`.ps1`·`.sh`를 따로 두어야 한다면 진입점 내부 구현으로만 사용하고, `README.md`와 `AGENTS.md`에는 위 진입점 명령 한 줄만 적습니다.

```text
verify
├── lint
├── typecheck
├── unit tests
├── integration tests
├── build
└── harness checks (skills sync, 규칙 파일 크기)
```

- 실패 시 명확한 실패 상태(Exit code)와 실패 단계를 반환해야 합니다.
- 불필요한 대화형(Interactive) 입력을 요구하지 않아야 합니다.
- 운영 데이터나 외부 서비스에 위험한 변경을 가하지 않고, 동일한 코드에서 일관된 결과를 내야 합니다.
- `SPEC.md`의 요구사항(예: 정상 로그인, 잘못된 인증 거부, 비인가 접근 차단, UI/API 예외 처리)이 실제 테스트 실행으로 판별되어야 합니다.

### 3-3. 문서의 규칙을 자동으로 강제하기

`AGENTS.md`에 텍스트로만 적어두는 대신, 위반 시 영향이 큰 규칙부터 자동 검사로 전환합니다.

| 문서상의 규칙 | 자동화 강제 예시 |
| --- | --- |
| 잘못된 데이터 형식을 허용하지 않는다 | 타입 검사 · 입력 스키마 검증 (Zod, Pydantic 등) |
| 프런트엔드가 DB에 직접 접근하지 않는다 | 모듈 경계 검사(커스텀 린터) · 코드 리뷰 |
| API 계약을 유지한다 | API 스키마 검증(`openapi.yaml`) · 통합 테스트 |
| DB 변경을 마이그레이션으로 관리한다 | 마이그레이션 상태 검사 |
| 공통 파일은 담당자만 수정한다 | GitHub `CODEOWNERS` + 브랜치 보호 규칙(필수 리뷰어) |
| `main`에 직접 커밋하지 않는다 | 브랜치 보호 규칙 (PR 필수, CI 통과 필수) |
| 비밀정보를 코드에 포함하지 않는다 | `.gitignore` · 시크릿 스캐닝 검사 |
| 빌드가 성공해야 한다 | 빌드 명령을 검증 루프에 포함 |
| 커밋 전에 포맷·타입 검사·테스트를 통과한다 | pre-commit 훅 (Node 스택은 `setup-pre-commit` 스킬로 구성하고, 훅에서 `verify` 또는 그 일부를 호출. PART 1 §4-3 ⑤) |
| 스킬 파일은 커밋하지 않고 `skills-lock.json`만 커밋한다 | `git ls-files .agents/skills .claude/skills`가 비어 있는지 확인(복사 방식이면 `python scripts/sync_skills.py --check`) |
| 규칙 파일을 간결하게 유지한다 | `AGENTS.md` 합산 크기 32KiB 이하 검사 |
| Antigravity rules는 frontmatter를 갖춘다 | `.agents/rules/*.md` 첫 줄 `---` 및 `trigger` 값 검사 |

## 4. 기존 Skills와 워크플로우 검증

새로운 스킬을 무분별하게 추가하기보다, 현재 설치된 스킬이 제대로 인식되고 실제 작업에서 작동하는지 확인합니다.

### 4-1. 에이전트별 Skills 경로

| 에이전트 | 프로젝트 Skills 경로 | 개인(전역) Skills 경로 |
| --- | --- | --- |
| Antigravity | `.agents/skills/<이름>/SKILL.md` (레거시 `.agent/skills/`도 호환) | 제품별로 다름 (아래 표) |
| OpenAI Codex | `.agents/skills/<이름>/SKILL.md` (현재 디렉터리부터 저장소 루트까지 탐색) | `$HOME/.agents/skills/<이름>/SKILL.md` |
| Claude Code | `.claude/skills/<이름>/SKILL.md` | `~/.claude/skills/<이름>/SKILL.md` |

Antigravity 전역 Skills 경로 (2026-10-29 확인, 제품·버전에 따라 다름):

| Antigravity 제품 | 공식 문서의 전역 경로 |
| --- | --- |
| Antigravity App (2.0) | `~/.gemini/config/skills/<이름>/SKILL.md` |
| Antigravity IDE | `~/.gemini/antigravity/skills/<이름>/SKILL.md` |
| Antigravity CLI (`agy`) | `~/.gemini/antigravity-cli/skills/<이름>/` |

- Google 코드랩은 `~/.gemini/config/skills/`가 모든 Antigravity 제품에서 보인다고 안내하지만, CLI 문서는 별도 경로를 안내합니다. 전역 스킬을 쓰는 팀원은 사용하는 제품과 버전을 `README.md`에 함께 적고, `/스킬명` 호출로 실제 인식 여부를 확인합니다(PART 1 §3 ⑤).
- 프로젝트 공유 스킬은 제품과 관계없이 `.agents/skills/`에 두므로, 이 차이는 개인 전역 스킬에만 영향을 줍니다.
- **개인 전역 경로에는 `find-skills`만 둡니다**(PART 1 §4-3 ④). Claude Code는 같은 이름의 스킬이 개인 경로와 프로젝트 경로에 모두 있으면 개인 스킬을 우선 적용하므로, 전역에 남은 옛 버전이 프로젝트에 설치(`skills-lock.json`으로 고정)한 버전을 조용히 덮어쓸 수 있습니다. 기획 1~3단계 스킬은 이 경로가 아니라 Claude·Gemini 데스크톱 앱에 따로 등록합니다.
- 세 도구 모두 공개 표준인 Agent Skills(agentskills.io) 형식을 따르므로 `SKILL.md` 하나를 그대로 공유할 수 있습니다. `name`과 `description` frontmatter는 필수이며, `description`에는 무엇을 하는지와 언제 사용하는지를 함께 적습니다.

### 4-2. 단일 원본 + 링크·복원 정책

- **원본:** `.agents/skills/` (Antigravity와 Codex가 직접 읽음)
- **Claude Code용:** `.claude/skills/<이름>`은 원본 폴더를 가리키는 링크입니다. Windows는 Junction(관리자 권한 불필요, 구독컷에서 확인), macOS·Linux는 심볼릭 링크를 씁니다. 복사본이 아니므로 동기화가 필요 없고 내용이 어긋나지 않습니다. `npx skills add`가 자동으로 만듭니다.
- **커밋하지 않는 것:** `.agents/skills/`와 `.claude/skills/`는 `.gitignore`로 제외합니다. 서드파티 스킬은 MIT·Apache-2.0 등 각자의 라이선스에 따라 재배포할 때 저작권·라이선스 고지 의무가 있는데 스킬 폴더에 라이선스 파일이 없는 경우가 많기 때문입니다. 대신 출처와 해시를 담은 `skills-lock.json`만 커밋합니다. 라이선스 확인은 법률 자문이 아니므로, 공개 저장소이거나 사업화할 계획이면 각 스킬의 라이선스를 직접 확인합니다.
- **복원:** clone하거나 새 PC에서는 프로젝트 폴더에서 `npx skills experimental_install`을 실행해 `.agents/skills/`를 복원합니다(임시 폴더에서 12개 복원을 확인). 이 명령은 `.claude/skills/` 연결을 만들지 않으므로 이어서 직접 만듭니다. PowerShell 예: `New-Item -ItemType Directory -Force .claude\skills | Out-Null; Get-ChildItem .agents\skills -Directory | ForEach-Object { New-Item -ItemType Junction -Path ".claude\skills\$($_.Name)" -Target $_.FullName | Out-Null }`. macOS·Linux는 `ln -s`를 씁니다. 만든 뒤 새 대화에서 슬래시 명령으로 인식 여부를 확인합니다(PART 1 §3 ⑤).
- **출처가 없는 스킬**은 잠금 파일로 복원되지 않는 로컬 전용입니다. 출처를 찾아 `npx skills add`로 재설치해 잠금 파일에 올리거나, 다른 PC에서 쓰려면 폴더째 복사합니다. 라이선스를 확인하기 전에는 커밋하지 않습니다.
- 개인 전역 경로(`~/.claude/skills/`)에는 `find-skills`만 두고, 프로젝트 스킬과 이름이 겹치는 스킬은 두지 않습니다(§4-1).
- **복사 스크립트(`sync_skills.py`)는 링크를 만들 수 없는 환경의 대안입니다.** 이 경우 `.claude/skills/`는 덮어써지므로 직접 수정하지 않고, CI에서 `--check`로 두 폴더의 일치 여부를 검사합니다. 구독컷은 링크 방식을 쓰므로 이 스크립트가 없습니다.
- 스크립트는 자기 위치를 기준으로 저장소 루트를 계산하므로 어느 폴더에서 실행해도 같은 경로를 다룹니다. 사본에만 있는 파일(도구나 팀원이 만든 파일)이 있으면 삭제하지 않고 중단해 목록을 보여줍니다. 확인 후 원본이나 개인 경로로 옮기거나, 지워도 되면 `--force`로 실행합니다.

`scripts/sync_skills.py` 예시:

```python
#!/usr/bin/env python3
"""`.agents/skills/`(원본)를 `.claude/skills/`(사본)로 동기화한다.

사용법:
  python scripts/sync_skills.py           # 동기화 (사본에만 있는 파일이 있으면 중단)
  python scripts/sync_skills.py --check   # 불일치 시 exit 1 (CI·verify용)
  python scripts/sync_skills.py --force   # 사본에만 있는 파일까지 지우고 동기화
"""
import filecmp
import shutil
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent  # scripts/의 상위 = 저장소 루트
SRC = ROOT / ".agents" / "skills"
DST = ROOT / ".claude" / "skills"


def differs(a: Path, b: Path) -> bool:
    if not b.is_dir():
        return True
    cmp = filecmp.dircmp(a, b)
    if cmp.left_only or cmp.right_only or cmp.funny_files:
        return True
    _, mismatch, errors = filecmp.cmpfiles(a, b, cmp.common_files, shallow=False)
    if mismatch or errors:
        return True
    return any(differs(a / d, b / d) for d in cmp.common_dirs)


def copy_only_items(src: Path, dst: Path) -> list[Path]:
    """원본에 없고 사본에만 있는 최상위 항목(파일·폴더) 목록."""
    if not dst.is_dir():
        return []
    items = []
    for path in sorted(dst.rglob("*")):
        rel = path.relative_to(dst)
        if not (src / rel).exists() and (src / rel.parent).exists():
            items.append(rel)
    return items


def main() -> None:
    if not SRC.is_dir():
        sys.exit(f"원본 경로가 없습니다: {SRC}")

    if "--check" in sys.argv:
        if differs(SRC, DST):
            sys.exit("Skills 불일치: python scripts/sync_skills.py 실행 후 커밋하세요.")
        print("Skills 동기화 상태 정상")
        return

    extras = copy_only_items(SRC, DST)
    if extras and "--force" not in sys.argv:
        print("사본(.claude/skills/)에만 있는 항목이 있어 동기화를 중단합니다:")
        for rel in extras[:30]:
            print(f"  - {rel}")
        if len(extras) > 30:
            print(f"  ... 외 {len(extras) - 30}개")
        sys.exit(
            "필요한 스킬은 .agents/skills/(프로젝트 원본)로 옮긴 뒤 다시 실행하세요.\n"
            "지워도 되는 항목이면 --force로 실행하세요."
        )

    if DST.exists():
        shutil.rmtree(DST)
    shutil.copytree(SRC, DST)
    print(f"{SRC.relative_to(ROOT)} -> {DST.relative_to(ROOT)} 동기화 완료")


if __name__ == "__main__":
    main()
```

### 4-3. 점검 체크리스트

1. Skills 디렉터리에 파일이 실제로 존재하는가?
2. 각 `SKILL.md`의 `description`이 사용 목적과 호출 상황을 명확히 알려주는가?
3. 서로 다른 작업에 맞는 스킬을 실제로 호출해 보았는가?
4. `AGENTS.md`와 Skills 간에 불필요하게 중복된 지침이 없는가?
5. 팀 프로젝트에서 공유해야 할 Skills와 개인 전용 Skills를 구분했는가?
6. 공통 Skills를 GitHub 리포지토리에서 버전 관리하는가?
7. 외부 Skills의 원본 저장소와 라이선스를 확인하고, §4-6 보안 검토(본문·스크립트 검토, 커밋 고정)를 거쳤는가?
8. 세 에이전트에서 Skill 인식 및 호출을 각각 검증했는가? Antigravity는 사용하는 제품(App·IDE·CLI)별로 확인했는가? (PART 1 §3 ⑤)
9. `.claude/skills/`의 모든 항목에서 `SKILL.md`가 열리는가(링크 방식. 복사 방식이면 `sync_skills.py --check` 통과)? 같은 스킬이 개인 경로와 프로젝트 경로에 중복 설치되어 서로 경쟁하지 않는가? (Claude Code는 개인 경로가 우선)
10. 워크플로우 표의 스킬이 PART 1 §4-1 목록과 일치하고, 이름이 바뀌거나 deprecated 된 스킬이 남아 있지 않은가?
11. `setup-matt-pocock-skills`가 만든 `## Agent skills` 블록이 `AGENTS.md`에만 있고 `CLAUDE.md`에는 없는가?
12. 개인 전역 경로에 `find-skills` 외의 스킬이 남아 있지 않고, 기획 스킬(`brainstorming`·`grill-with-docs`·`to-spec` 등)은 데스크톱 앱에 등록되어 있는가?

### 4-4. 구성 요소별 역할

| 구성 요소 | 역할 | 읽는 에이전트 |
| --- | --- | --- |
| `AGENTS.md` | 프로젝트 공통 작업 규칙 | Antigravity, Codex (Claude Code는 import로) |
| `CLAUDE.md` | `@AGENTS.md` import 및 Claude Code 전용 지침 | Claude Code |
| `.agents/skills/` | 프로젝트 Skills 원본 | Antigravity, Codex |
| `.claude/skills/` | 프로젝트 Skills 링크(원본은 `.agents/skills/`) | Claude Code |
| `.agents/rules/` | Antigravity 전용 세부 규칙 | Antigravity |
| `scripts/` | 테스트·빌드·검증·동기화 등 결정론적인 작업 | 모두 (명령으로 실행) |

### 4-5. Antigravity `.agents/rules/` 작성 규칙

- **frontmatter 필수:** `.agents/rules/` 안의 모든 `.md` 파일은 YAML frontmatter와 유효한 `trigger`로 시작해야 합니다. 없거나 값이 잘못되면(예: camelCase `alwaysOn`) 경고 없이 무시됩니다.
- **`trigger` 값:** `always_on` / `model_decision` / `glob` / `manual` (snake_case). `model_decision`은 `description`, `glob`은 `globs`가 필수입니다.
- **폴더 구조:** `.agents/rules/` 바로 아래의 파일만 읽습니다. 하위 폴더를 쓰려면 `.agents/rules.json`에 등록해야 합니다.
- **크기:** 파일당 24KB, 항상 활성 규칙 합산 20,000토큰을 넘지 않게 합니다.
- **파일 참조 문법:** `@라벨`는 대상 파일 내용을 규칙에 삽입하고, `@파일명`은 내용을 삽입하지 않고 경로만 참조합니다. Claude Code의 `@AGENTS.md`와 동작이 다르므로 혼용하지 않습니다.
- 레거시 `.agent/rules/`(단수형)도 호환되지만, 새로 만들 때는 `.agents/rules/`를 사용합니다.

```markdown
---
trigger: glob
globs: "*.sql, migrations/**"
description: "DB 마이그레이션 작성·검토 시 적용하는 규칙"
---
# Database Migration Rules
1. 한 번의 배포에서 컬럼을 삭제하거나 이름을 바꾸지 않는다.
```

> ⚠️ **Antigravity Workflows 지원 종료 (2026-10-19 시행)**
> - Google Antigravity의 기존 `.agents/workflows/`(및 전역 workflows) 기능은 2026년 10월 19일부로 종료되어 더 이상 인덱싱되지 않으며 슬래시 명령으로도 실행되지 않습니다.
> - Antigravity App에서 `/migrate-workflows`를 실행하면 기존 워크플로우를 `.agents/skills/<이름>/SKILL.md`로 자동 변환하고, 원본 파일은 `.bak`으로 보관합니다.
> - 변환된 스킬도 `/<이름>` 슬래시 명령으로 그대로 호출할 수 있습니다.
> - 변환 후 `.claude/skills/`에 새 스킬의 링크를 만들어 Claude Code에서도 보이게 합니다(PART 3 §4-2).
> - 이 문서의 워크플로우 표에 있는 스킬(`/grill-with-docs`, `/grilling`, `/research`, `/to-spec` 등) 중 아직 워크플로우 형식으로 남은 것이 있으면 먼저 마이그레이션합니다.

### 4-6. 외부 Skills 보안 검토

`SKILL.md`는 에이전트가 그대로 따르는 자연어 지시문이므로, 외부 스킬은 코드 의존성과 같은 수준으로 검토합니다. Snyk의 2026년 2월 감사에서는 공개 레지스트리 스킬 3,984개 중 36.82%에 보안 결함이 있었고 13.4%는 치명적 등급이었으며, 악성 지시가 스크립트가 아니라 `SKILL.md` 본문 자체에 들어 있는 경우가 전형적이었습니다.

1. **출처:** 공식 조직이나 유지보수 이력이 확인되는 저장소의 스킬만 씁니다. 레지스트리 스킬은 `find-skills`로 후보를 찾되, 본문 검토 전에는 설치하지 않습니다(PART 1 §4-3 ⑦).
2. **본문 검토:** `SKILL.md` 전체와 동봉 파일(`scripts/`, `references/` 등)을 사람이 읽습니다. 위험 신호는 외부 URL로 데이터 전송, 환경 변수·`.env`·`~/.ssh`·자격 증명 파일 읽기, 보안·권한 설정 변경, 다른 스킬·패키지 추가 설치 지시, 인코딩되거나 난독화된 문자열입니다.
3. **버전 고정:** 출처와 해시를 담은 `skills-lock.json`을 커밋합니다. 스킬 파일은 라이선스 고지 의무 때문에 커밋하지 않습니다(§4-2). 원본 저장소와 라이선스는 README의 Skills 표에 기록합니다. 업데이트(`npx skills update`)는 변경 내용을 검토한 뒤에만 반영합니다.
4. **권한 최소화:** 스킬이 실행하는 명령도 §5의 권한 정책을 그대로 따릅니다. 새 스킬을 처음 실행할 때는 승인 모드(Codex `on-request`, Claude Code 기본 권한 확인)에서 동작을 지켜봅니다.

## 5. 보안 및 에이전트 권한 설정

에이전트에게 무조건 많은 권한을 부여하는 것이 아니라, 필요한 작업은 허용하되 파괴적이거나 비용이 발생하는 고위험 작업은 통제합니다.

| 작업 유형 | 권장 권한 정책 |
| --- | --- |
| 일반 프로젝트 코드 읽기·수정 | 필요한 범위에서 허용 |
| 테스트·린트·빌드 실행 | 영향 범위를 확인한 뒤 허용 |
| `.env` 등 비밀정보 접근 | 불필요한 노출 방지 (API 키를 문서·Git에 직접 작성 금지) |
| 개발용 DB 초기화 | 데이터 손실 가능성을 확인하고 진행 |
| 운영 DB 변경 | 별도 승인 없이는 수행 금지 |
| 외부 유료 서비스 요청 | 비용과 부작용에 따라 사전 승인 기준 설정 |
| MCP 서버 연결·쓰기 작업 | 필요한 서버만 연결, 운영 자원에 쓰는 도구는 명시적 승인 (§9) |
| 운영 배포 및 자원 삭제 | 명시적인 사용자 승인과 배포 절차 적용 |

**에이전트별 권한 설정**

- 공통 보안 정책은 `AGENTS.md`에 기록하고, 실제 강제는 각 도구의 설정으로 합니다.
- 세 도구 모두 권한·샌드박스·Hooks 기능을 각자 제공하지만 설정은 서로 공유되지 않습니다. 한 도구에서 설정한 권한이 다른 도구에도 적용된다고 가정하지 않습니다.

| 에이전트 | 팀 공유 설정 | 개인 설정 | 주요 항목 | 주의 사항 |
| --- | --- | --- | --- | --- |
| Antigravity | 워크스페이스 설정 | 에이전트 설정 화면 | 터미널 실행 정책, 리뷰 정책, Permissions·Sandbox, Lifecycle hooks | 팀원별 자율성 설정이 다를 수 있으므로 권장값을 README에 기록 |
| Claude Code | `.claude/settings.json` | `.claude/settings.local.json`, `~/.claude/settings.json` | 허용·거부 명령 목록(permissions), Hooks | local 파일은 `.gitignore` 대상 |
| Codex | `.codex/config.toml` | `~/.codex/config.toml` | `sandbox_mode`, `approval_policy`, Hooks, Rules | 프로젝트를 신뢰 처리해야 `.codex/` 설정이 적용됨 |

Codex 권장 기본값 예시 (`.codex/config.toml`):

```toml
sandbox_mode = "workspace-write"   # read-only | workspace-write | danger-full-access
approval_policy = "on-request"     # untrusted | on-request | never
```

팀 저장소에서는 `danger-full-access`와 `approval_policy = "never"` 조합을 사용하지 않습니다.

## 6. GitHub Actions CI 연결 및 오류 관측성 확보

### 6-1. GitHub Actions CI 파이프라인 구축

- 로컬에서 `verify` 명령이 안정화되면 `.github/workflows/`에 YAML 파일을 구성하여 코드 푸시나 PR 시 자동 실행되도록 연결합니다.
- CI는 로컬과 같은 `verify` 명령을 호출합니다. 별도의 검사 단계를 CI에만 두지 않습니다.
- 브랜치 보호 규칙으로 `main` 병합 전에 CI 통과와 리뷰를 요구합니다(§3-3, PART 1 §3 ⑧).

```text
[코드 변경 (Push / PR)] → [의존성 설치] → [verify 실행: 린트·타입 검사·테스트·빌드·하네스 정합성] → [결과 기록 및 병합 제어]
```

### 6-2. 에이전트의 오류 원인 관측성(Observability) 확보

검증 실패 시 에이전트가 스스로 원인을 분석하고 수정할 수 있도록 아래 정보를 확인할 수 있는 환경을 마련합니다.

- 실행 명령과 종료 코드 (Exit Code)
- 컴파일 및 테스트 오류 메시지 전문
- API 요청과 응답의 오류 정보
- 애플리케이션 실행 로그
- 브라우저 콘솔 · 네트워크 요청 · 스크린샷 (UI 확인 필요 시)
- 변경한 파일 목록과 git diff
- CI 실패 로그 (GitHub Actions 실행 결과)

## 7. 에이전트 평가(Evals)와 회귀 테스트 구축

일반 테스트가 코드의 동작을 확인한다면, 에이전트 평가(Evals)는 AI 에이전트가 개발 작업을 얼마나 안정적으로 완수하는지 측정합니다. 세 에이전트를 함께 쓰므로, 같은 평가 작업을 에이전트·모델별로 실행해 비교하면 각 단계의 권장 에이전트를 정하는 근거가 됩니다.

### 7-1. 대표 평가 작업 구성 (초기 3~5개 권장)

| 평가 작업 | 성공 기준 예시 |
| --- | --- |
| API 입력값 검증 추가 | 잘못된 입력이 거부되고 관련 테스트 통과 |
| 기존 페이지 기능 추가 | 요구된 사용자 흐름이 동작하고 회귀 오류 없음 |
| DB 스키마 변경 | 마이그레이션과 데이터 제약 조건 정상 확인 |
| 버그 수정 | 재현 테스트 통과 및 기존 기능 유지 |
| 코드 리뷰 | 정의된 보안·정확성 문제를 올바르게 탐지 |

모든 평가 작업에 공통으로 기록할 항목: 수행 에이전트와 실제 모델명, 제공한 요구사항·기준 코드, 기대 결과, 성공·실패 판정 기준, 실제 검증 결과, 수정 횟수(그중 사람이 직접 고친 횟수)·소요 시간·비용

> 💡 **회고 지표 (선택)**
> 실제 프로젝트에서도 기능별 구현 시간, 병합 시 충돌·통합 오류 수, 사람이 직접 고친 횟수를 `docs/progress.md` 세션 로그나 회고에 남기면, "어떤 협업 문제를 발견했고 실행·검증 구조를 바꿔 어떻게 개선했는지"를 보여주는 근거가 됩니다(포트폴리오·캡스톤 보고서용).

### 7-2. 실패를 하네스 개선으로 연결하는 피드백 루프

에이전트가 실수를 범했을 때(예: API 인증 구현 중 권한 검사 누락), 무조건 `AGENTS.md`에 줄글 규칙만 추가하지 말고 원인에 맞는 계층을 개선합니다.

**진행 순서:** 1. 해당 오류를 재현하는 테스트 작성 → 2. 원인 분석 → 3. 코드 수정 → 4. 회귀 테스트 실행 → 5. 원인별 하네스 개선:

- **코드 오류:** 코드와 테스트 보완
- **지침 모호성:** `AGENTS.md` 보완 (Claude Code 전용이면 `CLAUDE.md`)
- **반복 절차 부족:** 관련 Skill 보완 후 동기화
- **위험한 명령 실행:** 해당 에이전트의 권한 설정 조정
- **환경 재현 실패:** 실행 스크립트 및 환경 설정 개선
- **병합 충돌·계약 불일치:** 공통 파일 담당·API 계약 변경 절차 점검, `CODEOWNERS`·스키마 검증으로 자동화 (PART 1 §3 ⑧)
- **특정 에이전트만 규칙을 무시:** 해당 에이전트의 로딩 방식 확인 (PART 1 §3 ⑤, PART 2 §3-0)

## 8. 하네스 유지보수와 엔트로피 관리

에이전트는 레포에 있는 패턴을 좋은 것과 나쁜 것을 가리지 않고 복제하므로, 하네스와 코드는 시간이 지나면 흐트러집니다. OpenAI 하네스 팀은 백그라운드 에이전트가 정기적으로 이탈을 찾아 품질을 매기고 리팩터링 PR을 여는 "가비지 컬렉션"을 운영했습니다. 반대로 Vercel은 에이전트 도구의 80%를 제거해 더 나은 결과를 얻었습니다. 하네스는 추가하는 것만큼 덜어내는 것도 관리 대상입니다.

| 주기 | 점검 | 방법 |
| --- | --- | --- |
| 마일스톤마다 (§2 6단계) | 코드 패턴 이탈·중복·강결합 | `improve-codebase-architecture`로 후보를 찾고, 이슈로 등록해 한 번에 하나씩 수정 |
| 마일스톤마다 | 문서 최신성 | 아래 「하네스 최신성 점검」 프롬프트로 문서가 가리키는 파일·명령·경로를 실제 레포와 대조 |
| 같은 리뷰 지적이 2회 반복될 때 | 규칙의 자동화 | 해당 규칙을 §3-3처럼 린터·테스트로 옮기고 `AGENTS.md`에서는 지움 |
| 모델 교체 또는 분기마다 | 하네스 덜어내기 | 각 규칙·Skill·MCP 서버·Hook이 아직 필요한지 검토하고, 최근 쓰이지 않거나 효과가 확인되지 않는 항목을 제거. 결정은 `docs/adr/`에 기록 |

- 1-A·1-B 해커톤에는 적용하지 않습니다. 1-A는 행사 후 회고 때 선택적으로 진행합니다.
- 모델이 좋아지면 예전 모델의 약점을 메우려고 넣은 규칙이 불필요해질 수 있습니다. 부록 A의 모델 표를 갱신할 때 하네스 덜어내기를 함께 검토합니다.

```markdown
# 하네스 최신성 점검

AGENTS.md, CLAUDE.md, SPEC.md, docs/, .agents/skills/, MCP 설정의 내용을 실제 저장소와 대조하라.

## 확인 항목
1. 문서가 가리키는 파일·디렉터리·명령이 실제로 존재하고 동작하는가
2. 문서 내용과 실제 코드·설정이 서로 다른 곳 (특히 SPEC.md API 계약과 실제 API)
3. AGENTS.md 규칙 중 이미 린터·테스트로 강제되어 중복된 줄
4. 최근 작업에서 쓰이지 않은 Skills·MCP 서버·Hooks
5. docs/progress.md의 상태와 실제 verify 결과가 일치하는가
6. docs/03-plan.md 담당 표와 실제 공통 파일 변경 이력이 일치하는가

## 원칙
- 이 단계에서는 파일을 수정하지 않고 목록과 근거만 보고한다.
- 삭제·수정 제안은 영향도와 우선순위를 함께 제시한다.
```

## 9. MCP 서버 관리

MCP 서버는 브라우저, DB, 이슈 트래커, 문서 검색처럼 외부 시스템에 접근하는 도구입니다. 작업 절차와 지식은 Skill로, 외부 시스템 접근은 MCP로 나눕니다. Anthropic의 장시간 하네스에서도 평가 에이전트가 Playwright MCP로 실행 중인 앱을 사용자처럼 조작해 검증했습니다.

- **필요한 서버만:** 연결된 도구가 많을수록 도구 설명이 컨텍스트를 차지하고 선택이 흐려집니다. 프로젝트에 필요한 서버만 연결하고, §8의 덜어내기 점검 대상에 포함합니다.
- **브라우저 검증은 하나로 통일:** Antigravity는 내장 브라우저를 쓰고, Claude Code·Codex는 Playwright MCP 또는 `agent-browser` 중 하나만 정해 씁니다.
- **비밀값:** 토큰·API 키는 설정 파일에 직접 쓰지 않고 환경 변수로 참조합니다.
- **DB 접근:** DB MCP는 개발 DB와 읽기 전용 계정으로 연결합니다. 운영 자원에 쓸 수 있는 도구는 §5의 운영 배포와 같은 수준의 명시적 승인을 거칩니다.
- **출처 검토:** 외부 MCP 서버도 §4-6과 같은 기준(출처, 버전 고정, 권한 최소화)으로 검토합니다.

| 에이전트 | 설정 위치 (2026-10-29 기준) | 팀 공유 방법 |
| --- | --- | --- |
| Claude Code | 프로젝트 루트 `.mcp.json` (개인용은 사용자 범위 설정) | `.mcp.json`을 커밋 (비밀값은 환경 변수 참조) |
| Codex | `.codex/config.toml`의 `[mcp_servers.<이름>]` (신뢰 처리된 프로젝트), 개인은 `~/.codex/config.toml` | `.codex/config.toml`을 커밋 |
| Antigravity | 사용자 전역, 제품별로 다름. App: `~/.gemini/config/mcp_config.json` (이전 경로 `~/.gemini/antigravity/mcp_config.json`), CLI: `~/.gemini/antigravity-cli/mcp_config.json` | 프로젝트 단위 공유 파일이 없으므로 README에 권장 서버 목록, 사용 제품, 설정 예시를 둠 |

설정 경로는 도구 업데이트로 바뀔 수 있으므로, 처음 구성할 때 각 도구의 공식 문서로 다시 확인합니다.

## 10. 컨텍스트와 세션 운용

Anthropic 실험에서는 긴 세션에서 압축(compaction)만으로 성능이 유지되지 않아, 컨텍스트를 리셋하고 구조화된 파일로 작업을 넘겨받는 방식이 하네스 설계의 필수 요소가 되었습니다. 다만 작은 수정마다 세션을 새로 여는 것은 비효율적이므로, 아래 기준에서만 전환합니다.

- **새 세션을 여는 경우:** ① 독립된 Task를 시작할 때, ② 다른 사람이나 다른 에이전트에게 작업을 넘길 때, ③ 컨텍스트가 혼잡해 응답 품질이 떨어질 때. 전환 전에 `docs/progress.md`를 갱신하고 커밋합니다(예: Claude Code `/clear`).
- **같은 세션을 이어가는 경우:** 같은 Task의 후속 수정, 리뷰 지적 반영, 방금 만든 코드의 작은 버그 수정.
- **압축보다 리셋:** 세션이 길어져 응답 품질이 떨어지면 압축을 반복하지 말고, 진행 상태를 갱신한 뒤 새 세션으로 넘어갑니다.
- **탐색은 위임:** 넓은 코드 탐색, 문서 조사, 로그 분석은 서브에이전트나 `/research` 같은 백그라운드 조사에 맡기고, 메인 세션에는 요약만 가져옵니다.
- **계획과 구현 분리:** Plan 모드에서 만든 계획을 `docs/03-plan.md`·`docs/progress.md`에 남긴 뒤 구현 세션을 시작합니다.
- **추론 수준:** 세션을 새로 시작할 때 정하고, 세션 중에는 바꾸지 않습니다(PART 1 §0-3).
- **1-B 현장 해커톤:** 같은 기준을 적용하며, 진행 상태는 `SPEC.md` 5절로 넘깁니다.

---

# PART 4. 아키텍처 구조 및 전체 구축 로드맵

## 1. 표준 프로젝트 디렉터리 구조 및 문서별 책임

워크플로우 산출물과 하네스 엔지니어링 구성을 결합한 통합 디렉터리 구조입니다. 프로젝트 규모에 맞춰 유연하게 조정합니다.

```text
project/
├── SPEC.md               # 구현할 기능과 요구사항 명세 (완료 조건·API 계약 포함, 요구사항의 유일한 기준)
├── AGENTS.md             # 세 에이전트 공통 작업 규칙 (단일 기준)
├── CLAUDE.md             # @AGENTS.md import + Claude Code 전용 지침 (내용 복제 금지)
├── README.md             # 설치·실행·verify 명령, 사용 에이전트·제품 버전
├── CHANGELOG.md          # 주요 변경 이력
├── .env.example          # 필수 환경 변수 템플릿
├── .gitignore            # 비밀정보, 빌드 산출물, 개인 설정(CLAUDE.local.md 등) 제외
├── .mcp.json             # Claude Code 팀 공유 MCP 서버 (비밀값은 환경 변수로 참조)
│
├── docs/                 # 워크플로우 단계별 산출물 및 상세 설계 문서
│   ├── 00-brainstorm.md
│   ├── 01-concept.md     # (해커톤 시 01-mvp-scope.md)
│   ├── 01-feasibility.md
│   ├── 02-requirements.md  # (해커톤은 SPEC.md에 바로 작성)
│   ├── 02-glossary.md    # 도메인 용어집
│   ├── 03-architecture.md  # 시스템 구조와 모듈 의존 관계 (Mermaid ERD 등)
│   ├── 03-plan.md        # 담당 표(기능·공통 파일·병합), 구현 계획 및 Task 분할
│   ├── progress.md       # 세션 간 진행 상태와 Task 통과 여부 (PART 1 §3 ⑦)
│   ├── 06-test-report.md # 테스트 범위·결과 및 복잡한 검증 절차
│   ├── 07-deploy.md      # 배포 방법
│   ├── 07-runbook.md     # 장애 대응 절차
│   ├── adr/              # 주요 기술 결정 기록 (Architecture Decision Records)
│   ├── agents/           # setup-matt-pocock-skills 설정 (이슈 트래커·문서 위치)
│   ├── meetings/         # 회의록
│   └── reviews/          # AI 교차 검증·리뷰 기록
│
├── frontend/             # 프런트엔드 소스 코드 (또는 src/)
├── backend/              # 백엔드 소스 코드
├── database/             # DB 스키마, 마이그레이션, 샘플 데이터(seed)
├── api/
│   └── openapi.yaml      # API 계약 명세 (공통 기반 담당자 관리)
├── tests/                # 단위·통합·E2E 테스트 코드
│
├── scripts/
│   ├── verify.*          # 통합 검증 구현 (진입점은 npm run verify 등 OS 무관 명령 하나)
│   └── sync_skills.py    # .agents/skills → .claude/skills 복사 동기화 (링크를 쓸 수 없을 때만, --check, --force 지원)
│
├── .agents/
│   ├── rules/            # Antigravity 전용 세부 규칙 (frontmatter 필수, 하위 폴더 미탐색)
│   └── skills/           # 프로젝트 Skills 원본 (<skill-folder>/SKILL.md) — Antigravity·Codex
│
├── .claude/
│   ├── settings.json     # Claude Code 팀 공유 권한·Hooks (settings.local.json은 개인용)
│   └── skills/           # Skills 링크 — Claude Code (원본은 .agents/skills/, 커밋 안 함)
│
├── .codex/
│   └── config.toml       # Codex 팀 공유 설정 (프로젝트 신뢰 시 적용)
│
└── .github/
    ├── CODEOWNERS        # 공통 파일 담당자 (PR 필수 리뷰어)
    └── workflows/
        └── ci.yml        # 코드 변경 시 verify 자동 실행 (GitHub Actions)
```

## 2. 하네스 구축 8단계 진행표 및 개선 프롬프트

### 2-1. 처음부터 끝까지 진행하는 8단계 구축 순서

| 단계 | 핵심 작업 | 구체적 수행 내용 | 완료 기준 |
| --- | --- | --- | --- |
| Step 1 | `SPEC.md` 작성 및 검수 | 프로젝트 목표, 기능, 우선순위, 검증 가능한 완료 조건, Non-goals와 Mock 대상, API 계약 확정 (Claude·Gemini 데스크톱 앱에서 작성 후 프로젝트 폴더로 인계, PART 1 §4-3 ⑦) | 요구사항의 모호한 부분과 미확정 사항이 구분됨 |
| Step 2 | 담당 지정, `AGENTS.md`·`CLAUDE.md` 작성 및 검수 | 사람별 기능·공통 파일·병합 담당 지정(PART 1 §0-1), 실제 저장소를 조사해 작업·협업 규칙과 기준 문서 위치 정리, `CLAUDE.md`는 `@AGENTS.md` import + 전용 지침만 작성, mattpocock 스킬을 쓰면 `/setup-matt-pocock-skills` 실행, `SPEC.md` 기준 프로젝트 Skills 설치(PART 1 §4-3 ⑦) | 담당 표가 기록되어 있고, 사람이 검토해 레포 고유 규칙만 남았고(PART 2 §3-1 원칙 5), 세 에이전트 모두에서 로딩이 확인됨 (PART 1 §3 ⑤) |
| Step 3 | 현재 하네스 진단 | 문서·Skills·코드·실행 환경·테스트·권한·다중 에이전트 정합성·협업 구조 조사 | 누락 사항과 개선 우선순위가 확인됨 |
| Step 4 | 실행 환경 안정화 | 런타임·의존성, 실행 명령, 환경 변수, 개발 DB·샘플 데이터의 재현 가능성 확보 | 다른 팀원이 새로 clone해 `README.md`대로 설치·실행하고 같은 `verify`를 통과함 (PART 3 §2) |
| Step 5 | 자동 검증 체계 구축 | 테스트·린트·타입 검사·빌드·Skills 동기화 검사를 단일 `verify` 명령으로 연결 (Node 스택은 `setup-pre-commit`으로 커밋 전 훅도 연결) | `verify`가 실행되고 실패 단계를 정확히 보고함 |
| Step 6 | 규칙과 보안 보완 | 중요한 아키텍처 규칙을 자동 검사하고, `CODEOWNERS`·브랜치 보호로 공통 파일과 `main` 보호, 세 에이전트 각각의 권한 설정과 MCP 서버 권한(PART 3 §9)으로 위험 작업 승인 기준 적용 | 핵심 제약과 고위험 작업이 모든 에이전트와 팀원에게 안전하게 관리됨 |
| Step 7 | CI/CD 및 평가(Evals) | 로컬 검증 안정화 후 CI에서 같은 `verify` 실행, 대표 작업 평가 세트를 에이전트별로 실행 | 반복 실행 가능한 자동 검증 파이프라인 작동 |
| Step 8 | 실제 기능으로 최종 검증 | 팀원 각자 작은 기능을 기능 브랜치에서 구현·리뷰·병합한 뒤 실패 원인을 분석해 하네스 개선 | 계획 → 구현 → 검증(실행 결과) → 병합 → 수정 루프가 실제로 작동함 |

구축 이후에는 PART 3 §8의 주기에 따라 하네스를 점검하고 덜어냅니다. 프로젝트 Skills는 `SPEC.md` 확정 후 PART 1 §4-3 ⑦ 절차로 추가하고, 이후 필요가 생긴 외부 Skills·MCP 서버는 Step 5~6에서 PART 3 §4-6·§9 기준으로 검토한 뒤 추가합니다. 처음 적용한다면 문서 앞의 「빠른 시작」 범위부터 진행하고, 나머지 단계는 필요가 확인될 때 진행합니다.

### 2-2. 진단 후 우선순위별 개선 구현 프롬프트 (세 에이전트 공통)

하네스 진단이 끝난 뒤에는 한 번에 모든 것을 바꾸지 말고, 가장 우선순위가 높은 문제 하나씩 아래 프롬프트로 해결합니다.

```markdown
# 하네스 최우선 미비점 개선 작업

앞서 수행한 하네스 진단 결과를 바탕으로 가장 우선순위가 높은 미비점을 개선하라.

## 작업 원칙
- 이미 존재하고 정상 작동하는 구성 요소를 다시 만들지 않는다.
- 새로운 Skills나 불필요한 도구를 추가하지 않는다.
- SPEC.md와 AGENTS.md의 역할을 유지한다.
- 공통 규칙은 AGENTS.md에만 두고, 다른 규칙 파일에 복제하지 않는다.
- 실제 프로젝트에서 확인한 정보와 검사 결과를 근거로 작업한다.
- 기존 Git 변경 사항을 보존하고, 기능 브랜치에서 작업한다.
- 공통 파일은 담당자 확인 없이 수정하지 않는다.
- 파괴적인 DB 작업과 운영 환경 변경은 승인 없이 수행하지 않는다.
- 관련된 작은 단위로 개선하고, 무관한 영역을 함께 수정하지 않는다.

## 수행 절차
1. 최우선 문제 하나를 선정하고 원인과 해결 기준을 설명한다.
2. 수정할 파일과 예상 영향을 제시한다.
3. 범위가 적절하면 해당 항목만 수정한다.
4. 관련 테스트와 verify 명령을 실행한다.
5. 실패하면 원인을 조사하고 필요한 수정을 수행한다.
6. 변경 내용과 실제 검증 결과를 보고한다.
7. 해결되지 않은 문제와 다음 우선순위를 정리한다.

## 금지 사항
- 실행하지 않은 테스트를 통과했다고 보고하지 않는다.
- 실제 프로젝트에서 사용하지 않는 기술을 임의로 도입하지 않는다.
- 모든 규칙을 AGENTS.md에 집중시키지 않는다.
- 테스트 실패를 숨기기 위해 테스트를 삭제하거나 무력화하지 않는다.
- 기존 코드를 불필요하게 전면 재작성하지 않는다.
- .claude/skills/를 직접 수정하지 않는다.

우선순위가 가장 높은 항목 하나를 완료하고 결과를 보고하라. 이후 항목은 별도 작업으로 진행한다.
```

## 3. 하네스 엔지니어링 완료 판단 기준 및 요약

**최종 완료 체크리스트**

단순히 문서와 파일을 생성한 것이 아니라, 아래 조건이 실제로 작동하는지 확인해야 합니다.

- [ ] `SPEC.md`의 핵심 요구사항과 완료 조건이 테스트 가능한 수준으로 구체적이며, 요구사항의 유일한 기준으로 쓰이는가?
- [ ] 사람별 기능 담당과 공통 파일·병합 담당이 기록되어 있고, 기능 브랜치를 작게 자주 병합하는가?
- [ ] API 계약 변경이 코드보다 먼저 `SPEC.md`(또는 `openapi.yaml`)에 반영되고 상대방에게 공유되는가?
- [ ] `AGENTS.md`가 실제 프로젝트 구조·기술 스택과 일치하고, `CLAUDE.md`는 `@AGENTS.md` import와 전용 지침만 담고 있는가?
- [ ] 세 에이전트 모두에서 공통 규칙과 Skills가 실제로 로딩되는 것을 확인했는가?
- [ ] `GEMINI.md`·`AGENTS.override.md`·개인 전역 규칙이 팀 규칙과 충돌하지 않는가?
- [ ] 에이전트가 관련 코드와 문서를 읽고 필요한 도구를 스스로 사용할 수 있는가?
- [ ] 단일 `verify` 명령이 모든 팀원의 OS와 CI에서 실행되며 성공·실패를 정확히 판별하는가?
- [ ] 다른 팀원이 새로 clone해 `README.md`대로 설치·실행하고 같은 `verify`를 통과하는가?
- [ ] Task 완료 판정이 모델의 동의가 아니라 실행 결과(`verify`·실제 동작 확인)에 근거하는가?
- [ ] 반복해서 지켜야 하는 기술적 제약이 린터·스키마·테스트 등으로 자동 검사되는가?
- [ ] `.agents/skills/`와 `.claude/skills/`가 일치하고, 레거시 `.agents/workflows/`가 남아 있지 않은가?
- [ ] 위험한 DB 작업과 운영 배포에 대한 권한 통제와 승인 절차가 세 에이전트 각각에 적용되어 있는가?
- [ ] 실패 원인을 파악하는 데 필요한 로그와 검증 결과를 에이전트가 확인할 수 있는가?
- [ ] 팀원 모두가 워크플로우의 담당 모델(또는 대체 모델)을 실제로 사용할 수 있는가?
- [ ] 실제 기능 구현을 통해 계획 → 구현 → 검증 → 병합 → 수정 루프가 원활히 작동하는가?
- [ ] `AGENTS.md`에 레포에서 알 수 없는 정보만 남아 있고, 사람이 검토한 내용인가?
- [ ] 새 세션이나 다른 팀원이 `docs/progress.md`(1-B는 `SPEC.md` 5절)와 git log만으로 작업 상태를 이어받을 수 있는가?
- [ ] 외부 Skills·MCP 서버가 출처 검토와 버전 고정을 거쳤고, 비밀값이 설정 파일에 없는가?
- [ ] 하네스 최신성 점검과 덜어내기 검토가 정해진 주기로 이루어지는가?

---

# 부록 A. 모델·요금제·추론 설정값 (2026-10-21 기준)

본문과 워크플로우 표는 등급(T1·T2·T3)과 공통 추론 수준만 사용합니다. 모델이나 요금제, 도구의 추론 단계 명칭이 바뀌면 이 부록만 수정하고, 실제 사용한 모델명·버전은 `docs/progress.md` 세션 로그와 리뷰 파일에 남깁니다.

## A-1. 모델 등급 매핑

| 등급 | 용도 | Gemini (Antigravity) | Claude (Claude Code · Antigravity) | OpenAI (Codex) |
| --- | --- | --- | --- | --- |
| T1 · 상위 추론 | 설계, 복잡한 버그, 중요 리뷰 | Gemini 4 Argon (High) ※1 | Claude Opus 5.5 (High) | GPT-6 Astra ※3 |
| T2 · 표준 | 일반 구현, 테스트 작성, 일반 리뷰 | Gemini 3.8 Flash (High) | Claude Sonnet 5.5 (High) | GPT-6.1 Sol |
| T3 · 경량 | 아이디어 초안, 단순·반복 작업 | Gemini 3.8 Flash (Low~Medium) | Claude Haiku 5.5 ※2 | GPT-6 Luna |

- ※1 플랜 조건은 A-2 참고.
- ※2 Claude Code 모델 목록(`/model`)에 Haiku 5.5가 없으면 Sonnet 5.5 (`low`)로 대체합니다.
- ※3 Astra의 플랜별 제공 여부는 Codex `/model`에서 확인합니다. 쓸 수 없으면 §0-4 대체 규칙을 적용합니다.
- Gemini T2·T3는 같은 모델(3.8 Flash)을 추론 수준으로 구분합니다.

## A-2. 플랜별 사용 가능 여부

| 모델 / 도구 | 사용 조건 (2026-10-21 기준) |
| --- | --- |
| Gemini 4 Argon | Google AI Pro(유료 구독, 무료 체험 제외)·Ultra·Enterprise에서 사용 가능. Pro는 Gemini 3.8 Flash와 별도인 주간 전용 한도가 적용됨. Free·Google AI Plus·Pro 무료 체험은 불가. Antigravity App·CLI·IDE 확장(VS Code 등)에서 사용 가능하며, 단독 실행형 Antigravity IDE에서는 불가 |
| Gemini 3.8 Flash | 모든 요금제 |
| Claude Code | 유료 Claude 플랜(Pro·Max·Team·Enterprise) 또는 Anthropic API 키 필요 |
| Codex (ChatGPT 로그인) | GPT-6.1 Sol은 Plus 이상. Free·Go는 출시 시점 미포함이며 GPT-6 Luna 사용. GPT-5.5는 2026-10-14부로 종료되었으므로 `config.toml` 등에 남아 있으면 교체 |

대체 규칙은 PART 1 §0-4를 따릅니다.

## A-3. 추론 수준 매핑과 권장값

워크플로우 표의 추론 수준(Low·Medium·High)은 아래 표로 각 도구의 실제 설정값에 대응시킵니다. 도구마다 단계 수와 이름이 다르며, 같은 이름이어도 성능이 1:1로 대응하지는 않습니다.

**① 공통 수준 → 도구별 설정값**

| 공통 수준 | Gemini (Antigravity, 3단계) | Claude Code (`/effort`, 5단계) | Codex (최대 6단계) |
| --- | --- | --- | --- |
| Low | Low | `low` | Light (CLI: `low`) |
| Medium | Medium | `medium` | Medium |
| High | High | `high` | High |
| 예외 상향 | 없음 (High가 최대) | `xhigh` (Opus 5.5만) | Extra High |
| 기본 사용 안 함 | — | `max` | Max, Ultra |

- 예외 상향의 사용 조건은 PART 1 §0-3을 따릅니다.
- Claude Sonnet 5.5는 `xhigh`·`max`로 올리지 않습니다. 그 수준이 필요하면 Opus 5.5 `medium`으로 모델을 전환합니다(비용 대비 성능이 더 좋음).
- Codex Ultra는 서브에이전트로 작업을 병렬 분할하는 모드이므로, 나눌 수 있는 대형 작업에서만 검토합니다.

**② 등급별 권장 기본값** (워크플로우 표에 추론 수준이 지정된 단계는 표의 값을 우선합니다)

| 등급 | Gemini | Claude | Codex |
| --- | --- | --- | --- |
| T1 | Argon Medium (설계·중요 리뷰는 High) | Opus 5.5 `medium` (설계·대규모 리뷰는 `high`, 필요 시 `xhigh`) | Astra Light(`low`)로 시작, 중요 리뷰는 Medium~High |
| T2 | Flash High | Sonnet 5.5 `medium` (여러 파일에 걸친 기능은 `high`) | Sol 클라이언트 기본값으로 시작, 필요 시 Medium~High |
| T3 | Flash Low (초안 품질이 부족하면 Medium) | Haiku 5.5 또는 Sonnet 5.5 `low` | Luna High (공식 권장 시작값) |

---

## 참고한 공식 자료

**하네스 엔지니어링 · 평가**
- OpenAI — Harness engineering: leveraging Codex in an agent-first world
- Anthropic — Demystifying evals for AI agents
- Agent Skills 공개 표준

**Google Antigravity**
- Rules
- Agent Skills (App·IDE·CLI별 전역 경로)
- Antigravity CLI — Plugins / Gemini CLI 마이그레이션
- Workflows to Skills 마이그레이션
- Permissions
- Lifecycle hooks
- Choose a model
- Codelab — Authoring Google Antigravity Skills

**Claude Code**
- Memory (CLAUDE.md, @import, AGENTS.md 연동)
- Agent Skills 개요
- Skills (개인·프로젝트 스킬 우선순위)

**OpenAI Codex**
- Custom instructions with AGENTS.md
- Agent Skills
- Config basics (config.toml, 샌드박스·승인)
- Hooks
- Models

**하네스 설계 근거 (2026-10-28 검토)**
- Birgitta Böckeler — Harness engineering for coding agent users (martinfowler.com)
- Anthropic — Effective harnesses for long-running agents
- Anthropic — Harness design for long-running application development
- Gloaguen et al. — Evaluating AGENTS.md (ICLR 2026)
- CSA — Agent Context Poisoning: SKILL.md and the New AI Supply Chain Attack Surface
- Barbaste et al. — Harness Engineering: A Source-Code Study of Eleven Systems (arXiv)

**Skills 원본 저장소 (PART 1 §4)**
- mattpocock/skills
- obra/superpowers
- vercel-labs/agent-skills
- vercel-labs/skills (find-skills)
- vercel-labs/agent-browser
- supabase/agent-skills
- Leonxlnx/taste-skill
- anthropics/skills (pptx)

---

## 문서 변경 이력

| 날짜 | 변경 내용 |
| --- | --- |
| 2026-10-31 (2차) | 구독컷 적용 결과 반영(스킬 운영). ① PART 3 §4-2를 「단일 원본 + 링크·복원 정책」으로 변경: `.claude/skills/`는 복사본이 아니라 `.agents/skills/`를 가리키는 링크(Windows Junction), `.agents/skills/`·`.claude/skills/`는 커밋하지 않고 `skills-lock.json`만 커밋(서드파티 라이선스 고지 의무), 복원은 `npx skills experimental_install` 후 링크 직접 생성(이 명령은 `.claude/skills/` 연결을 만들지 않음), 출처 없는 스킬은 로컬 전용, `sync_skills.py`는 링크를 쓸 수 없는 환경의 대안 ② PART 1 §4-3 ④: `npx skills remove -g`가 프로젝트 스킬 폴더까지 지운 사례를 반영해 사용 금지, 프로젝트 스킬은 `-g` 없이 설치·제거 ③ §4-3 ⑦ ②·④: 후보 탐색 기준을 `SPEC.md`만이 아니라 기술 스택과 `docs/tasks.md` 작업 종류·주차로 변경, 필요한 TASK 직전에 설치, 라이브러리 문서는 context7, 설치 명령과 확인 항목 구체화 ④ PART 3 §4-6 ③ 버전 고정을 `skills-lock.json` 기준으로 변경, §4-1 문구 정정 |
| 2026-10-31 | 기획과 실행 환경 분리. ① 1~3단계(`/brainstorming` 아이디어 브레인스토밍 → `/grill-with-docs` 아이디어 구체화 → `/to-spec` 요구사항 명세서)는 Claude·Gemini 데스크톱 앱, 4단계(Plan 모드·작업 분해)부터는 Antigravity·Claude Code에서 진행. §0-2 역할 표, 1-A·1-B·2 워크플로우 표의 환경 열 갱신 ② `/brainstorming`을 1-A·2의 1단계에 다시 배치(2단계 `grill-with-docs`와 단계 분리, 1-B는 계속 미사용) ③ PART 1 §4-3 ⑦ 신설: 기획 문서 인계와 `SPEC.md` 확정 후 `/find-skills` 기반 프로젝트 Skills 설치 절차(탐색 → 본문 검토 → `.agents/skills/`에만 설치 → sync → 기록). §4 서두·§4-1 표·§4-3 ②③④ 갱신, 1-B는 사전 준비 때 설치 ④ 개인 전역 경로에는 `find-skills`만 두도록 변경하고 Claude Code의 개인 스킬 우선 적용 주의 추가(PART 3 §4-1·§4-2·§4-3 체크리스트 9·12번, `sync_skills.py` 안내 문구) ⑤ PART 3 §4-6, PART 4 Step 1·2와 구축 후 안내 갱신 |
| 2026-10-29 | 외부 피드백 검토 반영. ① 「빠른 시작」 신설(최소 문서·적용 순서) ② PART 1 §0 재구성: 사람별 기능 담당(§0-1) 우선, 에이전트 역할은 권장값(§0-2), 실제 모델명·요금제·도구별 설정값은 부록 A로 이동, 워크플로우 표의 모델명을 등급 표기로 통일 ③ §3 ⑧ 브랜치·병합·공통 파일 규칙 신설(기능 브랜치, worktree, 공통 파일 담당, API 계약 우선 변경, 작은 병합), `AGENTS.md` 템플릿 §4·§9와 `CODEOWNERS`·브랜치 보호(PART 3 §3-3) 연결 ④ §3 ① 완료 판정 4조건과 변경 위험 기반 리뷰로 개편, 리뷰 양식에 근거 열 추가 ⑤ 1-B: "테스트 코드는 작성하지 않는다"를 핵심 로직 최소 테스트 허용으로 변경, Non-goals와 Mock 대상 구분(템플릿 포함), Task Split에 담당자·브랜치 추가 ⑥ 1-A: 기능 목록·데모 시나리오·API 계약을 `SPEC.md`로 통합해 문서 수 축소, 3단계 교차 검증 표기 오류("생략 (2회)") 수정, 전체 횟수를 필수 3회·최대 6회로 정정 ⑦ PART 3 §10 세션 전환 기준을 "1 Task = 1 세션"에서 독립 Task·인수인계·컨텍스트 혼잡 기준으로 완화(템플릿 동기화) ⑧ PART 3 §2 "같은 도구보다 같은 실행 결과" 표와 clone 기준 완료 조건 추가 ⑨ `sync_skills.py`: 스크립트 위치 기준 경로 계산, 사본 전용 파일 발견 시 중단(`--force`) ⑩ Antigravity 전역 Skills·MCP 경로를 App·IDE·CLI별로 구분 ⑪ 진단 영역에 「협업 구조」 추가(12대), 완료 체크리스트·구축 8단계 갱신 |
| 2026-10-28 (2차) | 최신 하네스 연구·사례 대조 결과 반영. ① `AGENTS.md` 최소 요구사항 원칙(PART 2 §3-0·§3-1 원칙 5, 템플릿의 일반론 삭제, 작성 프롬프트 규칙 추가) ② 세션 간 진행 상태 기록(PART 1 §3 ⑦, `docs/progress.md`, 1-B `SPEC.md` 5절 상태 열) ③ 하네스 유지보수와 엔트로피 관리(PART 3 §8) ④ 외부 Skills 보안 검토(PART 3 §4-6) ⑤ MCP 서버 관리와 컨텍스트·세션 운용(PART 3 §9·§10). 관련 디렉터리 구조·진단 영역·작성 프롬프트·체크리스트·참고 자료 갱신 |
| 2026-10-28 | PART 1 §4 「단계별 Skills 매핑과 사용 원칙」 신설. 1-A·1-B·2 워크플로우 표에 단계별 Skills 명시 (1단계 `/brainstorming` 제거, 2단계 `/grill-with-docs`로 통합, `/to-spec`·`/to-tickets`·`/pptx` 등 배치). 1-B 운영 원칙·사전 준비에 Skills 항목 추가. `AGENTS.md` 템플릿 §5, PART 3 §3-3·§4-3·§4-5, PART 4 Step 2·5와 디렉터리 구조(`docs/agents/`) 갱신. §0-1 모델 등급 표와 `sync_skills.py`·`config.toml` 코드 블록의 깨진 서식 복구, 2단계 표 오타("Task 분" → "Task 분할") 수정 |
| 2026-10-21 | 통합본 기준일 (모델 가용성·도구 경로는 이 날짜 기준, 이전 변경 이력은 기록되지 않음) |
