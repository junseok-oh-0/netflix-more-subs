// In-page smoke checks for the live Netflix player. Self-contained on purpose: the function body
// is injected into the page as-is (npm run smoke:snippet), so it must not reference anything
// outside itself. It returns a plain report object; nothing here mutates the page.
//
// The browser translator is deliberately NOT required: both containers may show the same text.
// What matters is that the translate flags are set (original "no", ours "yes") and that the
// mirror follows the original without overlapping it.

function runPageChecks(doc, expected = {}) {
  const checks = [];
  const add = (id, pass, detail) => checks.push({ id, pass: Boolean(pass), detail });
  const rect = (el) => (el ? el.getBoundingClientRect() : null);
  const text = (el) => (el ? (el.innerText ?? el.textContent ?? '').replace(/\s+/g, ' ').trim() : '');
  const near = (a, b, tol = 1) => Math.abs(a - b) <= tol;
  const getComputedStyle = (el) => doc.defaultView.getComputedStyle(el);

  const watchVideo = doc.querySelector('.watch-video');
  const timedtext = watchVideo ? watchVideo.querySelector('.player-timedtext') : null;
  const original = timedtext ? timedtext.querySelector('.player-timedtext-text-container') : null;
  const mirrors = watchVideo ? watchVideo.querySelectorAll(':scope > .my-timedtext-container') : [];
  const mirror = mirrors[0] || null;

  // A. player + containers
  add('A1 player DOM present', watchVideo && timedtext, {
    watchVideo: !!watchVideo,
    timedtext: !!timedtext,
  });
  add('A2 exactly one mirror container inside .watch-video', mirrors.length === 1, {
    count: mirrors.length,
  });
  add('A3 mirror is translatable (translate="yes")', mirror && mirror.getAttribute('translate') === 'yes', {
    translate: mirror ? mirror.getAttribute('translate') : null,
  });

  // H. nothing from the old UI
  add('H1 no player-bar button', !doc.getElementById('myTutorialButton'));
  add('H2 no in-page settings panel', !doc.getElementById('dsubs_settings-panel'));

  const originalText = text(original);
  const mirrorText = text(mirror);
  const subtitleOnScreen = originalText.length > 0;
  const mode = mirror && mirror.style.top !== '' ? 'stacked' : 'side-by-side';

  if (!subtitleOnScreen) {
    add('B0 subtitle on screen', false, { note: 'no original subtitle text right now; B checks skipped' });
  } else {
    add('B0 subtitle on screen', true, { originalText });
    add('A4 original is not translatable (translate="no")', original.getAttribute('translate') === 'no', {
      translate: original.getAttribute('translate'),
    });
    const translated = !!(mirror && mirror.querySelector('font'));
    add('B1 mirror follows original text', translated || mirrorText === originalText, {
      originalText,
      mirrorText,
      translatorActive: translated,
    });

    const o = rect(original);
    const m = rect(mirror);
    const w = rect(watchVideo);
    const sized = o && m && o.height > 0 && m.height > 0;
    add('B2 both containers have a rendered box', sized, {
      original: o && { top: o.top, bottom: o.bottom, left: o.left, right: o.right },
      mirror: m && { top: m.top, bottom: m.bottom, left: m.left, right: m.right },
    });
    if (sized) {
      const noOverlap = mode === 'stacked' ? m.top >= o.bottom - 1 : m.left >= o.right - 1;
      add(`B3 no overlap (${mode})`, noOverlap, {
        mode,
        gap: mode === 'stacked' ? m.top - o.bottom : m.left - o.right,
      });
      add(
        'B4 mirror stays inside the player',
        m.left >= w.left - 1 && m.right <= w.right + 1 && m.bottom <= w.bottom + 1 && m.top >= w.top - 1,
        { player: { left: w.left, right: w.right, top: w.top, bottom: w.bottom } },
      );
    }
  }

  // E. styles vs expectations (optional)
  if (mirror) {
    const cs = getComputedStyle(mirror);
    const span = original ? original.querySelector('[style*="font-size"]') : null;
    const style = {
      mirrorColor: cs.color,
      mirrorOpacity: cs.opacity,
      mirrorFontPx: parseFloat(cs.fontSize),
      mirrorDisplay: cs.display,
      originalFontPx: span ? parseFloat(span.style.fontSize) : null,
      originalColor: span ? getComputedStyle(span).color : null,
      originalOpacity:
        original && original.firstElementChild ? getComputedStyle(original.firstElementChild).opacity : null,
    };
    if (expected.mirrorColor) add('E color', style.mirrorColor === expected.mirrorColor, style);
    if (expected.originalColor)
      add('E original color', style.originalColor === expected.originalColor, style);
    if (expected.mirrorOpacity != null)
      add('E opacity', near(+style.mirrorOpacity, expected.mirrorOpacity, 0.01), style);
    if (expected.fontMultiplier != null && style.originalFontPx) {
      add(
        'E font multiplier',
        near(style.mirrorFontPx, style.originalFontPx * expected.fontMultiplier, 2),
        style,
      );
    }
    if (expected.hidden != null) add('E on/off', (style.mirrorDisplay === 'none') === expected.hidden, style);
    if (expected.mode) add('E mode', mode === expected.mode, { mode });
    add('S style snapshot', true, style);
  }

  return {
    ok: checks.every((c) => c.pass || c.id.startsWith('S ')),
    url: doc.location ? doc.location.href : '',
    mode,
    checks,
  };
}

export { runPageChecks };
