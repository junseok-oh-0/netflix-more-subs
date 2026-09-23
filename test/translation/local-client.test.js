import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { clearTranslationCache, translateLocal } from '../../src/translation/local-client.ts';

describe('translateLocal', () => {
  beforeEach(() => {
    clearTranslationCache();
  });

  afterEach(() => {
    delete globalThis.chrome;
  });

  function stubChrome(handler) {
    const sent = [];
    globalThis.chrome = {
      runtime: {
        sendMessage: vi.fn(async (message) => {
          sent.push(message);
          return handler(message);
        }),
      },
    };
    return sent;
  }

  it('asks the background script and returns its translation', async () => {
    const sent = stubChrome(async () => ({ ok: true, translations: ['안녕'] }));
    const result = await translateLocal('hello', 'eng_Latn', 'kor_Hang', 'http://127.0.0.1:8008');
    expect(result).toBe('안녕');
    expect(sent).toEqual([
      {
        type: 'nllb-translate',
        texts: ['hello'],
        sourceLang: 'eng_Latn',
        targetLang: 'kor_Hang',
        serverUrl: 'http://127.0.0.1:8008',
      },
    ]);
  });

  it('caches by source/target/text and does not re-send an identical request', async () => {
    const sent = stubChrome(async () => ({ ok: true, translations: ['안녕'] }));
    await translateLocal('hello', 'eng_Latn', 'kor_Hang', 'http://127.0.0.1:8008');
    const result = await translateLocal('hello', 'eng_Latn', 'kor_Hang', 'http://127.0.0.1:8008');
    expect(result).toBe('안녕');
    expect(sent.length).toBe(1);
  });

  it('treats a different language pair for the same text as a cache miss', async () => {
    const sent = stubChrome(async (m) => ({ ok: true, translations: [`[${m.targetLang}]`] }));
    await translateLocal('hello', 'eng_Latn', 'kor_Hang', 'http://127.0.0.1:8008');
    await translateLocal('hello', 'eng_Latn', 'jpn_Jpan', 'http://127.0.0.1:8008');
    expect(sent.length).toBe(2);
  });

  it('rejects when background reports failure', async () => {
    stubChrome(async () => ({ ok: false, error: 'server unreachable' }));
    await expect(translateLocal('hi', 'eng_Latn', 'kor_Hang', 'http://127.0.0.1:8008')).rejects.toThrow(
      'server unreachable',
    );
  });

  it('rejects with a clear message when there is no response at all', async () => {
    stubChrome(async () => undefined);
    await expect(translateLocal('hi', 'eng_Latn', 'kor_Hang', 'http://127.0.0.1:8008')).rejects.toThrow(
      /no response/,
    );
  });

  it('does not cache a failed request', async () => {
    let calls = 0;
    stubChrome(async () => {
      calls++;
      return calls === 1 ? { ok: false, error: 'boom' } : { ok: true, translations: ['ok now'] };
    });
    await expect(translateLocal('hi', 'eng_Latn', 'kor_Hang', 'http://127.0.0.1:8008')).rejects.toThrow();
    const result = await translateLocal('hi', 'eng_Latn', 'kor_Hang', 'http://127.0.0.1:8008');
    expect(result).toBe('ok now');
    expect(calls).toBe(2);
  });
});
