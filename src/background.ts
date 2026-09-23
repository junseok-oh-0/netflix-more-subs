import { isTranslateRequestMessage } from './translation/types';
import type { TranslateRequestMessage, TranslateResponseMessage } from './translation/types';

chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === 'install') {
    chrome.tabs.create({ url: chrome.runtime.getURL('tutorial.html') });
  }
});

// The content script can't reliably fetch a local server from Netflix's page context, so it asks
// the service worker to do it instead.
async function fetchTranslation(req: TranslateRequestMessage): Promise<string[]> {
  const res = await fetch(new URL('/translate', req.serverUrl), {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ texts: req.texts, source_lang: req.sourceLang, target_lang: req.targetLang }),
  });
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as { detail?: string } | null;
    throw new Error(body?.detail ?? `translation server returned ${res.status}`);
  }
  const data = (await res.json()) as { translations: string[] };
  return data.translations;
}

chrome.runtime.onMessage.addListener((message: unknown, _sender, sendResponse) => {
  if (!isTranslateRequestMessage(message)) return undefined;

  fetchTranslation(message)
    .then((translations) => sendResponse({ ok: true, translations } satisfies TranslateResponseMessage))
    .catch((err: unknown) =>
      sendResponse({
        ok: false,
        error: err instanceof Error ? err.message : String(err),
      } satisfies TranslateResponseMessage),
    );
  return true; // keep the message channel open for the async sendResponse above
});
