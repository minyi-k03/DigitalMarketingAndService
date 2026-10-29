import { Hono } from 'hono';

export const healthRoutes = () => new Hono().get('/api/health', (c) => c.json({ status: 'ok' }));
