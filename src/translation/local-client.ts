// Content-script side of local translation. Talks to background.ts via chrome.runtime.sendMessage
// (not fetch directly — Netflix's page CSP may block a content-script fetch to localhost).

import type { Translate, TranslateRequestMessage, TranslateResponseMessage } from './types';

const CACHE_MAX = 500;
const cache = new Map<string, string>();

function cacheKey(text: string, sourceLang: string, targetLang: string): string {
  return `${sourceLang}|${targetLang}|${text}`;
}

function remember(key: string, value: string): void {
  cache.set(key, value);
  if (cache.size > CACHE_MAX) {
    const oldest = cache.keys().next().value;
    if (oldest !== undefined) cache.delete(oldest);
  }
}

export const translateLocal: Translate = async (text, sourceLang, targetLang, serverUrl) => {
  const key = cacheKey(text, sourceLang, targetLang);
  const cached = cache.get(key);
  if (cached !== undefined) return cached;

  const message: TranslateRequestMessage = {
    type: 'nllb-translate',
    texts: [text],
    sourceLang,
    targetLang,
    serverUrl,
  };
  const response = await chrome.runtime.sendMessage<TranslateRequestMessage, TranslateResponseMessage>(
    message,
  );
  const translation = response?.translations?.[0];
  if (!response?.ok || translation === undefined) {
    throw new Error(response?.error ?? 'local translation failed: no response from background');
  }

  remember(key, translation);
  return translation;
};

// Exposed for tests only — production code never needs to reset the cache mid-session.
export function clearTranslationCache(): void {
  cache.clear();
}
