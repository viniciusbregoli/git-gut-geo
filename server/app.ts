import { Hono } from 'hono';

export function createApp() {
  const app = new Hono();

  app.get('/api/health', (c) => c.json({ ok: true }));

  // Registered last so the static frontend fallback never answers an API path.
  app.all('/api/*', (c) => c.json({ error: 'Not found' }, 404));

  return app;
}
