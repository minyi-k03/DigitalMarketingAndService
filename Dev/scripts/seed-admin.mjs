// 최초 ADMIN 부트스트랩 (T06, SPEC §16).
// 사용자는 카카오 로그인으로만 만들어지므로, 먼저 그 계정으로 로그인해 users 행을 만든 뒤 이 스크립트로 승격한다.
//
//   npm run seed:admin -- <카카오 회원번호>            로컬 D1(기본)
//   npm run seed:admin -- <카카오 회원번호> --remote   production D1 (원격이므로 사용자 승인 후에만 실행)
//
// 카카오 회원번호는 로그인한 카카오 계정의 id(숫자)이며, users.kakao_id에 저장된다.
import { spawnSync } from 'node:child_process';
import { join } from 'node:path';

const args = process.argv.slice(2);
const remote = args.includes('--remote');
const kakaoId = args.find((arg) => !arg.startsWith('--'));

function fail(message) {
  console.error(message);
  process.exit(1);
}

if (!kakaoId) fail('사용법: npm run seed:admin -- <카카오 회원번호> [--remote]');
// SQL에 직접 넣으므로 숫자만 허용해 삽입을 막는다
if (!/^\d{1,20}$/.test(kakaoId)) fail('카카오 회원번호는 숫자여야 합니다.');

const target = remote ? ['--env', 'production', '--remote'] : ['--local'];

/** wrangler d1 execute로 SQL을 실행하고 첫 결과의 행을 돌려준다 */
function run(sql) {
  const result = spawnSync(
    process.execPath,
    [
      join('node_modules', 'wrangler', 'bin', 'wrangler.js'),
      'd1',
      'execute',
      'DB',
      ...target,
      '--command',
      sql,
      '--json',
    ],
    { encoding: 'utf8' },
  );
  if (result.status !== 0) fail(`wrangler 실행 실패:\n${result.stderr || result.stdout}`);
  return JSON.parse(result.stdout.slice(result.stdout.indexOf('[')))[0]?.results ?? [];
}

// 변경 건수는 wrangler 출력에 항상 담기지 않으므로, 사용자 존재를 먼저 확인한다
const [{ n } = { n: 0 }] = run(`SELECT COUNT(*) AS n FROM users WHERE kakao_id = '${kakaoId}'`);
if (n === 0) {
  fail(`카카오 회원번호 ${kakaoId} 사용자가 없습니다. 먼저 그 계정으로 카카오 로그인을 한 번 하세요.`);
}

run(`UPDATE users SET role = 'ADMIN' WHERE kakao_id = '${kakaoId}'`);
console.log(`${remote ? 'production' : '로컬'} D1: 카카오 회원번호 ${kakaoId}를 ADMIN으로 승격했습니다.`);
