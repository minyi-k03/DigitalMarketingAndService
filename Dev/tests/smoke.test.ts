import { SELF } from 'cloudflare:test';
import { describe, expect, it } from 'vitest';

describe('T01 스캐폴드 스모크', () => {
  it('GET /api/health는 200과 ok를 반환한다', async () => {
    const res = await SELF.fetch('http://example.com/api/health');

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ status: 'ok' });
  });
});
