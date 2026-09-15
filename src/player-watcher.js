import { TIMEDTEXT } from './netflix-selectors.js';

// Reports every .player-timedtext element that appears in the page. Netflix mounts one inside a
// fresh .watch-video--player-view for a new title, but on autoplay it keeps the player view and
// only swaps the caption node, so the caption node itself is what we key on.
export function watchPlayer(onTimedtext) {
  const observer = new MutationObserver((mutations) => {
    let found = null;
    for (const mutation of mutations) {
      for (const node of mutation.addedNodes) {
        if (node.nodeType !== Node.ELEMENT_NODE) continue;
        const timedtext = node.matches(TIMEDTEXT) ? node : node.querySelector(TIMEDTEXT);
        if (timedtext) found = timedtext;
      }
    }
    if (found) onTimedtext(found);
  });
  observer.observe(document.documentElement, { childList: true, subtree: true });
  return observer;
}
