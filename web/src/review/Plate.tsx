import { useState } from 'react';
import type { Box } from '../../../shared/deck.ts';
import { coverRect } from './covers.ts';

interface Props {
  src: string;
  covers: Box[];
  /** Covers lift once the answer is shown, so the reveal also teaches where in the country the clue is. */
  revealed: boolean;
}

/** The clue image, with any parts that give the answer away covered until the reveal. */
export function Plate({ src, covers, revealed }: Props) {
  const [ratio, setRatio] = useState<number | null>(null);
  // Until the image has loaded its size is unknown and covers cannot be placed, so keep it hidden.
  const waiting = covers.length > 0 && ratio === null;

  return (
    <figure className="plate">
      <img
        src={src}
        alt="The clue for this card"
        style={waiting ? { visibility: 'hidden' } : undefined}
        onLoad={(event) => setRatio(event.currentTarget.naturalWidth / event.currentTarget.naturalHeight)}
      />
      {ratio !== null &&
        covers.map((box, i) => (
          <span
            // Covers never reorder for a card, and the component is keyed by card.
            key={i}
            className={`plate__cover${revealed ? ' plate__cover--lifted' : ''}`}
            style={coverRect(box, ratio)}
            aria-hidden="true"
          />
        ))}
    </figure>
  );
}
