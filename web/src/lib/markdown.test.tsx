import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { inlineMarkdown } from './markdown.tsx';

const html = (text: string) => renderToStaticMarkup(<>{inlineMarkdown(text)}</>);

describe('inlineMarkdown', () => {
  it('renders bold and links', () => {
    expect(html('Plates have a **yellow strip**, see [this](https://example.com/x).')).toBe(
      'Plates have a <strong>yellow strip</strong>, see <a href="https://example.com/x" target="_blank" rel="noreferrer">this</a>.',
    );
  });

  it('escapes HTML instead of injecting it', () => {
    expect(html('<img src=x onerror=alert(1)>')).toBe('&lt;img src=x onerror=alert(1)&gt;');
  });

  it('leaves non-http links as plain text', () => {
    expect(html('[bad](javascript:alert(1))')).toBe('[bad](javascript:alert(1))');
  });
});
