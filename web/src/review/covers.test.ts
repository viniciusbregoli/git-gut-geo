import { describe, expect, it } from 'vitest';
import { coverRect } from './covers.ts';

const corner = { top: 0.5, left: 0.75, bottom: 1, right: 1 };

describe('coverRect', () => {
  it('maps straight across when the image has the plate ratio', () => {
    expect(coverRect(corner, 1.6, 1.6)).toEqual({ left: '75.000%', top: '50.000%', width: '25.000%', height: '50.000%' });
  });

  it('accounts for bars above and below a wider image', () => {
    // A 16:9 image on a 16:10 plate fills 90% of the height, 5% bars top and bottom.
    expect(coverRect(corner, 16 / 9, 1.6)).toEqual({ left: '75.000%', top: '50.000%', width: '25.000%', height: '45.000%' });
    expect(coverRect({ top: 0, left: 0, bottom: 0.1, right: 0.1 }, 16 / 9, 1.6).top).toBe('5.000%');
  });

  it('accounts for bars at the sides of a narrower image', () => {
    // A square image on a 16:10 plate fills 62.5% of the width, centred.
    expect(coverRect({ top: 0, left: 0, bottom: 1, right: 1 }, 1, 1.6)).toEqual({
      left: '18.750%',
      top: '0.000%',
      width: '62.500%',
      height: '100.000%',
    });
  });
});
