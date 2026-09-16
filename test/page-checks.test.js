// The live smoke checks must themselves be trustworthy: run them against the fixture where we
// know the answers.
import { describe, expect, it } from 'vitest';
import { runPageChecks } from '../scripts/smoke/page-checks.js';
import { loadExtension, tick } from './helpers/extension-host.js';

async function playing(host, rects) {
  host.player.loadVideo();
  await tick();
  await tick();
  const zero = { x: 0, y: 0, top: 0, bottom: 0, left: 0, right: 0, width: 0, height: 0 };
  host.window.HTMLElement.prototype.getBoundingClientRect = function () {
    if (this.matches('.player-timedtext-text-container')) return { ...zero, ...rects.original };
    if (this.matches('.my-timedtext-container')) return { ...zero, ...rects.mirror };
    if (this.matches('.watch-video')) return { ...zero, ...rects.watchVideo };
    return zero;
  };
  host.player.showSubtitle(['Hei, verden.']);
  await tick();
}

const ids = (report, pass) => report.checks.filter((c) => c.pass === pass).map((c) => c.id);

describe('runPageChecks', () => {
  it('passes on a healthy stacked player', async () => {
    const host = await loadExtension();
    await playing(host, {
      original: { top: 400, bottom: 440, left: 300, right: 660, height: 40 },
      mirror: { top: 448, bottom: 490, left: 280, right: 680, height: 42 },
      watchVideo: { top: 0, bottom: 540, left: 0, right: 960 },
    });
    const report = runPageChecks(host.document, { mode: 'stacked' });
    expect(ids(report, false)).toEqual([]);
    expect(report.ok).toBe(true);
  });

  it('flags overlap, a missing translate flag, and a leftover button', async () => {
    const host = await loadExtension();
    await playing(host, {
      original: { top: 400, bottom: 440, left: 300, right: 660, height: 40 },
      mirror: { top: 430, bottom: 470, left: 280, right: 680, height: 40 },
      watchVideo: { top: 0, bottom: 540, left: 0, right: 960 },
    });
    host.document.querySelector('.player-timedtext-text-container').removeAttribute('translate');
    host.document.body.insertAdjacentHTML('beforeend', '<div id="myTutorialButton"></div>');
    const report = runPageChecks(host.document);
    expect(report.ok).toBe(false);
    expect(ids(report, false)).toEqual([
      'H1 no player-bar button',
      'A4 original is not translatable (translate="no")',
      'B3 no overlap (stacked)',
    ]);
  });

  it('reports no subtitle on screen without throwing', async () => {
    const host = await loadExtension();
    host.player.loadVideo();
    await tick();
    await tick();
    const report = runPageChecks(host.document);
    expect(ids(report, false)).toEqual(['B0 subtitle on screen']);
  });
});
