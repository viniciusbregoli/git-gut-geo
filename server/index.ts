import { existsSync, mkdirSync } from 'node:fs';
import { serve } from '@hono/node-server';
import { serveStatic } from '@hono/node-server/serve-static';
import { createApp } from './app.ts';
import { loadCountries, loadGiveaways, loadGuides } from './content.ts';
import { openDb } from './db.ts';
import { syncDeck } from './deck.ts';

const port = Number(process.env.GGG_API_PORT ?? 4317);
const contentDir = process.env.GGG_CONTENT_DIR ?? 'data/plonkit';

mkdirSync('data', { recursive: true });
const db = openDb(process.env.GGG_DB ?? 'data/git-gut-geo.sqlite');
const guides = loadGuides(contentDir);
const giveaways = loadGiveaways(contentDir);
const deck = syncDeck(db, guides, giveaways);
console.log(`Deck: ${deck.cards} cards from ${guides.length} guides (${deck.retired} retired, ${giveaways.size} giveaway images left out)`);
if (guides.length === 0) console.log('No guides yet: run `pnpm fetch:plonkit` first.');

const app = createApp({ db, countries: loadCountries(contentDir, guides), contentDir });

// `pnpm build` output; in dev, Vite serves the frontend and proxies /api here.
if (existsSync('dist')) {
  app.use('/*', serveStatic({ root: './dist' }));
  app.get('*', serveStatic({ path: './dist/index.html' }));
}

serve({ fetch: app.fetch, hostname: '127.0.0.1', port }, (info) => {
  console.log(`git-gut-geo server on http://127.0.0.1:${info.port}`);
});
