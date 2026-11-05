import type { Box } from '../../../shared/deck.ts';

/** The clue frame's width over height, fixed by `.plate` in review.css. */
export const PLATE_RATIO = 16 / 10;

export interface CoverRect {
  left: string;
  top: string;
  width: string;
  height: string;
}

const pct = (n: number) => `${(n * 100).toFixed(3)}%`;

/**
 * Where a cover goes on the plate, in percentages of the plate. The image is
 * letterboxed with `object-fit: contain`, so a box in image fractions has to be
 * scaled into the part of the plate the image actually fills.
 */
export function coverRect(box: Box, imageRatio: number, plateRatio = PLATE_RATIO): CoverRect {
  const wider = imageRatio >= plateRatio;
  const fillWidth = wider ? 1 : imageRatio / plateRatio;
  const fillHeight = wider ? plateRatio / imageRatio : 1;
  const offsetX = (1 - fillWidth) / 2;
  const offsetY = (1 - fillHeight) / 2;
  return {
    left: pct(offsetX + box.left * fillWidth),
    top: pct(offsetY + box.top * fillHeight),
    width: pct((box.right - box.left) * fillWidth),
    height: pct((box.bottom - box.top) * fillHeight),
  };
}
