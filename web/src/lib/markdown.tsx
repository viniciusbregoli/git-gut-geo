import type { ReactNode } from 'react';

const TOKEN = /\*\*(.+?)\*\*|\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g;

/**
 * Renders the inline markdown Plonk It tips use: **bold** and [links](https://...).
 * Everything else stays plain text, so nothing from the guide is injected as HTML.
 */
export function inlineMarkdown(text: string): ReactNode[] {
  const out: ReactNode[] = [];
  let last = 0;
  for (const match of text.matchAll(TOKEN)) {
    const index = match.index ?? 0;
    if (index > last) out.push(text.slice(last, index));
    if (match[1] !== undefined) {
      out.push(<strong key={index}>{match[1]}</strong>);
    } else {
      out.push(
        <a key={index} href={match[3]} target="_blank" rel="noreferrer">
          {match[2]}
        </a>,
      );
    }
    last = index + match[0].length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}
