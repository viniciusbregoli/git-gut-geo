import type { AnswerRequest, AnswerResponse, SessionResponse } from '../../../shared/api.ts';
import type { Country } from '../../../shared/deck.ts';

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    ...init,
    headers: init?.body ? { 'Content-Type': 'application/json' } : undefined,
  });
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as { error?: string } | null;
    throw new Error(body?.error ?? `Request failed (${res.status})`);
  }
  return (await res.json()) as T;
}

export const api = {
  session: () => request<SessionResponse>('/api/session'),
  countries: () => request<Country[]>('/api/countries'),
  answer: (cardId: string, body: AnswerRequest) =>
    request<AnswerResponse>(`/api/cards/${encodeURIComponent(cardId)}/answer`, {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  suspend: (cardId: string) =>
    request<{ ok: true }>(`/api/cards/${encodeURIComponent(cardId)}/suspend`, {
      method: 'POST',
      body: JSON.stringify({ suspended: true }),
    }),
};
