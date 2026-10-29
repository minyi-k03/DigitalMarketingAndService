import react from '@vitejs/plugin-react';
import { defineConfig, type ProxyOptions } from 'vite';

const DEV_SERVER_PORT = 5173;
const DEV_SERVER_ORIGIN = `http://localhost:${DEV_SERVER_PORT}`;
const WORKER_ORIGIN = 'http://localhost:8787';

// tsconfig.web.json에는 Node 타입이 없어(@types/node 미설치) 프록시가 상속하는 EventEmitter 타입을 쓸 수 없다.
// 여기서 쓰는 이벤트 하나만 최소 구조로 적는다.
type ProxyRequestEvents = {
  on(
    event: 'proxyReq',
    listener: (
      proxyReq: { setHeader(name: string, value: string): void },
      req: { headers: { origin?: string } },
    ) => void,
  ): void;
};

// 개발 서버에서 보낸 상태 변경 요청은 Origin이 5173이라 Worker의 Origin 검사(CSRF, AGENTS §6)에 걸린다.
// 개발 프록시에서만 이 개발 서버의 Origin을 Worker 주소로 바꿔 전달한다. 다른 Origin은 그대로 넘겨 차단되게 하고,
// 서버의 검사 규칙은 바꾸지 않는다.
const toWorker: ProxyOptions = {
  target: WORKER_ORIGIN,
  changeOrigin: true,
  configure: (proxy) => {
    (proxy as unknown as ProxyRequestEvents).on('proxyReq', (proxyReq, req) => {
      if (req.headers.origin === DEV_SERVER_ORIGIN) proxyReq.setHeader('Origin', WORKER_ORIGIN);
    });
  },
};

export default defineConfig({
  root: 'src/web',
  plugins: [react()],
  build: {
    outDir: '../../dist/web',
    emptyOutDir: true,
  },
  server: {
    port: DEV_SERVER_PORT,
    strictPort: true,
    // Worker가 처리하는 경로(wrangler.jsonc run_worker_first와 같게 유지): API와 카카오 로그인·로그아웃
    proxy: { '/api': toWorker, '/auth': toWorker },
  },
});
