/**
 * Fetches Plonk It guides (CC BY-NC-SA 4.0) into data/plonkit for personal study.
 * The output is gitignored and must never be committed or redistributed.
 *
 *   pnpm fetch:plonkit                  # every guide whose updatedAt changed
 *   pnpm fetch:plonkit --only portugal  # one guide (repeatable)
 *   pnpm fetch:plonkit --force          # ignore updatedAt
 *
 * Set FIRECRAWL_URL (e.g. http://127.0.0.1:3002) to retry pages a plain fetch
 * cannot read through a self-hosted Firecrawl instance.
 */
import { setTimeout as sleep } from 'node:timers/promises';
import { parseArgs } from 'node:util';
import { fileStore } from './plonkit/store.ts';
import { syncGuides } from './plonkit/sync.ts';

// The resize endpoint renders images on demand, so a slow response is normal; a hung one is not.
const REQUEST_TIMEOUT_MS = 60_000;
const USER_AGENT = 'git-gut-geo/0.1 (personal study tool; https://github.com/viniciusbregoli/git-gut-geo)';

const { values } = parseArgs({
  options: {
    only: { type: 'string', multiple: true },
    force: { type: 'boolean', default: false },
    'page-delay': { type: 'string', default: '2000' },
    'image-delay': { type: 'string', default: '250' },
    out: { type: 'string', default: 'data/plonkit' },
  },
});

async function get(url: string): Promise<Response> {
  const res = await fetch(url, {
    headers: { 'User-Agent': USER_AGENT },
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  return res;
}

async function viaFirecrawl(url: string): Promise<string> {
  const endpoint = process.env.FIRECRAWL_URL;
  if (!endpoint) throw new Error('no FIRECRAWL_URL set');
  const res = await fetch(`${endpoint}/v1/scrape`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url, formats: ['rawHtml'] }),
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS * 2),
  });
  const body = (await res.json()) as { success?: boolean; data?: { rawHtml?: string } };
  if (!body.success || !body.data?.rawHtml) throw new Error(`Firecrawl could not scrape ${url}`);
  return body.data.rawHtml;
}

async function fetchPage(url: string): Promise<string> {
  try {
    const html = await (await get(url)).text();
    if (html.includes('__PRELOADED_DATA__')) return html;
    throw new Error('page has no embedded data');
  } catch (error) {
    if (!process.env.FIRECRAWL_URL) throw error;
    console.warn(`${url}: ${(error as Error).message}, retrying through Firecrawl`);
    return viaFirecrawl(url);
  }
}

const result = await syncGuides(
  {
    fetchJson: async (url) => (await get(url)).json(),
    fetchText: fetchPage,
    fetchBytes: async (url) => new Uint8Array(await (await get(url)).arrayBuffer()),
    sleep: (ms) => sleep(ms),
    store: fileStore(values.out),
    log: (message) => console.log(message),
  },
  {
    only: values.only,
    force: values.force,
    pageDelayMs: Number(values['page-delay']),
    imageDelayMs: Number(values['image-delay']),
  },
);

console.log(
  `Done: ${result.fetched.length} fetched, ${result.skipped.length} unchanged, ` +
    `${result.failed.length} failed, ${result.images} images downloaded, ${result.imageFailures} images failed.`,
);
if (result.failed.length > 0) process.exitCode = 1;
