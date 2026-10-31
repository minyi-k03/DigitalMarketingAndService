import js from '@eslint/js';
import tseslint from 'typescript-eslint';

const MODULES = ['catalog', 'trial-tracking', 'escape-bridge', 'identity', 'analytics'];
const INTERNAL_LAYERS = ['domain', 'application', 'infra'];

// 다른 모듈의 내부 계층(domain·application·infra)을 직접 import하지 못하게 한다.
// 다른 모듈은 modules/<module>/index.ts의 공개 인터페이스로만 호출한다 (AGENTS.md §4).
const internalsOf = (modules) =>
  modules.flatMap((m) =>
    INTERNAL_LAYERS.map((layer) => ({
      group: [`**/${m}/${layer}`, `**/${m}/${layer}/**`],
      message: `${m} 모듈의 ${layer}는 직접 import할 수 없습니다. modules/${m}/index.ts를 사용하세요.`,
    })),
  );

export default tseslint.config(
  {
    // .agents·.claude는 설치형 Skill 스크립트라 프로젝트 코드가 아니다 (AGENTS.md §5)
    ignores: [
      'node_modules',
      'dist',
      '.wrangler',
      'coverage',
      'src/shared/api-types.ts',
      '.agents',
      '.claude',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,

  // 모듈별: 자기 자신을 제외한 모듈의 내부 계층 import 금지
  ...MODULES.map((m) => ({
    files: [`src/worker/modules/${m}/**/*.ts`],
    rules: {
      'no-restricted-imports': [
        'error',
        { patterns: internalsOf(MODULES.filter((other) => other !== m)) },
      ],
    },
  })),
  // 모듈 밖 워커 코드(http·adapters·index 등): 모든 모듈의 내부 계층 import 금지
  {
    files: ['src/worker/**/*.ts'],
    ignores: ['src/worker/modules/**'],
    rules: {
      'no-restricted-imports': ['error', { patterns: internalsOf(MODULES) }],
    },
  },

  // 도메인·application 코드는 주입된 Clock만 쓴다 (AGENTS.md §4, architecture §4)
  {
    files: ['src/worker/modules/**/{domain,application}/**/*.ts'],
    rules: {
      'no-restricted-syntax': [
        'error',
        {
          selector: "NewExpression[callee.name='Date'][arguments.length=0]",
          message: 'new Date() 대신 주입된 Clock 포트(clock.now())를 사용하세요.',
        },
        {
          selector: "CallExpression[callee.object.name='Date'][callee.property.name='now']",
          message: 'Date.now() 대신 주입된 Clock 포트(clock.now())를 사용하세요.',
        },
      ],
    },
  },

  // 로컬·운영 보조 스크립트(Node 실행)
  {
    files: ['scripts/**/*.mjs'],
    languageOptions: { globals: { process: 'readonly', console: 'readonly' } },
  },

  // 프런트엔드는 워커 코드를 import하지 않는다. 공용 타입은 src/shared를 쓴다.
  {
    files: ['src/web/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['**/worker', '**/worker/**'],
              message: 'src/web은 src/worker를 import할 수 없습니다. src/shared를 사용하세요.',
            },
          ],
        },
      ],
    },
  },
);
