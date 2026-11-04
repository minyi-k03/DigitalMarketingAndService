import { z } from 'zod';

/** api/openapi.yaml의 ServiceCategory. 관리·공개 카탈로그 라우트가 함께 쓴다 */
export const serviceCategory = z.enum([
  'BIGTECH',
  'AI',
  'DELIVERY',
  'OTT',
  'CLOUD',
  'LEARNING',
  'ETC',
]);
