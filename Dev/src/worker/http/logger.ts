export interface Logger {
  info(event: string, fields?: Record<string, unknown>): void;
  error(event: string, fields?: Record<string, unknown>): void;
}

// 전화번호·카카오 ID·토큰·세션·쿠키는 로그에 남기지 않는다 (AGENTS.md §6, architecture §9)
const SENSITIVE_KEY = /phone|kakao|token|cookie|authorization|secret|password/i;
const MAX_DEPTH = 6;

export function redact(value: unknown, depth = 0): unknown {
  if (depth >= MAX_DEPTH || value === null || typeof value !== 'object') return value;
  if (Array.isArray(value)) return value.map((item) => redact(item, depth + 1));
  return Object.fromEntries(
    Object.entries(value).map(([key, v]) => [
      key,
      SENSITIVE_KEY.test(key) ? '[REDACTED]' : redact(v, depth + 1),
    ]),
  );
}

export function createConsoleLogger(): Logger {
  const write = (level: 'info' | 'error', event: string, fields: Record<string, unknown> = {}) => {
    const line = JSON.stringify({ level, event, ...(redact(fields) as Record<string, unknown>) });
    if (level === 'error') console.error(line);
    else console.log(line);
  };
  return {
    info: (event, fields) => write('info', event, fields),
    error: (event, fields) => write('error', event, fields),
  };
}
