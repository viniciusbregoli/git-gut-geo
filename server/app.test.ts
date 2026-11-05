import { describe, expect, it } from 'vitest';
import { createApp } from './app.ts';

describe('createApp', () => {
  it('answers the health check', async () => {
    const res = await createApp().request('/api/health');

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
  });

  it('returns a JSON 404 for unknown API paths', async () => {
    const res = await createApp().request('/api/nope');

    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: 'Not found' });
  });
});
