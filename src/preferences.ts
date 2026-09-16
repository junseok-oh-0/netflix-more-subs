export interface Preferences {
  on_off: boolean;
  button_up_down_mode: boolean;
  font_multiplier: number;
  opacity: number;
  originaltext_opacity: number;
  text_color: string;
  originaltext_color: string;
}

export type PreferenceKey = keyof Preferences;

export const DEFAULT_PREFERENCES: Readonly<Preferences> = Object.freeze({
  on_off: true,
  button_up_down_mode: true,
  font_multiplier: 1,
  opacity: 0.8,
  originaltext_opacity: 1,
  text_color: '#FFFFFF',
  originaltext_color: '#fff000',
});

const PREFERENCE_KEYS = Object.keys(DEFAULT_PREFERENCES) as PreferenceKey[];

const NUMBER_RANGES: Record<string, readonly [number, number]> = {
  font_multiplier: [0.2, 2],
  opacity: [0, 1],
  originaltext_opacity: [0, 1],
};

const HEX_COLOR = /^#[0-9a-f]{6}$/i;

export function isPreferenceKey(key: string): key is PreferenceKey {
  return key in DEFAULT_PREFERENCES;
}

// Older versions stored booleans as 0/1 and numbers as strings; accept those and reject the rest.
export function normalizeValue<K extends PreferenceKey>(key: K, value: unknown): Preferences[K] {
  const fallback = DEFAULT_PREFERENCES[key];
  if (typeof fallback === 'boolean') {
    if (typeof value === 'boolean') return value as Preferences[K];
    if (value === 0 || value === 1 || value === '0' || value === '1') return (value == 1) as Preferences[K];
    return fallback;
  }
  if (typeof fallback === 'number') {
    const n = typeof value === 'string' ? parseFloat(value) : value;
    const [min, max] = NUMBER_RANGES[key] ?? [-Infinity, Infinity];
    const ok = typeof n === 'number' && Number.isFinite(n) && n >= min && n <= max;
    return (ok ? n : fallback) as Preferences[K];
  }
  return (typeof value === 'string' && HEX_COLOR.test(value) ? value : fallback) as Preferences[K];
}

export function normalizePreferences(raw: unknown): Preferences {
  const source = (raw ?? {}) as Record<string, unknown>;
  const out = { ...DEFAULT_PREFERENCES };
  for (const key of PREFERENCE_KEYS) {
    (out as Record<PreferenceKey, unknown>)[key] = normalizeValue(key, source[key]);
  }
  return out;
}

export function loadPreferences(): Promise<Preferences> {
  return chrome.storage.sync.get(null).then(normalizePreferences);
}

export function savePreference(key: PreferenceKey, value: unknown): Promise<void> {
  return chrome.storage.sync.set({ [key]: normalizeValue(key, value) });
}

export function savePreferences(values: Record<string, unknown>): Promise<void> {
  const out: Record<string, unknown> = {};
  for (const key of Object.keys(values)) {
    if (isPreferenceKey(key)) out[key] = normalizeValue(key, values[key]);
  }
  return chrome.storage.sync.set(out);
}

export type PreferenceListener = <K extends PreferenceKey>(key: K, value: Preferences[K]) => void;

export function onPreferencesChanged(callback: PreferenceListener): void {
  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName !== 'sync') return;
    for (const key of Object.keys(changes)) {
      if (isPreferenceKey(key)) callback(key, normalizeValue(key, changes[key]?.newValue));
    }
  });
}
