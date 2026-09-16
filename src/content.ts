// Dual Subtitles for Netflix - content script entry point.
// Wires preferences (chrome.storage) and the player watcher to one subtitle session per caption node.

import { DEFAULT_PREFERENCES, loadPreferences, onPreferencesChanged } from './preferences';
import type { PreferenceKey, Preferences } from './preferences';
import { WATCH_VIDEO } from './netflix-selectors';
import { enableRightClick } from './dom';
import { watchPlayer } from './player-watcher';
import { createSubtitleSession } from './subtitles';
import type { SubtitleSession } from './subtitles';

const prefs: Preferences = { ...DEFAULT_PREFERENCES };
let session: SubtitleSession | null = null;

function setPreference<K extends PreferenceKey>(key: K, value: Preferences[K]): void {
  if (prefs[key] === value) return;
  prefs[key] = value;
  session?.applyPreferenceChange(key);
}

loadPreferences()
  .catch(() => DEFAULT_PREFERENCES)
  .then((loaded) => {
    for (const key of Object.keys(loaded) as PreferenceKey[]) setPreference(key, loaded[key]);
  });
onPreferencesChanged(setPreference);

enableRightClick();

watchPlayer((timedtext) => {
  // Previews on the browse page render captions outside the full player; ignore those.
  const watchVideo = timedtext.closest<HTMLElement>(WATCH_VIDEO);
  if (!watchVideo) return;
  if (session?.timedtext === timedtext) return;
  session?.dispose();
  session = createSubtitleSession(timedtext, watchVideo, prefs);
});
