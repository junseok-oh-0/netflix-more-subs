// Message protocol between the content script (which cannot reliably fetch a local server from
// Netflix's page context) and the background service worker (which does the actual fetch).

export interface TranslateRequestMessage {
  type: 'nllb-translate';
  texts: string[];
  sourceLang: string;
  targetLang: string;
  serverUrl: string;
}

export interface TranslateResponseMessage {
  ok: boolean;
  translations?: string[];
  error?: string;
}

export function isTranslateRequestMessage(value: unknown): value is TranslateRequestMessage {
  return (
    typeof value === 'object' &&
    value !== null &&
    (value as { type?: unknown }).type === 'nllb-translate' &&
    Array.isArray((value as { texts?: unknown }).texts)
  );
}

// Translates one piece of text. Implementations may cache and must reject/throw on failure
// rather than returning the original text, so callers can decide the fallback behavior.
export type Translate = (
  text: string,
  sourceLang: string,
  targetLang: string,
  serverUrl: string,
) => Promise<string>;
