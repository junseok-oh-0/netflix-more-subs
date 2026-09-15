export const DEFAULT_PREFERENCES = Object.freeze({
  on_off: true,
  button_up_down_mode: true,
  font_multiplier: 1,
  opacity: 0.8,
  originaltext_opacity: 1,
  text_color: '#FFFFFF',
  originaltext_color: '#fff000',
});

const NUMBER_RANGES = {
  font_multiplier: [0.2, 2],
  opacity: [0, 1],
  originaltext_opacity: [0, 1],
};

const HEX_COLOR = /^#[0-9a-f]{6}$/i;

// Older versions stored booleans as 0/1 and numbers as strings; accept those and reject the rest.
export function normalizeValue(key, value) {
  const fallback = DEFAULT_PREFERENCES[key];
  if (typeof fallback === 'boolean') {
    if (typeof value === 'boolean') return value;
    if (value === 0 || value === 1 || value === '0' || value === '1') return value == 1;
    return fallback;
  }
  if (typeof fallback === 'number') {
    const n = typeof value === 'string' ? parseFloat(value) : value;
    const [min, max] = NUMBER_RANGES[key];
    return typeof n === 'number' && Number.isFinite(n) && n >= min && n <= max ? n : fallback;
  }
  return typeof value === 'string' && HEX_COLOR.test(value) ? value : fallback;
}

export function normalizePreferences(raw) {
  const out = {};
  for (const key of Object.keys(DEFAULT_PREFERENCES)) {
    out[key] = normalizeValue(key, raw == null ? undefined : raw[key]);
  }
  return out;
}

export function loadPreferences() {
  return chrome.storage.sync.get(null).then(normalizePreferences);
}

export function savePreference(key, value) {
  return chrome.storage.sync.set({ [key]: normalizeValue(key, value) });
}

export function savePreferences(values) {
  return chrome.storage.sync.set(normalizePreferences(values));
}

export function onPreferencesChanged(callback) {
  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName !== 'sync') return;
    for (const key of Object.keys(changes)) {
      if (key in DEFAULT_PREFERENCES) callback(key, normalizeValue(key, changes[key].newValue));
    }
  });
}
