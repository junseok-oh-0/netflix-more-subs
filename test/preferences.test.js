import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  DEFAULT_PREFERENCES,
  loadPreferences,
  normalizePreferences,
  onPreferencesChanged,
  savePreference,
  savePreferences,
} from '../src/preferences.js';

describe('normalizePreferences', () => {
  it('fills every key with defaults when storage is empty', () => {
    expect(normalizePreferences({})).toEqual(DEFAULT_PREFERENCES);
    expect(normalizePreferences(undefined)).toEqual(DEFAULT_PREFERENCES);
  });

  it('accepts legacy 0/1 booleans', () => {
    expect(normalizePreferences({ on_off: 1, button_up_down_mode: 0 })).toMatchObject({
      on_off: true,
      button_up_down_mode: false,
    });
  });

  it('keeps an explicit false instead of resetting it to the default', () => {
    expect(normalizePreferences({ button_up_down_mode: false }).button_up_down_mode).toBe(false);
    expect(normalizePreferences({ on_off: false }).on_off).toBe(false);
  });

  it('parses numeric strings from range inputs', () => {
    expect(normalizePreferences({ font_multiplier: '1.5', opacity: '0.3' })).toMatchObject({
      font_multiplier: 1.5,
      opacity: 0.3,
    });
  });

  it('keeps zero opacity instead of treating it as missing', () => {
    expect(normalizePreferences({ opacity: 0, originaltext_opacity: 0 })).toMatchObject({
      opacity: 0,
      originaltext_opacity: 0,
    });
  });

  it('falls back to defaults for NaN, out-of-range, or wrong-type numbers', () => {
    expect(
      normalizePreferences({ font_multiplier: 'abc', opacity: 7, originaltext_opacity: null }),
    ).toMatchObject({
      font_multiplier: 1,
      opacity: 0.8,
      originaltext_opacity: 1,
    });
  });

  it('accepts #rrggbb colors in any case and rejects anything else', () => {
    expect(normalizePreferences({ text_color: '#AbCdEf', originaltext_color: 'yellow' })).toMatchObject({
      text_color: '#AbCdEf',
      originaltext_color: '#fff000',
    });
  });

  it('drops unknown keys such as the retired button_on_off', () => {
    expect(Object.keys(normalizePreferences({ button_on_off: 1, junk: true }))).toEqual(
      Object.keys(DEFAULT_PREFERENCES),
    );
  });
});

describe('storage adapters', () => {
  afterEach(() => {
    delete globalThis.chrome;
  });

  function stubChrome() {
    const listeners = [];
    globalThis.chrome = {
      storage: {
        sync: {
          get: vi.fn(async () => ({ on_off: 0, opacity: '0.5', button_on_off: 1 })),
          set: vi.fn(async () => {}),
        },
        onChanged: { addListener: (fn) => listeners.push(fn) },
      },
    };
    return { listeners };
  }

  it('loadPreferences reads everything and normalizes', async () => {
    stubChrome();
    const prefs = await loadPreferences();
    expect(globalThis.chrome.storage.sync.get).toHaveBeenCalledWith(null);
    expect(prefs).toEqual({ ...DEFAULT_PREFERENCES, on_off: false, opacity: 0.5 });
  });

  it('savePreference normalizes before writing', async () => {
    stubChrome();
    await savePreference('font_multiplier', '1.3');
    expect(globalThis.chrome.storage.sync.set).toHaveBeenCalledWith({ font_multiplier: 1.3 });
  });

  it('savePreferences writes only the known keys it is given, normalized', async () => {
    stubChrome();
    await savePreferences({ font_multiplier: '1.3', text_color: '#00ff00', junk: 1 });
    expect(globalThis.chrome.storage.sync.set).toHaveBeenCalledWith({
      font_multiplier: 1.3,
      text_color: '#00ff00',
    });
  });

  it('onPreferencesChanged reports sync changes per known key, normalized', () => {
    const { listeners } = stubChrome();
    const seen = [];
    onPreferencesChanged((key, value) => seen.push([key, value]));
    listeners[0]({ on_off: { newValue: 0 }, junk: { newValue: 1 } }, 'sync');
    listeners[0]({ on_off: { newValue: 1 } }, 'local');
    expect(seen).toEqual([['on_off', false]]);
  });
});
