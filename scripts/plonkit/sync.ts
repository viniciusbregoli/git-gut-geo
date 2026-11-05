import type { Guide, GuideIndexEntry } from '../../shared/plonkit.ts';
import { PLONKIT_ORIGIN, parseGuideIndex, parseGuidePage } from './parse.ts';

export interface GuideStore {
  readIndex(): Promise<GuideIndexEntry[] | null>;
  writeIndex(index: GuideIndexEntry[]): Promise<void>;
  readGuide(slug: string): Promise<Guide | null>;
  writeGuide(guide: Guide): Promise<void>;
  hasImage(imageUrl: string): Promise<boolean>;
  writeImage(imageUrl: string, bytes: Uint8Array): Promise<void>;
}

export interface SyncDeps {
  fetchJson(url: string): Promise<unknown>;
  fetchText(url: string): Promise<string>;
  fetchBytes(url: string): Promise<Uint8Array>;
  sleep(ms: number): Promise<void>;
  store: GuideStore;
  log(message: string): void;
}

export interface SyncOptions {
  /** Limit the run to these slugs. */
  only?: string[];
  /** Re-fetch guides even when their updatedAt is unchanged. */
  force?: boolean;
  /** Pause between page requests, to stay polite to plonkit.net. */
  pageDelayMs: number;
  /** Pause between image downloads. */
  imageDelayMs: number;
}

export interface SyncResult {
  fetched: string[];
  skipped: string[];
  failed: { slug: string; error: string }[];
  images: number;
  /** Images that could not be downloaded; the next run retries them. */
  imageFailures: number;
}

/**
 * The download URL for a tip image. Plonk It's pages load images through this
 * resize endpoint (1920px, quality 80, WebP); the original path is hotlink
 * protected. The file is still stored under the tip's own imageUrl.
 */
export function imageDownloadUrl(imageUrl: string): string {
  return `${PLONKIT_ORIGIN}/images/resize/1920/80/${imageUrl.replace(/^\/images\//, '')}`;
}

/** Only plain site-relative paths are written to disk. */
export function isSafeImagePath(imageUrl: string): boolean {
  return /^\/images\/[\w\-./%]+$/.test(imageUrl) && !imageUrl.split('/').includes('..');
}

export async function syncGuides(deps: SyncDeps, options: SyncOptions): Promise<SyncResult> {
  const { store, log } = deps;
  const index = parseGuideIndex(await deps.fetchJson(`${PLONKIT_ORIGIN}/api/guides`));
  await store.writeIndex(index);

  const wanted = options.only ? index.filter((g) => options.only?.includes(g.slug)) : index;
  const result: SyncResult = { fetched: [], skipped: [], failed: [], images: 0, imageFailures: 0 };
  let requestedPage = false;

  for (const entry of wanted) {
    const local = await store.readGuide(entry.slug);
    const upToDate = !options.force && local?.updatedAt === entry.updatedAt;
    let guide: Guide;

    if (upToDate && local) {
      guide = local;
    } else {
      if (requestedPage) await deps.sleep(options.pageDelayMs);
      requestedPage = true;
      try {
        guide = parseGuidePage(await deps.fetchText(`${PLONKIT_ORIGIN}/${entry.slug}`));
        // The page names its own guide; storing it under another slug would overwrite that guide.
        if (guide.slug !== entry.slug) throw new Error(`page is for ${guide.slug}`);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        result.failed.push({ slug: entry.slug, error: message });
        log(`${entry.slug}: failed (${message})`);
        continue;
      }
    }

    // Unchanged guides still get their missing images retried, without a page request.
    let downloaded = 0;
    for (const tip of guide.tips) {
      if (!isSafeImagePath(tip.imageUrl) || (await store.hasImage(tip.imageUrl))) continue;
      await deps.sleep(options.imageDelayMs);
      try {
        await store.writeImage(tip.imageUrl, await deps.fetchBytes(imageDownloadUrl(tip.imageUrl)));
        downloaded += 1;
      } catch (error) {
        result.imageFailures += 1;
        log(`${entry.slug}: image ${tip.imageUrl} failed (${error instanceof Error ? error.message : error})`);
      }
    }
    result.images += downloaded;

    if (upToDate) {
      result.skipped.push(entry.slug);
      continue;
    }
    await store.writeGuide(guide);
    result.fetched.push(entry.slug);
    log(`${entry.slug}: ${guide.tips.length} tips, ${downloaded} new images`);
  }

  return result;
}
