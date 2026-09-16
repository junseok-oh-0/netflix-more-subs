import { describe, expect, it } from 'vitest';
import { bottomAlignedTo, fitFontSize, sideBySideLeftPx, topBelow } from '../src/layout.ts';

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
  it('topBelow puts our top edge a gap under the original, in player coordinates', () => {
    expect(topBelow({ bottom: 480 }, { top: 20 }, 8)).toBe(468);
  });

  it('bottomAlignedTo lines our bottom edge up with the original', () => {
    expect(bottomAlignedTo({ bottom: 480 }, { bottom: 560 })).toBe(80);
  });

  it('sideBySideLeftPx starts 10px after the original, which sits at 2.5% of the row', () => {
    expect(sideBySideLeftPx({ x: 100, width: 800 }, 200)).toBe(100 + 20 + 200 + 10);
  });
});
