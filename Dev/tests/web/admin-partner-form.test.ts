import { describe, expect, it } from 'vitest';
import { buildPartnerRequest, emptyPartnerForm } from '../../src/web/admin/partner-form';

describe('파트너 최소 등록 폼 [T61][S35]', () => {
  it('앞뒤 공백을 지운 회사명과 이메일을 등록 본문으로 만든다', () => {
    expect(
      buildPartnerRequest({ companyName: '  시연용 파트너 ', contactEmail: ' a@example.com ' }),
    ).toEqual({ ok: true, body: { companyName: '시연용 파트너', contactEmail: 'a@example.com' } });
  });

  it('빈 폼은 회사명·이메일 오류를 모두 돌려준다', () => {
    const result = buildPartnerRequest(emptyPartnerForm());

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(Object.keys(result.errors).sort()).toEqual(['companyName', 'contactEmail']);
  });

  it('이메일 형식이 아니면 이메일 칸만 오류다', () => {
    const result = buildPartnerRequest({ companyName: '시연용 파트너', contactEmail: 'abc' });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(Object.keys(result.errors)).toEqual(['contactEmail']);
  });

  it('공백만 있는 회사명은 회사명 칸만 오류다', () => {
    const result = buildPartnerRequest({ companyName: '   ', contactEmail: 'a@example.com' });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(Object.keys(result.errors)).toEqual(['companyName']);
  });

  it.each(['a b@example.com', 'a@example', 'a@@example.com', '@example.com', 'a@.com'])(
    '형식이 틀린 이메일(%s)은 거부한다',
    (contactEmail) => {
      const result = buildPartnerRequest({ companyName: '시연용 파트너', contactEmail });

      expect(result.ok).toBe(false);
    },
  );
});
