import { describe, expect, it } from 'vitest';
import { ignoresKey } from './hotkeys.ts';

const key = (k: string, extra: Partial<Parameters<typeof ignoresKey>[0]> = {}) => ({
  key: k, shiftKey: false, metaKey: false, ctrlKey: false, altKey: false, typing: false, ...extra,
});

describe('ignoresKey', () => {
  it('runs plain keys', () => {
    expect(ignoresKey(key('1'))).toBe(false);
    expect(ignoresKey(key(' '))).toBe(false);
    expect(ignoresKey(key('Enter'))).toBe(false);
  });

  it('leaves modified keys and typing to the browser', () => {
    expect(ignoresKey(key(' ', { shiftKey: true }))).toBe(true);
    expect(ignoresKey(key('S', { shiftKey: true }))).toBe(true);
    expect(ignoresKey(key('Enter', { shiftKey: true }))).toBe(true);
    expect(ignoresKey(key('k', { metaKey: true }))).toBe(true);
    expect(ignoresKey(key('s', { typing: true }))).toBe(true);
  });

  it('runs a symbol that needs Shift, and Escape always', () => {
    expect(ignoresKey(key('?', { shiftKey: true }))).toBe(false);
    expect(ignoresKey(key('Escape', { typing: true, shiftKey: true }))).toBe(false);
  });
});
