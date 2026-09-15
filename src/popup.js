import { DEFAULT_PREFERENCES, loadPreferences, savePreference, savePreferences } from './preferences.js';

const STYLE_KEYS = ['font_multiplier', 'opacity', 'originaltext_opacity', 'text_color', 'originaltext_color'];

function byId(id) {
  return document.getElementById(id);
}

async function init() {
  window.addEventListener('click', (e) => {
    if (e.target.href !== undefined) {
      chrome.tabs.create({ url: e.target.href });
    }
  });

  const controls = {
    on_off: { el: byId('switchValue'), prop: 'checked', event: 'change' },
    button_up_down_mode: { el: byId('button_upDownValue'), prop: 'checked', event: 'change' },
    font_multiplier: { el: byId('mySlider'), prop: 'value', event: 'change', label: byId('mySliderValue') },
    originaltext_opacity: {
      el: byId('originalOpacitySlider'),
      prop: 'value',
      event: 'change',
      label: byId('originalOpacitySliderValue'),
    },
    opacity: { el: byId('opacitySlider'), prop: 'value', event: 'change', label: byId('opacitySliderValue') },
    originaltext_color: { el: byId('myOriginalColorPicker'), prop: 'value', event: 'input' },
    text_color: { el: byId('myColorPicker'), prop: 'value', event: 'input' },
  };

  function render(prefs) {
    for (const key of Object.keys(prefs)) {
      const c = controls[key];
      if (!c) continue;
      c.el[c.prop] = prefs[key];
      if (c.label) c.label.textContent = prefs[key];
    }
  }

  render(await loadPreferences());

  for (const [key, c] of Object.entries(controls)) {
    c.el.addEventListener(c.event, () => {
      const value = c.el[c.prop];
      if (c.label) c.label.textContent = value;
      savePreference(key, value);
    });
  }

  // Reset covers appearance only; the on/off and stacked toggles keep their state.
  byId('resetButton').addEventListener('click', async () => {
    const defaults = Object.fromEntries(STYLE_KEYS.map((k) => [k, DEFAULT_PREFERENCES[k]]));
    await savePreferences(defaults);
    render(defaults);
  });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
