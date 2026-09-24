import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { JSDOM } from 'jsdom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { bundleEntry, tick } from './helpers/extension-host.js';

const popupHtml = readFileSync(resolve(import.meta.dirname, '../src/popup.html'), 'utf8');

async function loadPopup(stored) {
  const dom = new JSDOM(popupHtml, { url: 'chrome-extension://test/popup.html', runScripts: 'outside-only' });
  const { window } = dom;
  const store = { ...stored };
  window.chrome = {
    storage: {
      sync: {
        get: vi.fn(async () => ({ ...store })),
        set: vi.fn(async (values) => Object.assign(store, values)),
      },
    },
    tabs: { create: vi.fn() },
  };
  window.eval(bundleEntry('popup.ts'));
  await tick();
  return { window, document: window.document, store, chrome: window.chrome };
}

describe('popup', () => {
  let popup;

  beforeEach(async () => {
    popup = await loadPopup({
      on_off: 0,
      button_up_down_mode: true,
      font_multiplier: '1.5',
      text_color: '#123456',
    });
  });

  it('fills controls from storage through normalization', () => {
    const d = popup.document;
    expect(d.getElementById('switchValue').checked).toBe(false);
    expect(d.getElementById('button_upDownValue').checked).toBe(true);
    expect(d.getElementById('mySlider').value).toBe('1.5');
    expect(d.getElementById('mySliderValue').textContent).toBe('1.5');
    expect(d.getElementById('myColorPicker').value).toBe('#123456');
    expect(d.getElementById('opacitySlider').value).toBe('0.8');
    expect(d.getElementById('originalSizeSlider').value).toBe('1');
  });

  it('writes a changed control straight to storage', () => {
    const slider = popup.document.getElementById('mySlider');
    slider.value = '0.7';
    slider.dispatchEvent(new popup.window.Event('change'));
    expect(popup.chrome.storage.sync.set).toHaveBeenCalledWith({ font_multiplier: 0.7 });
    expect(popup.document.getElementById('mySliderValue').textContent).toBe('0.7');

    const originalSizeSlider = popup.document.getElementById('originalSizeSlider');
    originalSizeSlider.value = '1.3';
    originalSizeSlider.dispatchEvent(new popup.window.Event('change'));
    expect(popup.chrome.storage.sync.set).toHaveBeenCalledWith({ originalFontMultiplier: 1.3 });
    expect(popup.document.getElementById('originalSizeSliderValue').textContent).toBe('1.3');

    const toggle = popup.document.getElementById('switchValue');
    toggle.checked = true;
    toggle.dispatchEvent(new popup.window.Event('change'));
    expect(popup.chrome.storage.sync.set).toHaveBeenCalledWith({ on_off: true });
  });

  it('reset restores appearance defaults but leaves the toggles alone', async () => {
    popup.document.getElementById('resetButton').click();
    await tick();
    expect(popup.chrome.storage.sync.set).toHaveBeenCalledWith({
      font_multiplier: 1,
      originalFontMultiplier: 1,
      opacity: 0.8,
      originaltext_opacity: 1,
      text_color: '#FFFFFF',
      originaltext_color: '#9bbad4',
    });
    expect(popup.document.getElementById('mySlider').value).toBe('1');
    expect(popup.document.getElementById('originalSizeSlider').value).toBe('1');
    expect(popup.document.getElementById('myColorPicker').value).toBe('#ffffff');
    expect(popup.document.getElementById('switchValue').checked).toBe(false);
  });
});

describe('popup: local translation settings', () => {
  it('defaults to the browser translator with the local settings section hidden', async () => {
    const popup = await loadPopup({});
    const d = popup.document;
    expect(d.getElementById('translatorEngine').value).toBe('browser');
    expect(d.getElementById('localSettings').hidden).toBe(true);
  });

  it('shows the local settings section and fills it when translator=local is stored', async () => {
    const popup = await loadPopup({
      translator: 'local',
      sourceLang: 'jpn_Jpan',
      targetLang: 'zho_Hans',
      localServerUrl: 'http://127.0.0.1:9000',
    });
    const d = popup.document;
    expect(d.getElementById('translatorEngine').value).toBe('local');
    expect(d.getElementById('localSettings').hidden).toBe(false);
    expect(d.getElementById('sourceLang').value).toBe('jpn_Jpan');
    expect(d.getElementById('targetLang').value).toBe('zho_Hans');
    expect(d.getElementById('localServerUrl').value).toBe('http://127.0.0.1:9000');
  });

  it('saves the engine choice and toggles the section when changed', async () => {
    const popup = await loadPopup({});
    const select = popup.document.getElementById('translatorEngine');
    select.value = 'local';
    select.dispatchEvent(new popup.window.Event('change'));
    expect(popup.chrome.storage.sync.set).toHaveBeenCalledWith({ translator: 'local' });
    expect(popup.document.getElementById('localSettings').hidden).toBe(false);
  });

  it('saves language and server URL fields on change', async () => {
    const popup = await loadPopup({ translator: 'local' });
    const d = popup.document;

    d.getElementById('targetLang').value = 'fra_Latn';
    d.getElementById('targetLang').dispatchEvent(new popup.window.Event('change'));
    expect(popup.chrome.storage.sync.set).toHaveBeenCalledWith({ targetLang: 'fra_Latn' });

    d.getElementById('localServerUrl').value = 'http://127.0.0.1:9000';
    d.getElementById('localServerUrl').dispatchEvent(new popup.window.Event('change'));
    expect(popup.chrome.storage.sync.set).toHaveBeenCalledWith({ localServerUrl: 'http://127.0.0.1:9000' });
  });
});
