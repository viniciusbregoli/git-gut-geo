import { existsSync, readdirSync, readFileSync, renameSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseArgs } from 'node:util';
import type { Guide } from '../shared/plonkit.ts';
import { isSafeImagePath } from './plonkit/sync.ts';
import {
  batchResults,
  chunkBySize,
  costOf,
  ESTIMATED_USD_PER_IMAGE,
  isQuizzable,
  mimeTypeOf,
  parseVerdict,
  PROMPT_VERSION,
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

function fail(message: string): never {
  console.error(message);
  process.exit(1);
}

const maxUsd = Number(values['max-usd']);
if (!Number.isFinite(maxUsd) || maxUsd < 0) fail(`--max-usd must be a non-negative number, got "${values['max-usd']}".`);
const limit = values.limit === undefined ? Infinity : Number(values.limit);
if (values.limit !== undefined && (!Number.isInteger(limit) || limit < 0)) fail(`--limit must be a whole number of 0 or more, got "${values.limit}".`);

const dir = values.dir;

function writeJsonAtomic(path: string, value: unknown) {
  const temporary = `${path}.${process.pid}.partial`;
  writeFileSync(temporary, `${JSON.stringify(value, null, 2)}\n`);
  renameSync(temporary, path);
}

const cachePath = join(dir, 'vision.json');
const cache: VerdictCache = existsSync(cachePath) ? JSON.parse(readFileSync(cachePath, 'utf8')) : {};
const saveCache = () => writeJsonAtomic(cachePath, cache);

// Batches already paid for but not collected, by operation name. Saved before waiting,
// so a run that stops mid-wait picks them up next time instead of submitting them again.
const outstandingPath = join(dir, 'vision-batches.json');
let outstanding: string[] = existsSync(outstandingPath) ? JSON.parse(readFileSync(outstandingPath, 'utf8')) : [];
const saveOutstanding = () => writeJsonAtomic(outstandingPath, outstanding);

const apiKey = process.env.GEMINI_API_KEY;

async function call<T>(url: string, init?: RequestInit): Promise<T> {
  if (!apiKey) fail('GEMINI_API_KEY is not set.');
  const res = await fetch(url, { ...init, headers: { 'x-goog-api-key': apiKey, 'content-type': 'application/json' } });
  const body = (await res.json()) as T & { error?: { message?: string } };
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${body.error?.message ?? 'no message'}`);
  return body;
}

interface Operation {
  done?: boolean;
  metadata?: { state?: string };
  response?: { inlinedResponses?: unknown };
  error?: { message?: string };
}

let spent = 0;

const MAX_POLL_FAILURES = 10;

const forget = (name: string) => {
  outstanding = outstanding.filter((n) => n !== name);
  saveOutstanding();
};

/**
 * Waits for a batch, stores its verdicts and forgets it. A failed poll never
 * throws, so one batch's trouble cannot stop the others being collected.
 */
async function collect(name: string, label: string) {
  let operation: Operation;
  let failures = 0;
  for (;;) {
    try {
      operation = await call<Operation>(`${API}/${name}`);
      failures = 0;
      if (operation.done) break;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (message.startsWith('HTTP 404')) {
        // Expired or deleted: the result cannot be fetched any more, so its images are sent again next run.
        forget(name);
        console.log(`${label} no longer exists on the server. Its images are retried next run.`);
        return;
      }
      failures += 1;
      if (failures >= MAX_POLL_FAILURES) {
        console.log(`${label} not collected after ${failures} failed polls (${message}). It is picked up next run.`);
        return;
      }
    }
    await new Promise((resolve) => setTimeout(resolve, POLL_MS));
  }

  let flagged = 0;
  if (operation.error) {
    console.log(`${label} failed: ${operation.error.message ?? 'no message'}. Its images are retried next run.`);
  } else {
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
  }
  forget(name);
  if (!operation.error) {
    console.log(`${label}: ${operation.metadata?.state ?? 'done'}, ${flagged} giveaways, about US$${spent.toFixed(4)} spent so far`);
  }
}

if (outstanding.length > 0) {
  console.log(`${outstanding.length} batches from an earlier run were not collected.`);
  if (values['dry-run']) process.exit(0);
  await Promise.all([...outstanding].map((name) => collect(name, `Earlier batch ${name}`)));
  // Their images have no verdict yet, so selecting new work now would pay for them twice.
  if (outstanding.length > 0) {
    console.log(`${outstanding.length} batches are still not collected. Run again later to pick them up before checking new images.`);
    process.exit(0);
  }
}

const guides = readdirSync(join(dir, 'guides'))
  .filter((f) => f.endsWith('.json'))
  .map((f) => JSON.parse(readFileSync(join(dir, 'guides', f), 'utf8')) as Guide);

// One request per image not judged yet, or judged by an older prompt. An image shared by several tips is judged once.
const pending = new Map<string, string>();
for (const guide of guides) {
  for (const tip of guide.tips) {
    if (cache[tip.imageUrl]?.prompt === PROMPT_VERSION || !isSafeImagePath(tip.imageUrl) || !existsSync(join(dir, tip.imageUrl))) continue;
    pending.set(tip.imageUrl, guide.title);
  }
}

const affordable = Math.floor(maxUsd / ESTIMATED_USD_PER_IMAGE);
const todo = [...pending].slice(0, Math.min(affordable, limit));
console.log(
  `${Object.keys(cache).length} images already checked, ${pending.size} to check.` +
    ` This run: ${todo.length} images, at most about US$${(todo.length * ESTIMATED_USD_PER_IMAGE).toFixed(2)} (cap US$${maxUsd}).`,
);
if (values['dry-run'] || todo.length === 0) process.exit(0);

// Chunks are planned from file sizes (base64 is 4/3 of the bytes, plus the prompt),
// and each chunk's images are read only when it is submitted, so memory holds one batch.
const PROMPT_BYTES = 4096;
const plan = chunkBySize(
  todo,
  ([imageUrl]) => Math.ceil(statSync(join(dir, imageUrl)).size / 3) * 4 + PROMPT_BYTES,
  INLINE_LIMIT_BYTES,
);

function requestsFor(chunk: [string, string][]) {
  return chunk.flatMap(([imageUrl, country]) => {
    const bytes = readFileSync(join(dir, imageUrl));
    const mimeType = mimeTypeOf(bytes);
    if (!mimeType) {
      console.log(`${imageUrl}: not an image, skipped`);
      return [];
    }
    return [{ request: visionRequest(country, bytes, mimeType), metadata: { key: imageUrl } }];
  });
}

// Every batch is submitted first and collected as it finishes: a batch can sit in the
// queue for many minutes, so waiting on each in turn would take hours.
const submitted: [string, string][] = [];
for (const [i, planned] of plan.entries()) {
  const chunk = requestsFor(planned);
  if (chunk.length === 0) continue;
  const created = await call<{ name: string }>(`${API}/models/${VISION_MODEL}:batchGenerateContent`, {
    method: 'POST',
    body: JSON.stringify({
      batch: { display_name: `git-gut-geo-images-${i + 1}`, input_config: { requests: { requests: chunk } } },
    }),
  });
  outstanding.push(created.name);
  saveOutstanding();
  submitted.push([created.name, `Batch ${i + 1}/${plan.length}`]);
  console.log(`Batch ${i + 1}/${plan.length}: ${chunk.length} images submitted (${created.name})`);
}
await Promise.all(submitted.map(([name, label]) => collect(name, label)));

const verdicts = Object.values(cache);
const dropped = verdicts.filter((v) => !isQuizzable(v)).length;
const covered = verdicts.filter((v) => v.giveaway && isQuizzable(v)).length;
console.log(
  `Done. Of ${verdicts.length} checked images, ${covered} have a giveaway the card covers until the reveal` +
    ` and ${dropped} stay out of the deck. Spent about US$${spent.toFixed(4)}.`,
);
