# ADR-0008: Cloudflare 단일 Worker 구성, React + Vite SPA, 구현 라이브러리 선택

- **상태**: 승인 (2026-10-23, 구현 계획 승인과 함께)
- **관련**: SPEC §17(기술 스택), Further Notes §2 `ADR-0008` 후보, Further Notes §7 D-06·D-07
- **참고**: ADR-0001~0005는 `Glossary.md` §4에 요약되어 있습니다. 이 파일은 그 뒤를 잇는 첫 독립 ADR 파일입니다. ADR-0006·0007 후보는 아직 작성되지 않았습니다.

## 배경

SPEC §17은 Cloudflare Workers·TypeScript·D1·R2·Cron Trigger를 확정했지만, 아래 세 가지는 구현 계획 단계로 미뤘습니다.

- 프런트엔드 프레임워크 (D-07)
- HTTP 엔드포인트와 오류 규격 (D-06)
- 구현 라이브러리

화면 조건은 다음과 같습니다.

- 카카오톡 인앱 브라우저에서 열리는 모바일 우선 웹이며, PWA 설치를 지원합니다.
- Workers static assets로 제공해야 하므로 정적 빌드가 가능해야 합니다.

## 결정

1. **배포 구조**: Worker 하나가 `fetch`(API·인증·정적 자산)와 `scheduled`(Cron 2종)를 모두 처리합니다. 정적 자산은 `assets.not_found_handling = "single-page-application"`으로 SPA fallback을 씁니다.
2. **프런트엔드 (D-07)**: React + Vite SPA. 함께 쓰는 라이브러리는 다음과 같습니다.
   - React Router: 라우팅
   - TanStack Query: 서버 상태
   - CSS Modules: 스타일, 추가 의존성 없음
   - `vite-plugin-pwa`: manifest와 Service Worker
3. **API 계약 (D-06)**: `api/openapi.yaml`이 원본입니다. `openapi-typescript`로 공용 타입을 생성하고, 오류는 RFC 9457 problem+json에 `code`를 더해 표현합니다. SPEC §19는 이 파일을 참조합니다.
4. **서버 라이브러리**:
   - **Hono**: Workers용 라우터. 의존성이 작고 미들웨어 구조가 단순합니다.
   - **zod**: 서버 요청 검증
5. **테스트**: Vitest와 `@cloudflare/vitest-plugin`. 실제 D1(miniflare)에서 batch 원자성과 제약을 확인합니다. (2026-10-28 변경: 처음 채택한 `@cloudflare/vitest-pool-workers`가 `@cloudflare/vitest-plugin`으로 이름이 바뀌고 deprecated되었습니다. 구버전 wrangler·miniflare를 내부에 고정해 개발 의존성에 high 취약점이 보고되어 후속 패키지로 교체했습니다. 테스트 방식은 그대로입니다.)
6. **품질 도구**:
   - ESLint(flat config) + `typescript-eslint` + Prettier
   - `no-restricted-imports`로 모듈 경계를 강제합니다.
   - `no-restricted-syntax`로 도메인 코드에서 `new Date()`·`Date.now()` 직접 호출을 막습니다.
7. **날짜**: 날짜 라이브러리를 쓰지 않고 `Date.UTC` 일 단위 연산으로 KST 달력 날짜를 다룹니다(SPEC §4. 한국은 일광절약시간이 없음).

## 검토한 대안

| 영역 | 대안 | 채택하지 않은 이유 |
| :--- | :--- | :--- |
| 프런트엔드 | Preact, SvelteKit(static), Vanilla TS | 사용자가 D-07에서 React + Vite를 선택 |
| API 계약 | SPEC §19에 직접 기술 | 사용자가 D-06에서 `openapi.yaml`을 선택 |
| 라우터 | itty-router, 직접 구현 | 미들웨어(세션·역할·오류 매핑)를 직접 만들어야 함 |
| 테스트 | 메모리 저장소 fake | D1 batch 원자성·CHECK·UNIQUE 제약을 확인할 수 없음 |

## 결과

- 버전은 T01 스캐폴드 시점의 안정 버전으로 고정하고, 확인한 명령을 `AGENTS.md` §4·§7에 기록합니다.
- **버전 고정 예외 (2026-10-28, T01)**: TypeScript는 최신 7.0이 아니라 5.9.3으로 고정합니다. `typescript-eslint` 8.x(TypeScript `<6.1`)와 `openapi-typescript` 7.x(TypeScript `^5.x`)가 요구하는 TypeScript 피어 의존성 범위 때문입니다. 두 도구가 올라가면 TypeScript도 올립니다. Vitest는 `@cloudflare/vitest-plugin`이 요구하는 4.1.x(`^4.1.0 || ^5.0.0`)입니다.
- 이 결정을 바꾸려면 이 ADR과 `docs/architecture.md`를 먼저 고칩니다(SPEC §17 규칙).
