import { describe, expect, it } from 'vitest';
import type { Box } from '../../shared/deck.ts';
import { batchResults, chunkBySize, costOf, coveredArea, coversFor, isQuizzable, mimeTypeOf, parseVerdict, visionRequest, type Verdict } from './vision.ts';

const answer = (text: string) => ({ candidates: [{ content: { parts: [{ text }] } }] });

describe('parseVerdict', () => {
  it('reads the JSON verdict', () => {
    expect(parseVerdict(answer('{"giveaway":true,"reason":"A map of the country."}'))).toMatchObject({
      giveaway: true,
      reason: 'A map of the country.',
    });
  });

  it('turns 0-1000 boxes into image fractions with a small margin', () => {
    const verdict = parseVerdict(answer('{"giveaway":true,"reason":"Locator map.","covers":[{"box_2d":[600,700,1000,1000]}]}'));
    const [box] = verdict!.covers;
    expect(box!.top).toBeCloseTo(0.585);
    expect(box!.left).toBeCloseTo(0.685);
    expect(box).toMatchObject({ bottom: 1, right: 1 });
  });

  it('treats a giveaway with a malformed box as one that cannot be covered', () => {
    const verdict = parseVerdict(answer('{"giveaway":true,"reason":"Map.","covers":[{"box_2d":[500,500,400,900]}]}'));
    expect(verdict).toMatchObject({ giveaway: true, covers: [] });
    expect(isQuizzable(verdict!)).toBe(false);
  });

  it('keeps a giveaway out when its covers would hide most of the image', () => {
    const verdict = (covers: Box[]): Verdict => ({ giveaway: true, reason: '', covers, model: 'm', prompt: 2 });
    const corner = { top: 0.5, left: 0.5, bottom: 1, right: 1 };
    expect(coveredArea([corner])).toBeCloseTo(0.25);
    expect(isQuizzable(verdict([corner]))).toBe(true);
    expect(isQuizzable(verdict([{ top: 0, left: 0, bottom: 0.95, right: 0.98 }]))).toBe(false);
    expect(isQuizzable(verdict([corner, corner, corner]))).toBe(false);
  });

  it('stretches covers that stop near an edge to that edge', () => {
    const namibia: Verdict = {
      giveaway: true,
      reason: '',
      covers: [{ top: 0.385, left: 0.69, bottom: 0.982, right: 0.911 }],
      model: 'm',
      prompt: 2,
    };
    expect(coversFor(namibia)).toEqual([{ top: 0.385, left: 0.69, bottom: 1, right: 1 }]);
    expect(coversFor({ ...namibia, giveaway: false })).toEqual([]);
  });

  it('ignores boxes on images that are not giveaways', () => {
    const verdict = parseVerdict(answer('{"giveaway":false,"reason":"Plates.","covers":[{"box_2d":[0,0,100,100]}]}'));
    expect(verdict?.covers).toEqual([]);
    expect(isQuizzable(verdict!)).toBe(true);
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
