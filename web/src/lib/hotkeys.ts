import { useEffect, useRef } from 'react';

export type HotkeyMap = Record<string, (event: KeyboardEvent) => void>;

const pick = ({ key, shiftKey, metaKey, ctrlKey, altKey }: KeyboardEvent) => ({ key, shiftKey, metaKey, ctrlKey, altKey });

function isTyping(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName);
}

type KeyInfo = Pick<KeyboardEvent, 'key' | 'shiftKey' | 'metaKey' | 'ctrlKey' | 'altKey'> & { typing: boolean };

// Shift is allowed only when it produces the character itself, such as "?" (Shift+/).
// Shift+Space, Shift+Enter or Shift+S stay free for the browser.
function isShiftedShortcut({ key, shiftKey }: KeyInfo): boolean {
  return shiftKey && (key.length > 1 || key === ' ' || /\p{L}/u.test(key));
}

/** Whether a keydown should be left alone instead of running a shortcut. */
export function ignoresKey(info: KeyInfo): boolean {
  if (info.key === 'Escape') return false;
  return info.typing || info.metaKey || info.ctrlKey || info.altKey || isShiftedShortcut(info);
}

/**
 * Single-key shortcuts, keyed by `event.key` (e.g. "1", " ", "Enter", "r").
 * Ignored while typing in a field and when a modifier is held, except Escape
 * and shifted symbols such as "?".
 */
export function useHotkeys(map: HotkeyMap, enabled = true) {
  const latest = useRef(map);
  useEffect(() => {
    latest.current = map;
  });

  useEffect(() => {
    if (!enabled) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.repeat) return;
      if (ignoresKey({ ...pick(event), typing: isTyping(event.target) })) return;
      const handler = latest.current[event.key.length === 1 ? event.key.toLowerCase() : event.key];
      if (!handler) return;
      event.preventDefault();
      handler(event);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [enabled]);
}
