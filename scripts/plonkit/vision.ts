/**
 * Flags tip images that give their answer away: captions naming a place, a map
 * of the country, labelled comparisons. When the giveaway is a small added part
 * (a locator map in a corner, a caption), the verdict also says where it is, so
 * the card can cover it until the answer is revealed. Otherwise the tip stays
 * readable in the guide but never becomes a quiz card. Verdicts come from a
 * Gemini vision model and are cached per image, so each image is paid for once.
 */

export const VISION_MODEL = 'gemini-3.5-flash-lite';

// Paid tier list prices in USD per million tokens, checked 2026-11-04
// (ai.google.dev/gemini-api/docs/pricing). The Batch API costs half.
const PRICE_PER_M = { input: 0.3, output: 2.5 };
const BATCH_DISCOUNT = 0.5;

/** Bumped whenever the prompt or schema changes, so older verdicts are checked again. */
export const PROMPT_VERSION = 2;

import type { Box } from '../../shared/deck.ts';

export interface Verdict {
  giveaway: boolean;
  reason: string;
  /** Where the giveaway sits when covering it leaves the rest of the image usable. Empty when the whole image gives it away. */
  covers: Box[];
  model: string;
  prompt: number;
}

/** Whether a tip with this verdict can be a card: no giveaway, or one that can be covered. */
export function isQuizzable(verdict: Verdict | undefined): boolean {
  // Verdicts from before covers existed have none, so their giveaways stay out.
  return !verdict || !verdict.giveaway || (verdict.covers ?? []).length > 0;
}

export function visionPrompt(country: string): string {
  return `This image comes from a GeoGuessr study guide for ${country}. A flashcard will show it alone and ask "Which country is this from?", to train recognising countries from what is visible on the road.

It is a giveaway only if the answer is written or drawn onto the image by whoever made the guide:
- a caption, label or legend that names a country, region, state or continent;
- a flag or emblem added as an annotation;
- any map of the country, inset or full size, labelled or not: its outline alone identifies it;
- a side-by-side comparison whose halves are labelled with places.

It is NOT a giveaway when the identifying detail is part of the photographed scene, even if it names the country: licence plates and their country codes, road signs, place names on signs, shop fronts, writing on cars or buildings. Reading those is the skill being trained. Arrows, circles or highlights that point at a detail without naming a place are also fine, and so are labels that name no place, such as camera generations ("Gen 3"), views ("Front", "Back"), or plate types ("Standard", "Military").

If it is a giveaway and every giveaway element is a small added part that can be covered while the rest of the photo still shows the clue (an inset or locator map in a corner, a round or zoomed detail map, a caption, a pasted flag or plate graphic), list each of those parts, every map included in "covers" as a box_2d of [ymin, xmin, ymax, xmax] normalised to 0-1000, drawn generously around the whole element. Leave "covers" empty when the giveaway is the image itself, such as a full map or a labelled side-by-side comparison, and when it is not a giveaway.`;
}

const schema = {
  type: 'object',
  properties: {
    giveaway: { type: 'boolean' },
    reason: { type: 'string' },
    covers: {
      type: 'array',
      items: {
        type: 'object',
        properties: { box_2d: { type: 'array', items: { type: 'integer' } } },
        required: ['box_2d'],
      },
    },
  },
  required: ['giveaway', 'reason', 'covers'],
};

// Covers grow a little past the model's box, so the edge of an inset never peeks out.
const COVER_MARGIN = 0.015;

function toBox(raw: unknown): Box | null {
  const box = (raw as { box_2d?: unknown } | null)?.box_2d;
  if (!Array.isArray(box) || box.length !== 4 || !box.every((n) => typeof n === 'number')) return null;
  const [ymin, xmin, ymax, xmax] = (box as number[]).map((n) => Math.min(Math.max(n / 1000, 0), 1)) as [number, number, number, number];
  if (ymax <= ymin || xmax <= xmin) return null;
  return {
    top: Math.max(ymin - COVER_MARGIN, 0),
    left: Math.max(xmin - COVER_MARGIN, 0),
    bottom: Math.min(ymax + COVER_MARGIN, 1),
    right: Math.min(xmax + COVER_MARGIN, 1),
  };
}

/** A generateContent request body for one image. */
export function visionRequest(country: string, image: Uint8Array, mimeType: string) {
  return {
    contents: [
      {
        parts: [
          { text: visionPrompt(country) },
          { inline_data: { mime_type: mimeType, data: Buffer.from(image).toString('base64') } },
        ],
      },
    ],
    generationConfig: {
      responseMimeType: 'application/json',
      responseSchema: schema,
      // Low resolution is about 260 tokens per image and still reads captions.
      mediaResolution: 'MEDIA_RESOLUTION_LOW',
      thinkingConfig: { thinkingLevel: 'minimal' },
    },
  };
}

interface GenerateResponse {
  candidates?: { content?: { parts?: { text?: string }[] } }[];
  usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number; thoughtsTokenCount?: number };
}

/** Reads the verdict out of a generateContent response; null when the model returned nothing usable. */
export function parseVerdict(response: GenerateResponse): Verdict | null {
  const text = response.candidates?.[0]?.content?.parts?.map((p) => p.text ?? '').join('');
  if (!text) return null;
  try {
    const value = JSON.parse(text) as { giveaway?: unknown; reason?: unknown; covers?: unknown };
    if (typeof value.giveaway !== 'boolean') return null;
    const covers = value.giveaway && Array.isArray(value.covers) ? value.covers.map(toBox) : [];
    // A cover the model drew badly cannot be trusted to hide the giveaway: treat the whole image as one.
    if (covers.includes(null)) return { giveaway: true, reason: String(value.reason ?? ''), covers: [], model: VISION_MODEL, prompt: PROMPT_VERSION };
    return {
      giveaway: value.giveaway,
      reason: typeof value.reason === 'string' ? value.reason : '',
      covers: covers as Box[],
      model: VISION_MODEL,
      prompt: PROMPT_VERSION,
    };
  } catch {
    return null;
  }
}

/** What a response cost, in USD. */
export function costOf(response: GenerateResponse, batch: boolean): number {
  const usage = response.usageMetadata ?? {};
  const output = (usage.candidatesTokenCount ?? 0) + (usage.thoughtsTokenCount ?? 0);
  const usd = ((usage.promptTokenCount ?? 0) * PRICE_PER_M.input + output * PRICE_PER_M.output) / 1_000_000;
  return batch ? usd * BATCH_DISCOUNT : usd;
}

/** Upper estimate for one image before sending it, used to stop at the spending cap. */
export const ESTIMATED_USD_PER_IMAGE = ((500 * PRICE_PER_M.input + 120 * PRICE_PER_M.output) / 1_000_000) * BATCH_DISCOUNT;

/** The cache file maps each tip image path to its verdict. */
export type VerdictCache = Record<string, Verdict>;

export function mimeTypeOf(bytes: Uint8Array): string | null {
  const ascii = (from: number, to: number) => String.fromCharCode(...bytes.slice(from, to));
  if (ascii(0, 4) === 'RIFF' && ascii(8, 12) === 'WEBP') return 'image/webp';
  if (bytes[0] === 0x89 && ascii(1, 4) === 'PNG') return 'image/png';
  if (bytes[0] === 0xff && bytes[1] === 0xd8) return 'image/jpeg';
  return null;
}

/** Splits requests into groups whose JSON stays under the inline batch limit (20 MB). */
export function chunkBySize<T>(items: T[], sizeOf: (item: T) => number, maxBytes: number): T[][] {
  const chunks: T[][] = [];
  let current: T[] = [];
  let size = 0;
  for (const item of items) {
    const itemSize = sizeOf(item);
    if (current.length > 0 && size + itemSize > maxBytes) {
      chunks.push(current);
      current = [];
      size = 0;
    }
    current.push(item);
    size += itemSize;
  }
  if (current.length > 0) chunks.push(current);
  return chunks;
}

export interface InlinedResponse {
  metadata?: { key?: string };
  response?: GenerateResponse;
  error?: { message?: string };
}

/** Results of a finished batch operation. The REST shape nests the list one level down. */
export function batchResults(operation: { response?: { inlinedResponses?: unknown } }): InlinedResponse[] {
  const inlined = operation.response?.inlinedResponses;
  if (Array.isArray(inlined)) return inlined as InlinedResponse[];
  const nested = (inlined as { inlinedResponses?: unknown } | undefined)?.inlinedResponses;
  return Array.isArray(nested) ? (nested as InlinedResponse[]) : [];
}
