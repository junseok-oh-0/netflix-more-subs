// Pure layout math shared by the subtitle session. No DOM access here.

export const SINGLE_LINE_CSS =
  '.player-timedtext br{content: "";}' +
  '.my-timedtext-container br{content: "";}' +
  '.player-timedtext br:after{content: " ";}' +
  '.my-timedtext-container br:after{content: " ";}';

// Our container is absolutely positioned inside the player; these convert page rects into its
// top/bottom offsets. Measuring the original's box means its line count never matters.
export function topBelow(originalRect, playerRect, gap) {
  return originalRect.bottom - playerRect.top + gap;
}

export function bottomAlignedTo(originalRect, playerRect) {
  return playerRect.bottom - originalRect.bottom;
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
