import { validator } from 'hono/validator';
import type { z } from 'zod';
import { DomainError } from '../platform/errors';

export function fieldErrors(error: z.ZodError): { field: string; message: string }[] {
  return error.issues.map((issue) => ({ field: issue.path.join('.'), message: issue.message }));
}

/** 쿼리 문자열을 zod로 검증한다. 실패하면 400 VALIDATION_FAILED(필드별 errors 포함) */
export const validateQuery = <S extends z.ZodType>(schema: S) =>
  validator('query', (value): z.output<S> => {
    const parsed = schema.safeParse(value);
    if (!parsed.success) {
      throw new DomainError('VALIDATION_FAILED', '쿼리 문자열이 올바르지 않습니다', {
        errors: fieldErrors(parsed.error),
      });
    }
    return parsed.data;
  });

/** JSON 본문을 zod로 검증한다. 실패하면 400 VALIDATION_FAILED(필드별 errors 포함) */
export const validateJson = <S extends z.ZodType>(schema: S) =>
  validator('json', (value): z.output<S> => {
    const parsed = schema.safeParse(value);
    if (!parsed.success) {
      throw new DomainError('VALIDATION_FAILED', '요청 본문이 올바르지 않습니다', {
        errors: fieldErrors(parsed.error),
      });
    }
    return parsed.data;
  });
