import { existsSync, readdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseArgs } from 'node:util';
import type { Guide } from '../shared/plonkit.ts';
import { isSafeImagePath } from './plonkit/sync.ts';
import {
  batchResults,
  chunkBySize,
  costOf,
  ESTIMATED_USD_PER_IMAGE,
  mimeTypeOf,
  parseVerdict,
  visionRequest,
  VISION_MODEL,
  type VerdictCache,
} from './plonkit/vision.ts';

const API = 'https://generativelanguage.googleapis.com/v1beta';
const INLINE_LIMIT_BYTES = 18_000_000;
const POLL_MS = 30_000;

const { values } = parseArgs({
  options: {
    dir: { type: 'string', default: 'data/plonkit' },
    'max-usd': { type: 'string', default: '1' },
    limit: { type: 'string' },
    'dry-run': { type: 'boolean', default: false },
  },
});

const dir = values.dir;
const cachePath = join(dir, 'vision.json');
const cache: VerdictCache = existsSync(cachePath) ? JSON.parse(readFileSync(cachePath, 'utf8')) : {};
const saveCache = () => {
  const temporary = `${cachePath}.${process.pid}.partial`;
  writeFileSync(temporary, `${JSON.stringify(cache, null, 2)}\n`);
  renameSync(temporary, cachePath);
};

const guides = readdirSync(join(dir, 'guides'))
  .filter((f) => f.endsWith('.json'))
  .map((f) => JSON.parse(readFileSync(join(dir, 'guides', f), 'utf8')) as Guide);

// One request per image not judged yet. An image shared by several tips is judged once.
const pending = new Map<string, string>();
for (const guide of guides) {
  for (const tip of guide.tips) {
    if (cache[tip.imageUrl] || !isSafeImagePath(tip.imageUrl) || !existsSync(join(dir, tip.imageUrl))) continue;
    pending.set(tip.imageUrl, guide.title);
  }
}

const maxUsd = Number(values['max-usd']);
const affordable = Math.floor(maxUsd / ESTIMATED_USD_PER_IMAGE);
const todo = [...pending].slice(0, Math.min(affordable, Number(values.limit ?? Infinity)));
console.log(
  `${Object.keys(cache).length} images already checked, ${pending.size} to check.` +
    ` This run: ${todo.length} images, at most about US$${(todo.length * ESTIMATED_USD_PER_IMAGE).toFixed(2)} (cap US$${maxUsd}).`,
);
if (values['dry-run'] || todo.length === 0) process.exit(0);

const apiKey = process.env.GEMINI_API_KEY;
if (!apiKey) {
  console.error('GEMINI_API_KEY is not set.');
  process.exit(1);
}

async function call<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, { ...init, headers: { 'x-goog-api-key': apiKey!, 'content-type': 'application/json' } });
  const body = (await res.json()) as T & { error?: { message?: string } };
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${body.error?.message ?? 'no message'}`);
  return body;
}

const requests = todo.flatMap(([imageUrl, country]) => {
  const bytes = readFileSync(join(dir, imageUrl));
  const mimeType = mimeTypeOf(bytes);
  if (!mimeType) {
    console.log(`${imageUrl}: not an image, skipped`);
    return [];
  }
  return [{ request: visionRequest(country, bytes, mimeType), metadata: { key: imageUrl } }];
});

interface Operation {
  done?: boolean;
  metadata?: { state?: string };
  response?: { inlinedResponses?: unknown };
  error?: { message?: string };
}

let spent = 0;
const chunks = chunkBySize(requests, (r) => JSON.stringify(r).length, INLINE_LIMIT_BYTES);
for (const [i, chunk] of chunks.entries()) {
  const created = await call<{ name: string }>(`${API}/models/${VISION_MODEL}:batchGenerateContent`, {
    method: 'POST',
    body: JSON.stringify({
      batch: { display_name: `git-gut-geo-images-${i + 1}`, input_config: { requests: { requests: chunk } } },
    }),
  });
  console.log(`Batch ${i + 1}/${chunks.length}: ${chunk.length} images submitted (${created.name})`);

  let operation: Operation;
  for (;;) {
    operation = await call<Operation>(`${API}/${created.name}`);
    if (operation.done) break;
    await new Promise((resolve) => setTimeout(resolve, POLL_MS));
  }
  if (operation.error) {
    console.log(`Batch ${i + 1} failed: ${operation.error.message ?? 'no message'}. Its images are retried next run.`);
    continue;
  }

  let flagged = 0;
  for (const result of batchResults(operation)) {
    const imageUrl = result.metadata?.key;
    const verdict = result.response ? parseVerdict(result.response) : null;
    if (result.response) spent += costOf(result.response, true);
    if (!imageUrl || !verdict) {
      console.log(`${imageUrl ?? '?'}: no verdict (${result.error?.message ?? 'unreadable response'}), retried next run`);
      continue;
    }
    cache[imageUrl] = verdict;
    if (verdict.giveaway) flagged += 1;
  }
  saveCache();
  console.log(`Batch ${i + 1}: ${operation.metadata?.state ?? 'done'}, ${flagged} giveaways, about US$${spent.toFixed(4)} spent so far`);
}

const giveaways = Object.values(cache).filter((v) => v.giveaway).length;
console.log(`Done. ${giveaways} of ${Object.keys(cache).length} checked images are giveaways. Spent about US$${spent.toFixed(4)}.`);
