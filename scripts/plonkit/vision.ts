/**
 * Flags tip images that give their answer away: captions naming a place, a map
 * of the country, labelled comparisons. Those tips stay readable in the guide
 * but never become quiz cards. Verdicts come from a Gemini vision model and are
 * cached per image, so each image is paid for once.
 */

export const VISION_MODEL = 'gemini-3.5-flash-lite';

// Paid tier list prices in USD per million tokens, checked 2026-11-04
// (ai.google.dev/gemini-api/docs/pricing). The Batch API costs half.
const PRICE_PER_M = { input: 0.3, output: 2.5 };
const BATCH_DISCOUNT = 0.5;

export interface Verdict {
  giveaway: boolean;
  reason: string;
  model: string;
}

export function visionPrompt(country: string): string {
  return `This image comes from a GeoGuessr study guide for ${country}. A flashcard will show it alone and ask "Which country is this from?", to train recognising countries from what is visible on the road.

It is a giveaway only if the answer is written or drawn onto the image by whoever made the guide:
- a caption, label or legend that names a country, region, state or continent;
- a flag or emblem added as an annotation;
- any map of the country, inset or full size, labelled or not: its outline alone identifies it;
- a side-by-side comparison whose halves are labelled with places.

It is NOT a giveaway when the identifying detail is part of the photographed scene, even if it names the country: licence plates and their country codes, road signs, place names on signs, shop fronts, writing on cars or buildings. Reading those is the skill being trained. Arrows, circles or highlights that point at a detail without naming a place are also fine.`;
}

const schema = {
  type: 'object',
  properties: { giveaway: { type: 'boolean' }, reason: { type: 'string' } },
  required: ['giveaway', 'reason'],
};

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
    const value = JSON.parse(text) as { giveaway?: unknown; reason?: unknown };
    if (typeof value.giveaway !== 'boolean') return null;
    return { giveaway: value.giveaway, reason: typeof value.reason === 'string' ? value.reason : '', model: VISION_MODEL };
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
export const ESTIMATED_USD_PER_IMAGE = ((450 * PRICE_PER_M.input + 80 * PRICE_PER_M.output) / 1_000_000) * BATCH_DISCOUNT;

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
