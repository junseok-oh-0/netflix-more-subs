// Dual Subtitles for Netflix - content script entry point.
// Wires preferences (chrome.storage) and the player watcher to one subtitle session per caption node.

import { DEFAULT_PREFERENCES, loadPreferences, onPreferencesChanged } from './preferences.js';
import { WATCH_VIDEO } from './netflix-selectors.js';
import { enableRightClick } from './dom.js';
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

enableRightClick();

watchPlayer((timedtext) => {
  // Previews on the browse page render captions outside the full player; ignore those.
  const watchVideo = timedtext.closest(WATCH_VIDEO);
  if (!watchVideo) return;
  if (session && session.timedtext === timedtext) return;
  if (session) session.dispose();
  session = createSubtitleSession(timedtext, watchVideo, prefs);
});
