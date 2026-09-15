import { describe, expect, it } from 'vitest';
import { fitFontSize, originalBottomPx, sideBySideLeftPx, stackedTranslatedBottomPx } from '../src/layout.js';

describe('fitFontSize', () => {
  it('leaves the size alone when nothing overflows', () => {
    const applied = [];
    expect(
      fitFontSize(
        32,
        () => false,
        (px) => applied.push(px),
      ),
    ).toBe(32);
    expect(applied).toEqual([]);
  });

  it('steps down by 2px until the overflow check passes', () => {
    let current = 32;
    const applied = [];
    const result = fitFontSize(
      32,
      () => current > 26,
      (px) => {
        current = px;
        applied.push(px);
      },
    );
    expect(result).toBe(26);
    expect(applied).toEqual([30, 28, 26]);
  });

  it('never shrinks below the 8px floor even if it still overflows', () => {
    expect(
      fitFontSize(
        12,
        () => true,
        () => {},
      ),
    ).toBe(8);
  });
});

describe('positions', () => {
  it('originalBottomPx adds the inset top to the percentage of the row height', () => {
    expect(originalBottomPx('12px 0px 0px 0px', '10%', 500)).toBe(62);
  });

  it('stackedTranslatedBottomPx places ours one scaled line plus 10px below the original', () => {
    expect(stackedTranslatedBottomPx(100, 32, 1.5)).toBe(100 - 48 - 10);
  });

  it('sideBySideLeftPx starts 10px after the original, which sits at 2.5% of the row', () => {
    expect(sideBySideLeftPx({ x: 100, width: 800 }, 200)).toBe(100 + 20 + 200 + 10);
  });
});
