import { TEXT_CONTAINER } from './netflix-selectors.js';
import { injectStyle, overflowsParent, readBaseFont, removeStyle, styledTextElements } from './dom.js';
import { SINGLE_LINE_CSS, bottomAlignedTo, fitFontSize, sideBySideLeftPx, topBelow } from './layout.js';

const CONTAINER_CLASS = 'my-timedtext-container';
const STYLE_ID = 'dsubs-single-line';
const STACK_GAP_PX = 8;
// UA sniffing is not foolproof but good enough to pick the translator workaround.
const IS_EDGE = navigator.userAgent.includes('Edg/');

const CONTAINER_BASE_STYLE =
  'display: block; text-align: center; position: absolute; font-size:21px; line-height:normal; color:#ffffff;' +
  ' text-shadow:#000000 0px 0px 7px; font-family:Netflix Sans,Helvetica Nueue,Helvetica,Arial,sans-serif; font-weight:bolder;';
// pointer-events: none keeps big text from blocking the seekbar
const CONTAINER_STACKED_STYLE =
  CONTAINER_BASE_STYLE +
  ' pointer-events: none; white-space: nowrap; max-width:100%; left: 50%; bottom: 22%; -webkit-transform: translateX(-50%); transform: translateX(-50%);';
const CONTAINER_SIDE_STYLE = CONTAINER_BASE_STYLE + ' white-space: pre-wrap; left: 2.5%; bottom: 18%;';

const ORIGINAL_STACKED_STYLE =
  'display: block; white-space: nowrap; max-width:100%; text-align: center; position: absolute; left: 50%; bottom: 22%; -webkit-transform: translateX(-50%); transform: translateX(-50%);';
const ORIGINAL_SIDE_STYLE =
  'display: block; white-space: pre-wrap; text-align: center; position: absolute; left: 2.5%; bottom: 18%;';

const OBSERVE_ORIGINAL = { attributes: true, childList: true, subtree: true, attributeFilter: ['style'] };
const OBSERVE_TRANSLATION = { attributes: true, childList: true, subtree: true };

// One session per Netflix caption node (.player-timedtext). `prefs` is shared with the caller and
// mutated there; applyPreferenceChange(key) tells the session to react to the new value.
export function createSubtitleSession(timedtext, watchVideo, prefs) {
  const stacked = () => prefs.button_up_down_mode;
  const s = {
    container: null,
    baseFont: NaN,
    currentSize: '',
    lastSubs: '',
    oldInset: timedtext.style.inset,
    observer: null,
    tracker: null,
  };

  // Should really happen on video exit; the old text lingers briefly until the next video starts.
  document.querySelectorAll('.' + CONTAINER_CLASS).forEach((el) => el.remove());
  removeStyle(STYLE_ID);

  watchVideo.insertAdjacentHTML(
    'beforeend',
    `<div class="${CONTAINER_CLASS}" style="${stacked() ? CONTAINER_STACKED_STYLE : CONTAINER_SIDE_STYLE}"><span id="my_subs_innertext"></span></div>`,
  );
  s.container = watchVideo.lastElementChild;
  s.container.setAttribute('translate', 'yes');
  if (stacked() && prefs.on_off) injectStyle(STYLE_ID, SINGLE_LINE_CSS);

  s.tracker = new MutationObserver(onTranslation);
  s.tracker.observe(s.container, OBSERVE_TRANSLATION);
  s.observer = new MutationObserver(onOriginalMutation);
  s.observer.observe(timedtext, OBSERVE_ORIGINAL);

  function original() {
    return timedtext.firstElementChild;
  }

  function rowRect() {
    return timedtext.getBoundingClientRect();
  }

  function onOriginalMutation(mutations) {
    for (const m of mutations) {
      if (m.type === 'childList' && m.target === timedtext) {
        if (m.addedNodes.length === 1) {
          s.observer.disconnect(); // stop observing so our own writes don't re-trigger this
          addSubs();
        } else if (timedtext.childElementCount === 0) {
          // No children means the mutation was a subtitle CLEAR rather than a refresh
          s.container.innerText = '';
          s.lastSubs = '';
        }
      } else if (
        prefs.on_off &&
        m.type === 'attributes' &&
        m.target === timedtext &&
        timedtext.firstChild &&
        timedtext.style.inset != s.oldInset
      ) {
        onResize();
      }
    }
  }

  // Tracks when the browser translator rewrites our container, to deal with text going offscreen.
  // Chrome wraps the text in <font>; Edge stamps _msttexthash on the container.
  function onTranslation(mutations) {
    for (const m of mutations) {
      if (m.target !== s.container) continue;
      const edge = m.type === 'attributes' && m.attributeName === '_msttexthash';
      const chrome = m.addedNodes.length == 1 && m.addedNodes[0].nodeName === 'FONT';
      if (edge || chrome) shrinkContainerToFit();
    }
  }

  // Netflix sometimes uses a separate container per row; force it back into one.
  function mergeContainers() {
    const containers = Array.from(timedtext.children);
    const first = containers[0];
    const firstText = styledTextElements(first)[0];
    const style = firstText ? firstText.getAttribute('style') : null;
    first.firstChild.innerText = containers.map((c) => c.firstChild.innerText).join('\n');
    containers.slice(1).forEach((c) => c.remove());
    if (style != null && first.firstElementChild) first.firstElementChild.setAttribute('style', style);
  }

  function addSubs() {
    const orig = original();
    // Ensures subs were added rather than removed, probably redundant
    if (orig != null && prefs.on_off) {
      s.baseFont = readBaseFont(timedtext, s.baseFont);
      if (timedtext.childElementCount > 1) mergeContainers();

      orig.setAttribute('style', stacked() ? ORIGINAL_STACKED_STYLE : ORIGINAL_SIDE_STYLE);
      orig.setAttribute('translate', 'no'); // stopped working for Edge
      // notranslate on Chrome slows down translation for some reason, so Edge only
      if (IS_EDGE) orig.className += ' notranslate';

      const text = orig.innerText;
      if (text !== s.lastSubs) {
        s.lastSubs = text;
        s.container.innerText = text;
      }
      s.currentSize = s.baseFont * prefs.font_multiplier + 'px';

      if (stacked()) shrinkOriginalToFit(orig);
      placeContainer(orig);

      updateStyle('text_color');
      updateStyle('opacity');
      updateStyle('font_size');
    }
    s.observer.observe(timedtext, OBSERVE_ORIGINAL);
  }

  // Netflix constantly refreshes the text, so styles have to be reapplied after a resize.
  function onResize() {
    // Spoofs the Edge translator into skipping, since the translate attribute doesn't work there
    for (const child of timedtext.children) child.setAttribute('_istranslated', '1');
    if (timedtext.childElementCount > 1) mergeContainers();

    // Font size changes often, so re-read the base font on every resize
    s.baseFont = readBaseFont(timedtext, s.baseFont);
    s.currentSize = s.baseFont * prefs.font_multiplier + 'px';
    updateStyle('font_size');
    if (original()) placeContainer(original());
  }

  // Stacked: hang from the original's measured bottom edge, so its line count never matters.
  // Side-by-side: share the original's bottom edge and start 10px to its right.
  function placeContainer(orig) {
    const origRect = orig.getBoundingClientRect();
    const playerRect = watchVideo.getBoundingClientRect();
    if (stacked()) {
      s.container.style.bottom = '';
      s.container.style.top = topBelow(origRect, playerRect, STACK_GAP_PX) + 'px';
    } else {
      s.container.style.top = '';
      s.container.style.bottom = bottomAlignedTo(origRect, playerRect) + 'px';
      s.container.style.left = sideBySideLeftPx(rowRect(), origRect.width) + 'px';
    }
  }

  // In Edge shrinking triggers translation, hence the notranslate on every span.
  function shrinkOriginalToFit(orig) {
    const targets = styledTextElements(orig);
    if (!targets.length) return;
    fitFontSize(
      s.baseFont,
      () => overflowsParent(orig, 150),
      (px) => {
        if (IS_EDGE && orig.firstElementChild) orig.firstElementChild.className += ' notranslate';
        for (const el of targets) {
          if (IS_EDGE) el.className += ' notranslate';
          el.style.fontSize = px + 'px';
        }
      },
    );
  }

  function shrinkContainerToFit() {
    const lines = s.container;
    fitFontSize(
      parseFloat(lines.style.fontSize),
      () => overflowsParent(lines, 50),
      (px) => (lines.style.fontSize = px + 'px'),
    );
  }

  function updateStyle(setting) {
    const lines = s.container;
    const originalLines = original() && original().firstElementChild;
    if (!originalLines) return;

    if (setting === 'font_size') {
      lines.style.fontSize = s.currentSize;
      shrinkContainerToFit();
    } else if (setting === 'text_color') {
      lines.style.color = prefs.text_color;
      originalLines.style.color = prefs.originaltext_color;
      for (const child of originalLines.children) child.style.color = prefs.originaltext_color;
    } else if (setting === 'opacity') {
      lines.style.opacity = prefs.opacity;
      originalLines.style.opacity = prefs.originaltext_opacity;
    }
  }

  function turnOff() {
    removeStyle(STYLE_ID);
    s.container.style.display = 'none';
    try {
      timedtext.querySelectorAll('*').forEach((e) => (e.style.color = '#FFFFFF'));
      const c = timedtext.querySelector(TEXT_CONTAINER);
      c.style.left = '50%';
      c.style.transform = 'translate(-50%)';
      c.style['-webkit-transform'] = 'translateX(-50%)';
    } catch {
      // no subs on screen
    }
  }

  function turnOn() {
    if (stacked()) injectStyle(STYLE_ID, SINGLE_LINE_CSS);
    s.container.style.display = 'block';
    try {
      for (const child of original().children) child.style.color = prefs.originaltext_color;
    } catch {
      // no subs on screen
    }
  }

  function exitStacked() {
    s.container.style.left = '';
    s.container.style.transform = '';
    s.container.style['-webkit-transform'] = '';
    s.container.style.whiteSpace = 'pre-wrap';
    removeStyle(STYLE_ID);
    try {
      const orig = original();
      orig.setAttribute('style', ORIGINAL_SIDE_STYLE);
      placeContainer(orig);
    } catch {
      // no subs on screen
    }
  }

  function enterStacked() {
    injectStyle(STYLE_ID, SINGLE_LINE_CSS);
    s.container.style.left = '50%';
    s.container.style.transform = 'translate(-50%)';
    s.container.style['-webkit-transform'] = 'translateX(-50%)';
    s.container.style.whiteSpace = 'nowrap';
    try {
      const orig = original();
      orig.setAttribute('style', ORIGINAL_STACKED_STYLE);
      placeContainer(orig);
    } catch {
      // no subs on screen
    }
  }

  function applyPreferenceChange(key) {
    switch (key) {
      case 'on_off':
        prefs.on_off ? turnOn() : turnOff();
        break;
      case 'font_multiplier':
        s.currentSize = s.baseFont * prefs.font_multiplier + 'px';
        updateStyle('font_size');
        break;
      case 'text_color':
      case 'originaltext_color':
        updateStyle('text_color');
        break;
      case 'opacity':
      case 'originaltext_opacity':
        updateStyle('opacity');
        break;
      case 'button_up_down_mode':
        prefs.button_up_down_mode ? enterStacked() : exitStacked();
        break;
    }
  }

  function dispose() {
    s.observer.disconnect();
    s.tracker.disconnect();
    s.container.remove();
    removeStyle(STYLE_ID);
  }

  return { timedtext, applyPreferenceChange, dispose };
}
