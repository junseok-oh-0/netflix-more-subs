// Characterization tests: pin down what content.js v1.9 does today so refactors can be checked
// against it. These describe observed behavior, not desired behavior.
import { beforeEach, describe, expect, it } from 'vitest';
import { loadExtension, tick } from './helpers/extension-host.js';

async function startPlayback(host) {
  host.player.loadVideo();
  await tick();
  await tick();
}

describe('content.js on the fake player', () => {
  let host;

  beforeEach(async () => {
    host = await loadExtension();
  });

  it('applies stored preferences on load, through normalization', async () => {
    host = await loadExtension({
      preferences: { text_color: '#00ff00', on_off: 1, button_up_down_mode: false },
    });
    await startPlayback(host);
    host.player.showSubtitle(['x']);
    await tick();
    expect(host.document.querySelector('.my-timedtext-container').style.color).toBe('rgb(0, 255, 0)');
    expect(host.window.on_off).toBe(true);
    expect(host.window.up_down_mode).toBe(false);
  });

  it('falls back to defaults when storage is empty', async () => {
    await startPlayback(host);
    host.player.showSubtitle(['x']);
    await tick();
    expect(host.window.on_off).toBe(true);
    expect(host.window.current_multiplier).toBe(1);
    expect(host.document.querySelector('.my-timedtext-container').style.color).toBe('rgb(255, 255, 255)');
  });

  it('adds the player-bar button when a video loads', async () => {
    await startPlayback(host);
    const button = host.document.getElementById('myTutorialButton');
    expect(button).not.toBeNull();
    expect(button.parentElement.className).toBe('button-row');
  });

  it('creates the translated-subtitle container inside .watch-video', async () => {
    await startPlayback(host);
    const mine = host.document.querySelector('.watch-video > .my-timedtext-container');
    expect(mine).not.toBeNull();
    expect(mine.getAttribute('translate')).toBe('yes');
  });

  it('mirrors a one-container subtitle into its own container', async () => {
    await startPlayback(host);
    host.player.showSubtitle(['Hei, verden.']);
    await tick();
    expect(host.document.querySelector('.my-timedtext-container').textContent).toBe('Hei, verden.');
    expect(host.window.__errors).toEqual([]);
  });

  it('merges a two-container subtitle into one original container and mirrors both lines', async () => {
    await startPlayback(host);
    host.player.showSubtitle(['Linje en', 'Linje to'], { containers: 2 });
    await tick();
    const originals = host.document.querySelectorAll('.player-timedtext-text-container');
    expect(originals.length).toBe(1);
    expect(host.document.querySelector('.my-timedtext-container').textContent).toBe('Linje en\nLinje to');
  });

  it('marks the original subtitle as not-to-translate', async () => {
    await startPlayback(host);
    host.player.showSubtitle(['x']);
    await tick();
    const original = host.document.querySelector('.player-timedtext-text-container');
    expect(original.getAttribute('translate')).toBe('no');
  });

  it('empties its container when Netflix clears the subtitle', async () => {
    await startPlayback(host);
    host.player.showSubtitle(['x']);
    await tick();
    host.player.clearSubtitle();
    await tick();
    expect(host.document.querySelector('.my-timedtext-container').textContent).toBe('');
  });

  it('applies translated text color when storage changes', async () => {
    await startPlayback(host);
    host.player.showSubtitle(['x']);
    await tick();
    host.chrome.changePreference('text_color', '#ff0000');
    const mine = host.document.querySelector('.my-timedtext-container');
    expect(mine.style.color).toBe('rgb(255, 0, 0)');
  });

  it('hides its container when dual subs are switched off', async () => {
    await startPlayback(host);
    host.player.showSubtitle(['x']);
    await tick();
    host.chrome.changePreference('on_off', false);
    expect(host.document.querySelector('.my-timedtext-container').style.display).toBe('none');
    host.chrome.changePreference('on_off', true);
    expect(host.document.querySelector('.my-timedtext-container').style.display).toBe('block');
  });

  it('re-creates the player-bar button after Netflix rebuilds the controls', async () => {
    await startPlayback(host);
    host.player.hideControls();
    await tick();
    expect(host.document.getElementById('myTutorialButton')).toBeNull();
    host.player.showControls();
    await tick();
    expect(host.document.getElementById('myTutorialButton')).not.toBeNull();
  });

  it('keeps mirroring subtitles after an episode change with a single button', async () => {
    await startPlayback(host);
    host.player.showSubtitle(['first']);
    await tick();
    await startPlayback(host);
    host.player.showSubtitle(['second']);
    await tick();
    expect(host.document.querySelectorAll('.my-timedtext-container').length).toBe(1);
    expect(host.document.querySelector('.my-timedtext-container').textContent).toBe('second');
    expect(host.document.querySelectorAll('#myTutorialButton').length).toBe(1);
    expect(host.window.__errors).toEqual([]);
  });

  // Defects found in the 2026-09-15 live smoke test (REFACTORING_PLAN.md §5)
  it.todo('SM-1: keeps mirroring when autoplay swaps .player-timedtext without remounting the player view');
  it.todo('SM-2: places the translated line fully below a two-line original subtitle');
});
