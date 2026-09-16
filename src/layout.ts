// Pure layout math shared by the subtitle session. No DOM access here.

export const SINGLE_LINE_CSS =
  '.player-timedtext br{content: "";}' +
  '.my-timedtext-container br{content: "";}' +
  '.player-timedtext br:after{content: " ";}' +
  '.my-timedtext-container br:after{content: " ";}';

export interface Box {
  top: number;
  bottom: number;
}

// Our container is absolutely positioned inside the player; these convert page rects into its
// top/bottom offsets. Measuring the original's box means its line count never matters.
export function topBelow(
  originalRect: Pick<Box, 'bottom'>,
  playerRect: Pick<Box, 'top'>,
  gap: number,
): number {
  return originalRect.bottom - playerRect.top + gap;
}

export function bottomAlignedTo(originalRect: Pick<Box, 'bottom'>, playerRect: Pick<Box, 'bottom'>): number {
  return playerRect.bottom - originalRect.bottom;
}

// Side-by-side mode: original sits at left 2.5% of the row; ours starts 10px after it ends.
export function sideBySideLeftPx(rowRect: { x: number; width: number }, originalWidth: number): number {
  return Math.trunc(rowRect.x) + Math.trunc(rowRect.width) * 0.025 + Math.trunc(originalWidth) + 10;
}

// Shrinks in steps while overflows() holds, never below min. apply(px) is called for each step.
export function fitFontSize(
  startPx: number,
  overflows: () => boolean,
  apply: (px: number) => void,
  { min = 8, step = 2 }: { min?: number; step?: number } = {},
): number {
  let size = startPx;
  while (overflows() && size > min) {
    size -= step;
    apply(size);
  }
  return size;
}
