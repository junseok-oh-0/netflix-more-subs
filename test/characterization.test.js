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

  it('requests preferences from the background on load', () => {
    expect(host.chrome.sent[0]).toEqual({ message: 'request_preferences', value: 'please' });
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

  it('applies translated text color from an update message', async () => {
    await startPlayback(host);
    host.player.showSubtitle(['x']);
    await tick();
    host.chrome.dispatch({ message: 'update_text_color', value: '#ff0000' });
    const mine = host.document.querySelector('.my-timedtext-container');
    expect(mine.style.color).toBe('rgb(255, 0, 0)');
  });

  it('hides its container when dual subs are switched off', async () => {
    await startPlayback(host);
    host.player.showSubtitle(['x']);
    await tick();
    host.chrome.dispatch({ message: 'update_on_off', value: false });
    expect(host.document.querySelector('.my-timedtext-container').style.display).toBe('none');
    host.chrome.dispatch({ message: 'update_on_off', value: true });
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

  it('detects the "Css" classname mode from the video canvas', async () => {
    host.player.setClassnameMode('css');
    await startPlayback(host);
    expect(host.window.weird_classname_mode).toBe(1);
    expect(host.document.getElementById('myTutorialButton')).not.toBeNull();
  });
});
