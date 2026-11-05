import { describe, expect, it } from 'vitest';
import { classifyTip, isMovingOnly } from './classify.ts';

describe('classifyTip', () => {
  it('prefers a Plonk It tag over the text', () => {
    expect(classifyTip(['bollard'], ['Plates are yellow.'])).toBe('bollard');
  });

  it('skips tags with no clue type and falls back to the text', () => {
    expect(classifyTip(['important'], ['Look for the tall concrete poles.'])).toBe('pole');
  });

  it('classifies untagged tips by keyword', () => {
    expect(classifyTip([], ['Licence plates have a green strip on the right.'])).toBe('plates');
    expect(classifyTip([], ['The centre line is dashed yellow.'])).toBe('roadline');
    expect(classifyTip([], ['The Google car has a visible roof rack.'])).toBe('coverage');
    expect(classifyTip([], ['The alphabet uses an inverted circumflex.'])).toBe('language');
    expect(classifyTip([], ['The local word for street is short.'])).toBe('language');
    expect(classifyTip([], ['Kilometre markers are half red.'])).toBe('sign');
    expect(classifyTip([], ['Window frames are painted blue.'])).toBe('architecture');
    expect(classifyTip([], ['Terraced vineyards line the valley.'])).toBe('vegetation');
  });

  it('matches whole words only', () => {
    expect(classifyTip([], ['A plateau with nothing else in sight.'])).toBe('other');
  });

  it('returns other when nothing matches', () => {
    expect(classifyTip([], ['Watch for this.'])).toBe('other');
  });
});

describe('isMovingOnly', () => {
  it('flags tips tagged as moving info', () => {
    expect(isMovingOnly(['moving info'])).toBe(true);
    expect(isMovingOnly(['pole'])).toBe(false);
  });
});
