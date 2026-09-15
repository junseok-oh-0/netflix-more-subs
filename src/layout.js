// Pure layout math shared by the subtitle session. No DOM access here.

export const SINGLE_LINE_CSS =
  '.player-timedtext br{content: "";}' +
  '.my-timedtext-container br{content: "";}' +
  '.player-timedtext br:after{content: " ";}' +
  '.my-timedtext-container br:after{content: " ";}';

// Bottom edge (px) of the original subtitle within the player.
// Netflix writes bottom as a percentage; the leading "." turns "10%" into 0.1.
// KNOWN: "5%" becomes 0.5, and a two-line original is not accounted for (SM-2, Phase 4).
export function originalBottomPx(insetStyle, bottomStyle, rowHeight) {
  const insetTop = parseFloat(String(insetStyle).split(' ')[0]);
  return insetTop + parseFloat('.' + bottomStyle) * rowHeight;
}

export function stackedTranslatedBottomPx(originalBottom, baseFont, multiplier) {
  return originalBottom - baseFont * multiplier - 10;
}

// Side-by-side mode: original sits at left 2.5% of the row; ours starts 10px after it ends.
export function sideBySideLeftPx(rowRect, originalWidth) {
  return parseInt(rowRect.x) + parseInt(rowRect.width) * 0.025 + parseInt(originalWidth) + 10;
}

// Shrinks in steps while overflows() holds, never below min. apply(px) is called for each step.
export function fitFontSize(startPx, overflows, apply, { min = 8, step = 2 } = {}) {
  let size = startPx;
  while (overflows() && size > min) {
    size -= step;
    apply(size);
  }
  return size;
}
