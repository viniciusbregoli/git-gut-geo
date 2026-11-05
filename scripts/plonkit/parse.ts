import type { Guide, GuideIndexEntry, SectionTier, Tip } from '../../shared/plonkit.ts';
import { classifyTip, isMovingOnly } from './classify.ts';

export const PLONKIT_ORIGIN = 'https://www.plonkit.net';

const PRELOADED_DATA = /<script id="__PRELOADED_DATA__" type="application\/json">([\s\S]*?)<\/script>/;

interface RawIndexEntry {
  title?: unknown;
  slug?: unknown;
  code?: unknown;
  cat?: unknown;
  updatedAt?: unknown;
}

interface RawItem {
  kind?: unknown;
  id?: unknown;
  tags?: unknown;
  data?: { image?: { imageUrl?: unknown }; text?: unknown };
}

interface RawStep {
  kind?: unknown;
  title?: unknown;
  items?: unknown;
}

interface RawGuide {
  title?: unknown;
  slug?: unknown;
  code?: unknown;
  cat?: unknown;
  updatedAt?: unknown;
  steps?: unknown;
}

const isString = (value: unknown): value is string => typeof value === 'string';

const stringList = (value: unknown): string[] =>
  Array.isArray(value) ? value.filter(isString) : [];

function indexEntry(raw: RawIndexEntry): GuideIndexEntry | null {
  const { title, slug, code, updatedAt } = raw;
  if (!isString(title) || !isString(slug) || !isString(code) || !isString(updatedAt)) return null;
  return { title, slug, code, updatedAt, continent: stringList(raw.cat)[0] ?? 'Unknown' };
}

/** Parses the response of `GET /api/guides`. Malformed entries are dropped. */
export function parseGuideIndex(json: unknown): GuideIndexEntry[] {
  const data = (json as { data?: unknown })?.data;
  if (!Array.isArray(data)) throw new Error('Guide index has no data array');
  return data.flatMap((raw: RawIndexEntry) => indexEntry(raw) ?? []);
}

function sectionTier(title: string): SectionTier {
  return /^identifying\b/i.test(title) ? 'country' : 'region';
}

function parseTip(item: RawItem, section: string, tier: SectionTier): Tip | null {
  if (item.kind !== 'tip' || !isString(item.id)) return null;
  const imageUrl = item.data?.image?.imageUrl;
  const text = stringList(item.data?.text).map((p) => p.trim()).filter(Boolean);
  const tags = stringList(item.tags);
  // Image-to-country cards need an image; moving-only clues don't apply to No Move.
  if (!isString(imageUrl) || imageUrl === '' || text.length === 0 || isMovingOnly(tags)) return null;
  return { id: item.id, tier, section, tags, text, imageUrl, clueType: classifyTip(tags, text) };
}

/** Extracts a guide from a country page's embedded `__PRELOADED_DATA__` JSON. */
export function parseGuidePage(html: string): Guide {
  const match = PRELOADED_DATA.exec(html);
  if (!match?.[1]) throw new Error('Page has no __PRELOADED_DATA__ script');

  const guide = (JSON.parse(match[1]) as { data?: { public?: RawGuide } }).data?.public;
  const entry = guide && indexEntry(guide);
  if (!guide || !entry) throw new Error('Embedded data has no guide');

  const steps: RawStep[] = Array.isArray(guide.steps) ? guide.steps : [];
  const tips = steps.flatMap((step) => {
    if (step.kind !== 'tip' || !isString(step.title) || !Array.isArray(step.items)) return [];
    const section = step.title;
    const tier = sectionTier(section);
    return (step.items as RawItem[]).flatMap((item) => parseTip(item, section, tier) ?? []);
  });

  return { ...entry, sourceUrl: `${PLONKIT_ORIGIN}/${entry.slug}`, tips };
}
