import { DEFAULT_PREFERENCES, loadPreferences, savePreference, savePreferences } from './preferences';
import type { PreferenceKey, Preferences } from './preferences';

const STYLE_KEYS: PreferenceKey[] = [
  'originalFontMultiplier',
  'font_multiplier',
  'opacity',
  'originaltext_opacity',
  'text_color',
  'originaltext_color',
];

interface Control {
  el: HTMLInputElement;
  prop: 'checked' | 'value';
  event: 'change' | 'input';
  label?: HTMLElement;
}

function byId<T extends HTMLElement = HTMLElement>(id: string): T {
  const el = document.getElementById(id);
  if (!el) throw new Error(`popup: missing #${id}`);
  return el as T;
}

function input(id: string): HTMLInputElement {
  return byId<HTMLInputElement>(id);
}

async function init(): Promise<void> {
  window.addEventListener('click', (e) => {
    const href = (e.target as HTMLElement | null)?.getAttribute?.('href');
    if (href) chrome.tabs.create({ url: href });
  });

  // `translator` is a <select>, not an HTMLInputElement, and needs an extra hidden-section toggle
  // that no other control needs — it's wired separately below rather than forced into this map.
  const controls: Partial<Record<PreferenceKey, Control>> = {
    on_off: { el: input('switchValue'), prop: 'checked', event: 'change' },
    button_up_down_mode: { el: input('button_upDownValue'), prop: 'checked', event: 'change' },
    originalFontMultiplier: {
      el: input('originalSizeSlider'),
      prop: 'value',
      event: 'change',
      label: byId('originalSizeSliderValue'),
    },
    font_multiplier: { el: input('mySlider'), prop: 'value', event: 'change', label: byId('mySliderValue') },
    originaltext_opacity: {
      el: input('originalOpacitySlider'),
      prop: 'value',
      event: 'change',
      label: byId('originalOpacitySliderValue'),
    },
    opacity: {
      el: input('opacitySlider'),
      prop: 'value',
      event: 'change',
      label: byId('opacitySliderValue'),
    },
    originaltext_color: { el: input('myOriginalColorPicker'), prop: 'value', event: 'input' },
    text_color: { el: input('myColorPicker'), prop: 'value', event: 'input' },
    sourceLang: { el: input('sourceLang'), prop: 'value', event: 'change' },
    targetLang: { el: input('targetLang'), prop: 'value', event: 'change' },
    localServerUrl: { el: input('localServerUrl'), prop: 'value', event: 'change' },
  };

  function render(prefs: Partial<Preferences>): void {
    for (const key of Object.keys(prefs) as PreferenceKey[]) {
      const c = controls[key];
      const value = prefs[key];
      if (!c || value === undefined) continue;
      if (c.prop === 'checked') c.el.checked = Boolean(value);
      else c.el.value = String(value);
      if (c.label) c.label.textContent = String(value);
    }
  }

  const prefs = await loadPreferences();
  render(prefs);

  for (const [key, c] of Object.entries(controls) as [PreferenceKey, Control][]) {
    c.el.addEventListener(c.event, () => {
      const value = c.prop === 'checked' ? c.el.checked : c.el.value;
      if (c.label) c.label.textContent = String(value);
      savePreference(key, value);
    });
  }

  // Translator engine: a <select>, so it doesn't fit the checkbox/range/color Control shape above,
  // and switching it also needs to show/hide the local-server settings section.
  const translatorSelect = byId<HTMLSelectElement>('translatorEngine');
  const localSettings = byId('localSettings');

  function applyTranslatorVisibility(value: string): void {
    localSettings.hidden = value !== 'local';
  }

  translatorSelect.value = prefs.translator;
  applyTranslatorVisibility(prefs.translator);
  translatorSelect.addEventListener('change', () => {
    savePreference('translator', translatorSelect.value);
    applyTranslatorVisibility(translatorSelect.value);
  });

  // Reset covers appearance only; the on/off and stacked toggles keep their state.
  byId('resetButton').addEventListener('click', async () => {
    const defaults = Object.fromEntries(
      STYLE_KEYS.map((k) => [k, DEFAULT_PREFERENCES[k]]),
    ) as Partial<Preferences>;
    await savePreferences(defaults);
    render(defaults);
  });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => void init());
} else {
  void init();
}
