import { JSDOM } from 'jsdom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { bundleEntry, tick } from './helpers/extension-host.js';

function loadBackground() {
  const dom = new JSDOM('', { url: 'chrome-extension://test/background.html', runScripts: 'outside-only' });
  const { window } = dom;
  const messageListeners = [];
  const installedListeners = [];
  window.fetch = vi.fn();
  window.chrome = {
    runtime: {
      getURL: (p) => 'chrome-extension://test' + p,
      onInstalled: { addListener: (fn) => installedListeners.push(fn) },
      onMessage: { addListener: (fn) => messageListeners.push(fn) },
    },
    tabs: { create: vi.fn() },
  };
  window.eval(bundleEntry('background.ts'));
  return { window, fetch: window.fetch, onMessage: messageListeners[0] };
}

// Simulates chrome calling the listener the way the real runtime does: onMessage handlers get
// (message, sender, sendResponse) and, for an async response, the listener must return true.
function dispatch(onMessage, message) {
  return new Promise((resolve) => {
    const keepOpen = onMessage(message, {}, resolve);
    expect(keepOpen).toBe(true);
  });
}

describe('background: nllb-translate message handling', () => {
  let bg;

  beforeEach(() => {
    bg = loadBackground();
  });

  it('POSTs to <serverUrl>/translate with snake_case fields and resolves with translations', async () => {
    bg.fetch.mockResolvedValue({
      ok: true,
      json: async () => ({ translations: ['안녕'] }),
    });

    const response = await dispatch(bg.onMessage, {
      type: 'nllb-translate',
      texts: ['hello'],
      sourceLang: 'eng_Latn',
      targetLang: 'kor_Hang',
      serverUrl: 'http://127.0.0.1:8008',
    });

    expect(response).toEqual({ ok: true, translations: ['안녕'] });
    expect(bg.fetch).toHaveBeenCalledTimes(1);
    const [url, init] = bg.fetch.mock.calls[0];
    expect(String(url)).toBe('http://127.0.0.1:8008/translate');
    expect(init.method).toBe('POST');
    expect(JSON.parse(init.body)).toEqual({
      texts: ['hello'],
      source_lang: 'eng_Latn',
      target_lang: 'kor_Hang',
    });
  });

  it('resolves ok:false with the server detail message on a non-2xx response', async () => {
    bg.fetch.mockResolvedValue({
      ok: false,
      status: 422,
      json: async () => ({ detail: 'language codes must look like eng_Latn' }),
    });

    const response = await dispatch(bg.onMessage, {
      type: 'nllb-translate',
      texts: ['hi'],
      sourceLang: 'xx',
      targetLang: 'kor_Hang',
      serverUrl: 'http://127.0.0.1:8008',
    });

    expect(response).toEqual({ ok: false, error: 'language codes must look like eng_Latn' });
  });

  it('resolves ok:false when the server is unreachable', async () => {
    // Must be the window's own TypeError: background.ts runs in that realm (via window.eval), and
    // `instanceof Error` there only recognizes errors constructed from window.Error/TypeError.
    bg.fetch.mockRejectedValue(new bg.window.TypeError('Failed to fetch'));

    const response = await dispatch(bg.onMessage, {
      type: 'nllb-translate',
      texts: ['hi'],
      sourceLang: 'eng_Latn',
      targetLang: 'kor_Hang',
      serverUrl: 'http://127.0.0.1:8008',
    });

    expect(response).toEqual({ ok: false, error: 'Failed to fetch' });
  });

  it('ignores messages that are not nllb-translate requests', async () => {
    const sendResponse = vi.fn();
    const keepOpen = bg.onMessage({ type: 'something-else' }, {}, sendResponse);
    await tick();
    expect(keepOpen).toBeUndefined();
    expect(sendResponse).not.toHaveBeenCalled();
    expect(bg.fetch).not.toHaveBeenCalled();
  });
});
