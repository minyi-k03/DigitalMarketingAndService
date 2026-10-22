# 디지털 마케팅 및 서비스 
# 구독컷 (SubCut)
> **대학생·청년층을 위한 금융 무연동 무료체험 안심 관리 및 해지 방어 양면 플랫폼**  

---

##  프로젝트 소개 (Overview)

**구독컷(SubCut)**은 대학생과 20대 청년층이 신용카드나 계좌 연동에 대한 금융 정보 노출 부담 없이 무료체험을 등록·추적하고, 유료 전환 직전에 검증된 해지 안내를 통해 안전하게 탈출할 수 있도록 돕는 서비스입니다.

동시에 B2B 파트너사에게는 초기 청년층 체험단 유입 채널과 해지 사유 기반의 **이탈 분석 리포트(`ChurnReport`)**를 제공하는 양면 시장 플랫폼을 지향합니다.

---

##  해결하고자 하는 문제 (Problem)

* **원치 않는 유료 전환 피해**: 무료체험을 등록해 두고 종료일을 잊어 첫 달 요금이 자동 결제되는 사고 발생
* **글로벌 SaaS 시차 결제 사고**: UTC/PST 기준 정산으로 인해 국내 결제일 하루 전(D-1) 조기 결제되는 문제
* **복잡한 다크패턴 해지 장벽**: 숨겨진 메뉴, 반복되는 설득 팝업, PC 접속 강제로 인한 중도 포기
* **금융 연동 거부감**: 기존 자산관리 앱의 민감한 금융 정보 연동에 대한 심리적 허들

---

##  핵심 기능 (Key Features)

1. **금융 무연동 1초 간편 등록 (Auto-fill UX)**
   * 카드 연동 없이 카탈로그 선택 한 번으로 시작일과 기본 체험 일수 자동 세팅
2. **시차 안전 만료일(`SafeEndDate`) 및 카카오 알림톡**
   * 해외 시차를 감안한 1일 안전 버퍼 D-Day 계산 및 D-3, D-1 맞춤형 탈출 알림톡 발송
3. **해지 브릿지(`EscapeBridge`) & 1초 이탈 투표(`ExitPoll`)**
   * 3단계 요약 해지 가이드라인, 사전 백업 체크리스트 제공
   * 5대 표준 사유 클릭 한 번으로 투표 완료와 동시에 해지 최단 직링크 이동 (응답률 100%)
4. **2단계 해지 상태 분리 및 사후 구제**
   * 해지 실패에 대비한 해지 시도(`CancelAttempted`) 추적 및 미확인 건 종료 방지
   * 결제 발생 시 자동 작성되는 국문/영문 환불 요청 템플릿(`RefundTemplate`) 제공
5. **B2B 이탈 분석 리포트 (`ChurnReport`)**
   * 분야별 평균 대비 해지 사유 분포 및 전환 지표 분석 리포트 제공

---

##  저장소 구조 (Repository Structure)

```text
├── Dev/                    # 구독컷 핵심 개발 명세 및 작업 공간
│   ├── SPEC.md             # 요구사항 명세서 (v1.9 최신 기준)
│   ├── Glossary.md         # 도메인 용어집 (v1.4) 및 ADR 요약
│   ├── AGENTS.md           # AI 에이전트(Antigravity, Claude, Codex) 공통 하네스
│   └── CLAUDE.md           # Claude Code 환경 연동 파일
└── README.md               # 프로젝트 전체 소개 (본 문서)
```

---

## 🛠 기술 스택 (Tech Stack)

* **Platform**: Mobile-First Responsive Web (PWA)
* **Runtime & Framework**: Cloudflare Workers (Single Worker API + Static Assets), TypeScript
* **Database & Storage**: Cloudflare D1 (Relational DB / SQLite), Cloudflare R2 (Object Storage)
* **Scheduler**: Cloudflare Cron Triggers (알림 발송 및 미해지 배치 처리)
* **Messaging**: 카카오톡 비즈메시지 알림톡 연동

---

