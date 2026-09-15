// Behavior of the content script on the fake player. These pin down what the extension does so
// refactors can be checked against it.
import { beforeEach, describe, expect, it } from 'vitest';
import { loadExtension, tick } from './helpers/extension-host.js';

async function startPlayback(host) {
  host.player.loadVideo();
  await tick();
  await tick();
}

const mine = (host) => host.document.querySelector('.my-timedtext-container');

describe('content script on the fake player', () => {
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
    expect(mine(host).style.color).toBe('rgb(0, 255, 0)');
    expect(mine(host).style.left).not.toBe('50%');
    expect(mine(host).style.whiteSpace).toBe('pre-wrap');
  });

  it('falls back to defaults when storage is empty (stacked, white)', async () => {
    await startPlayback(host);
    host.player.showSubtitle(['x']);
    await tick();
    expect(mine(host).style.color).toBe('rgb(255, 255, 255)');
    expect(mine(host).style.whiteSpace).toBe('nowrap');
    expect(host.document.getElementById('dsubs-single-line')).not.toBeNull();
  });

  it('creates the translated-subtitle container inside .watch-video', async () => {
    await startPlayback(host);
    const el = host.document.querySelector('.watch-video > .my-timedtext-container');
    expect(el).not.toBeNull();
    expect(el.getAttribute('translate')).toBe('yes');
  });

  it('mirrors a one-container subtitle into its own container', async () => {
    await startPlayback(host);
    host.player.showSubtitle(['Hei, verden.']);
    await tick();
    expect(mine(host).textContent).toBe('Hei, verden.');
    expect(host.window.__errors).toEqual([]);
  });

  it('merges a two-container subtitle into one original container and mirrors both lines', async () => {
    await startPlayback(host);
    host.player.showSubtitle(['Linje en', 'Linje to'], { containers: 2 });
    await tick();
    expect(host.document.querySelectorAll('.player-timedtext-text-container').length).toBe(1);
    expect(mine(host).textContent).toBe('Linje en\nLinje to');
  });

  it('marks the original subtitle as not-to-translate', async () => {
    await startPlayback(host);
    host.player.showSubtitle(['x']);
    await tick();
    expect(host.document.querySelector('.player-timedtext-text-container').getAttribute('translate')).toBe(
      'no',
    );
  });

  it('empties its container when Netflix clears the subtitle', async () => {
    await startPlayback(host);
    host.player.showSubtitle(['x']);
    await tick();
    host.player.clearSubtitle();
    await tick();
    expect(mine(host).textContent).toBe('');
  });

  it('applies translated text color when storage changes', async () => {
    await startPlayback(host);
    host.player.showSubtitle(['x']);
    await tick();
    host.chrome.changePreference('text_color', '#ff0000');
    expect(mine(host).style.color).toBe('rgb(255, 0, 0)');
  });

  it('hides its container and the single-line style when dual subs are switched off', async () => {
    await startPlayback(host);
    host.player.showSubtitle(['x']);
    await tick();
    host.chrome.changePreference('on_off', false);
    expect(mine(host).style.display).toBe('none');
    expect(host.document.getElementById('dsubs-single-line')).toBeNull();
    host.chrome.changePreference('on_off', true);
    expect(mine(host).style.display).toBe('block');
    expect(host.document.getElementById('dsubs-single-line')).not.toBeNull();
  });

  it('keeps exactly one injected style across stacked-mode toggles', async () => {
    await startPlayback(host);
    host.chrome.changePreference('button_up_down_mode', false);
    host.chrome.changePreference('button_up_down_mode', true);
    host.chrome.changePreference('button_up_down_mode', true);
    expect(host.document.querySelectorAll('#dsubs-single-line').length).toBe(1);
    host.chrome.changePreference('button_up_down_mode', false);
    expect(host.document.querySelectorAll('#dsubs-single-line').length).toBe(0);
  });

  it('does not inject anything into the Netflix control bar', async () => {
    await startPlayback(host);
    expect(host.document.querySelector('.button-row').children.length).toBe(3);
  });

  it('keeps mirroring subtitles after a new title remounts the player view', async () => {
    await startPlayback(host);
    host.player.showSubtitle(['first']);
    await tick();
    await startPlayback(host);
    host.player.showSubtitle(['second']);
    await tick();
    expect(host.document.querySelectorAll('.my-timedtext-container').length).toBe(1);
    expect(mine(host).textContent).toBe('second');
    expect(host.window.__errors).toEqual([]);
  });

  it('SM-1: keeps mirroring when autoplay swaps .player-timedtext without remounting the player view', async () => {
    await startPlayback(host);
    host.player.showSubtitle(['episode one']);
    await tick();
    host.player.nextEpisode();
    await tick();
    await tick();
    host.player.showSubtitle(['episode two']);
    await tick();
    expect(host.document.querySelectorAll('.my-timedtext-container').length).toBe(1);
    expect(mine(host).textContent).toBe('episode two');
    expect(host.window.__errors).toEqual([]);
  });

  it('survives a resize while the original subtitle has a flat container (no inner div)', async () => {
    await startPlayback(host);
    const tt = host.document.querySelector('.player-timedtext');
    tt.innerHTML =
      '<div class="player-timedtext-text-container" style="bottom: 10%;"><span style="font-size: 28px;">flat</span></div>';
    await tick();
    host.player.setInset(30);
    await tick();
    expect(host.window.__errors).toEqual([]);
    expect(mine(host).textContent).toBe('flat');
  });

  // Defects found in the 2026-09-15 live smoke test (REFACTORING_PLAN.md §5)
  it.todo('SM-2: places the translated line fully below a two-line original subtitle');
});
