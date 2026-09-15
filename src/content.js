// Dual Subtitles for Netflix - content script entry point.
// Wires preferences (chrome.storage) and the player watcher to one subtitle session per caption node.

import { DEFAULT_PREFERENCES, loadPreferences, onPreferencesChanged } from './preferences.js';
import { watchPlayer } from './player-watcher.js';
import { createSubtitleSession } from './subtitles.js';

const prefs = { ...DEFAULT_PREFERENCES };
let session = null;

function setPreference(key, value) {
  if (prefs[key] === value) return;
  prefs[key] = value;
  if (session) session.applyPreferenceChange(key);
}

loadPreferences()
  .catch(() => DEFAULT_PREFERENCES)
  .then((loaded) => Object.keys(loaded).forEach((key) => setPreference(key, loaded[key])));
onPreferencesChanged(setPreference);

watchPlayer((timedtext) => {
  if (session && session.timedtext === timedtext) return;
  if (session) session.dispose();
  session = createSubtitleSession(timedtext, prefs);
});
