import { describe, expect, it } from 'vitest';
import { batchResults, chunkBySize, costOf, mimeTypeOf, parseVerdict, visionRequest } from './vision.ts';

const answer = (text: string) => ({ candidates: [{ content: { parts: [{ text }] } }] });

describe('parseVerdict', () => {
  it('reads the JSON verdict', () => {
    expect(parseVerdict(answer('{"giveaway":true,"reason":"A map of the country."}'))).toMatchObject({
      giveaway: true,
      reason: 'A map of the country.',
    });
  });

  it('returns null for empty or malformed answers, so the image is retried', () => {
    expect(parseVerdict({})).toBeNull();
    expect(parseVerdict(answer('not json'))).toBeNull();
    expect(parseVerdict(answer('{"reason":"no flag"}'))).toBeNull();
  });
});

describe('costOf', () => {
  it('prices input and output tokens, halved for batches', () => {
    const usage = { usageMetadata: { promptTokenCount: 1_000_000, candidatesTokenCount: 1_000_000 } };
    expect(costOf(usage, false)).toBeCloseTo(2.8);
    expect(costOf(usage, true)).toBeCloseTo(1.4);
  });
});

describe('visionRequest', () => {
  it('sends the country, the image and a JSON schema at low resolution', () => {
    const request = visionRequest('Testland', new Uint8Array([1, 2, 3]), 'image/webp');
    const [prompt, image] = request.contents[0]!.parts;
    expect(prompt).toMatchObject({ text: expect.stringContaining('Testland') });
    expect(image).toEqual({ inline_data: { mime_type: 'image/webp', data: 'AQID' } });
    expect(request.generationConfig.mediaResolution).toBe('MEDIA_RESOLUTION_LOW');
  });
});

describe('mimeTypeOf', () => {
  it('recognises WebP, PNG and JPEG by their signature', () => {
    const bytes = (text: string) => new Uint8Array([...text].map((c) => c.charCodeAt(0)));
    expect(mimeTypeOf(bytes('RIFF\0\0\0\0WEBPVP8 '))).toBe('image/webp');
    expect(mimeTypeOf(new Uint8Array([0x89, 0x50, 0x4e, 0x47]))).toBe('image/png');
    expect(mimeTypeOf(new Uint8Array([0xff, 0xd8, 0xff]))).toBe('image/jpeg');
    expect(mimeTypeOf(bytes('<!doctype html>'))).toBeNull();
  });
});

describe('chunkBySize', () => {
  it('starts a new chunk before one would pass the limit', () => {
    expect(chunkBySize([4, 4, 4, 9], (n) => n, 10)).toEqual([[4, 4], [4], [9]]);
  });
});

describe('batchResults', () => {
  it('reads results whether or not the list is nested', () => {
    const item = { metadata: { key: '/images/a.png' } };
    expect(batchResults({ response: { inlinedResponses: [item] } })).toEqual([item]);
    expect(batchResults({ response: { inlinedResponses: { inlinedResponses: [item] } } })).toEqual([item]);
    expect(batchResults({})).toEqual([]);
  });
});
