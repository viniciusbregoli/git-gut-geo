import { existsSync } from 'node:fs';
import { serve } from '@hono/node-server';
import { serveStatic } from '@hono/node-server/serve-static';
import { createApp } from './app.ts';

const port = Number(process.env.GGG_API_PORT ?? 4317);
const app = createApp();

// `pnpm build` output; in dev, Vite serves the frontend and proxies /api here.
if (existsSync('dist')) {
  app.use('/*', serveStatic({ root: './dist' }));
  app.get('*', serveStatic({ path: './dist/index.html' }));
}

serve({ fetch: app.fetch, hostname: '127.0.0.1', port }, (info) => {
  console.log(`git-gut-geo server on http://127.0.0.1:${info.port}`);
});
