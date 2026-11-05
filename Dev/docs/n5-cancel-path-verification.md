# N5 해지 경로 직접 검증 기록

`GuardedService` 10개 안팎의 해지 경로를 사람이 직접 확인해 적는 기록지다.
여기에 적은 값이 관리 콘솔(T30)이나 시드 스크립트(T35)로 들어가며, 확인하지 않은 값은 넣지 않는다(`implementation-plan.md` §7.3).

## 원칙

- **직접 확인한 값만 적는다.** 검색 결과나 기억이 아니라 해지 화면을 실제로 따라가 본 결과여야 한다.
- 해지 화면을 자동으로 읽어 오거나(크롤링) 사용자를 대신해 해지하는 기능은 만들지 않는다(`ADR-0001`·`0004`·`0005`). 이 기록은 사람이 손으로 확인하는 작업이다.
- 실제 해지까지 눌러 볼 필요는 없다. 해지 확정 직전 화면까지 따라가 클릭 수와 팝업 수를 센다. 해지를 확정하면 되돌릴 수 없는 서비스가 있으니 본인 계정이 아니면 확정하지 않는다.
- 확인한 날짜를 `lastVerifiedAt`(KST `YYYY-MM-DD`)으로 남긴다. 화면이 바뀌면 다시 확인한다.
- 서비스 한 개당 10~20분이 목표다. 막히면 비워 두고 사유를 적는다.

## 서비스 한 개당 적는 항목

항목 이름은 `api/openapi.yaml`의 `CatalogItemInput`과 같다. 이름 그대로 콘솔에 옮겨 적는다.

| 항목 | 무엇을 적나 | 확인 방법 |
| :--- | :--- | :--- |
| `name` | 서비스 이름 | 공식 표기 그대로 |
| `serviceCategory` | `BIGTECH`·`AI`·`DELIVERY`·`OTT`·`CLOUD`·`LEARNING`·`ETC` 중 하나 | 가장 가까운 분야 |
| `monthlyPrice` | 월 구독료(원, 정수) | 결제 페이지. 외화면 확인 시점 환율로 원화 환산 |
| `defaultTrialDays` | 무료체험 기간(일, 1~365) | 가입 화면 안내 문구. 신규 가입 기준 |
| `isGlobalTimeZoneBufferRequired` | 해외 서비스라 결제 시각이 한국 날짜와 어긋날 수 있으면 `true` | 약관·고객센터의 결제일 안내. 모르면 `true`(하루 일찍 알려 주는 쪽이 안전) |
| `escapePattern` | `DIRECT_LINK`(링크 한 번에 해지 화면), `SPA_MODAL_GUIDE`(메뉴를 따라 들어가야 함), `PC_OR_APP_FORCED`(PC 웹 또는 앱에서만 가능) | 해지 화면까지 가는 과정 |
| `forcedChannel` | `PC_OR_APP_FORCED`일 때만: `APP` 또는 `PC_WEB` | 어느 쪽에서만 해지되는지 |
| `escapeLinkFallbackUrl` | `forcedChannel`이 `APP`일 때만 필수: 앱이 없을 때 열 앱마켓·웹 `https` 주소 | 앱 스토어 페이지 주소 |
| `escapeGuideSteps` | 해지 단계 **1~3개** 문장. 4단계 이상은 저장되지 않으니 합쳐서 적는다 | 따라가며 적은 순서 |
| `escapeLink` | 해지 화면에 가장 가까운 `https` 주소(앱 딥링크는 `forcedChannel`이 `APP`일 때만) | 주소창에서 복사해 로그인 상태로 열어 확인 |
| `accessRetentionPolicy` | `RETAIN_UNTIL_END`(해지해도 결제 기간 끝까지 이용), `IMMEDIATE_TERMINATION`(해지 즉시 이용 중단) | 해지 화면 안내 문구 |
| `backupChecklist` | 해지 즉시 중단 서비스에서 미리 저장해 둘 것(선택) | 해지 전 데이터 보존 안내 |
| `supportContact` | 고객센터 이메일 또는 문의 페이지 `https` 주소(둘 중 하나 이상) | 환불 요청 템플릿에 들어간다 |
| `eduBenefit` | 학생 혜택이 있으면 설명과 `https` 주소(선택) | 학생 인증 페이지 |
| `darkPatternScores` | 아래 세 항목 원점수 | 아래 표 |
| `lastVerifiedAt` | 확인한 날짜 | 오늘 |

### 다크패턴 원점수 (`SPEC.md` §2 기준표)

등급(`HIGH`·`MEDIUM`·`LOW`)은 시스템이 계산하니 원점수만 적는다.

| 항목 | 0점 | 1점 | 2점 |
| :--- | :--- | :--- | :--- |
| `menuDepth` 해지 메뉴 숨김 깊이 | 2클릭 이내 | 3~4클릭 | 5클릭 이상 |
| `persuasionPopups` 설득 팝업 반복 | 없음 | 1회 | 2회 이상 |
| `forcedPcOrApp` PC 웹·전용 앱 강제 | 없음 | (해당 없음) | 있음 |

클릭 수는 서비스 첫 화면(로그인 상태)에서 해지 확정 직전 화면까지 센다.

## 기록표

서비스마다 아래 칸을 복사해 채운다. 아직 정하지 않은 서비스 목록은 맨 아래 "정할 것"을 본다.

```
### 서비스 이름
- 확인일(lastVerifiedAt):
- serviceCategory:        monthlyPrice(원):
- defaultTrialDays:       isGlobalTimeZoneBufferRequired:
- escapePattern:          forcedChannel:
- escapeLink:
- escapeLinkFallbackUrl:
- escapeGuideSteps:
  1.
  2.
  3.
- accessRetentionPolicy:
- backupChecklist:
- supportContact(email / url):
- eduBenefit(설명 / url):
- darkPatternScores: menuDepth=  persuasionPopups=  forcedPcOrApp=
- 막힌 점·확인 못 한 것:
```

## 정할 것

- 대상 서비스 10개 안팎. 시연에 쓰므로 대학생이 많이 쓰는 서비스를 분야별(`BIGTECH`·`AI`·`DELIVERY`·`OTT`·`CLOUD`·`LEARNING`)로 골고루 고르면 `ChurnReport`의 분야 평균 시연에도 도움이 된다.
- 한 번에 몇 개씩 확인할지. 일정상 11/24 주에 데이터를 입력해야 하므로(`implementation-plan.md` §7.5) 그 전까지 끝내면 된다.
