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
    // translate is unset until the first subtitle arrives — it's set per-update (browser mode:
    // "yes", local mode: "no"), not once at creation. See the next test for that.
    expect(el.getAttribute('translate')).toBeNull();
  });

  it('gives the mirror a thin black outline for readability over busy backgrounds', async () => {
    await startPlayback(host);
    const el = mine(host);
    expect(el.style.webkitTextStroke).toBe('2px #000000');
  });

  it('marks the mirror translatable once a subtitle appears (browser mode, the default)', async () => {
    await startPlayback(host);
    host.player.showSubtitle(['x']);
    await tick();
    expect(mine(host).getAttribute('translate')).toBe('yes');
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

  // jsdom has no layout, so fake the two rects the placement depends on.
  function fakeRects(host, { original, watchVideo }) {
    const proto = host.window.HTMLElement.prototype;
    const zero = { x: 0, y: 0, top: 0, bottom: 0, left: 0, right: 0, width: 0, height: 0 };
    proto.getBoundingClientRect = function () {
      if (this.matches('.player-timedtext-text-container')) return { ...zero, ...original };
      if (this.matches('.watch-video')) return { ...zero, ...watchVideo };
      return zero;
    };
  }

  it('SM-2: stacked mode hangs the translation from the bottom edge of the original, whatever its height', async () => {
    await startPlayback(host);
    fakeRects(host, {
      original: { top: 400, bottom: 480, height: 80, width: 300, x: 330 },
      watchVideo: { top: 20, bottom: 560, height: 540, width: 960 },
    });
    host.player.showSubtitle(['line one', 'line two']);
    await tick();
    expect(mine(host).style.top).toBe('468px'); // 480 - 20 + 8px gap
    expect(mine(host).style.bottom).toBe('');
  });

  it('side-by-side mode aligns the translation to the bottom edge of the original', async () => {
    host = await loadExtension({ preferences: { button_up_down_mode: false } });
    await startPlayback(host);
    fakeRects(host, {
      original: { top: 440, bottom: 480, height: 40, width: 300, x: 330 },
      watchVideo: { top: 20, bottom: 560, height: 540, width: 960 },
    });
    host.player.showSubtitle(['one line']);
    await tick();
    expect(mine(host).style.bottom).toBe('80px'); // 560 - 480
    expect(mine(host).style.top).toBe('');
  });

  it('ignores caption nodes that are not inside a .watch-video player (browse-page previews)', async () => {
    const preview = host.document.createElement('div');
    preview.innerHTML = '<div class="player-timedtext" style="inset: 0px 0px 0px 0px;"></div>';
    host.document.body.appendChild(preview);
    await tick();
    expect(host.window.__errors).toEqual([]);
    expect(host.document.querySelectorAll('.my-timedtext-container').length).toBe(0);

    await startPlayback(host);
    host.player.showSubtitle(['real player']);
    await tick();
    expect(mine(host).textContent).toBe('real player');
  });

  // A promise the test controls the resolution of — lets us assert the "still waiting" state
  // deterministically, which an auto-resolving mock handler can't (its microtask would already
  // have settled by the time a timer-based `await tick()` fires).
  function deferred() {
    let resolve;
    const promise = new Promise((res) => (resolve = res));
    return { promise, resolve };
  }

  describe('local translation mode', () => {
    it('shows the original immediately, then swaps in the translation once it arrives', async () => {
      host = await loadExtension({ preferences: { translator: 'local' } });
      const d = deferred();
      host.chrome.setSendMessageHandler(() => d.promise);
      await startPlayback(host);

      host.player.showSubtitle(['hello']);
      await tick();
      expect(mine(host).textContent).toBe('hello');
      expect(mine(host).getAttribute('translate')).toBe('no'); // we own translation now, no double-translate

      d.resolve({ ok: true, translations: ['안녕'] });
      await tick();
      expect(mine(host).textContent).toBe('안녕');
      expect(host.window.__errors).toEqual([]);
    });

    it('drops a stale translation response for a subtitle that has already changed', async () => {
      host = await loadExtension({ preferences: { translator: 'local' } });
      const responses = { first: deferred(), second: deferred() };
      host.chrome.setSendMessageHandler((msg) => responses[msg.texts[0]].promise);
      await startPlayback(host);

      host.player.showSubtitle(['first']);
      await tick();
      host.player.showSubtitle(['second']);
      await tick();

      responses.first.resolve({ ok: true, translations: ['FIRST-STALE'] });
      await tick();
      expect(mine(host).textContent).toBe('second'); // stale response ignored, still showing the original

      responses.second.resolve({ ok: true, translations: ['SECOND-OK'] });
      await tick();
      expect(mine(host).textContent).toBe('SECOND-OK');
    });

    it('keeps showing the original text when the translation request fails', async () => {
      host = await loadExtension({ preferences: { translator: 'local' } });
      host.chrome.setSendMessageHandler(async () => ({ ok: false, error: 'server unreachable' }));
      await startPlayback(host);

      host.player.showSubtitle(['hello']);
      await tick();
      await tick();
      expect(mine(host).textContent).toBe('hello');
      expect(host.window.__errors).toEqual([]);
    });

    it('re-translates the current subtitle immediately when switching from browser to local mode', async () => {
      await startPlayback(host);
      host.player.showSubtitle(['hello']);
      await tick();
      expect(mine(host).getAttribute('translate')).toBe('yes'); // default engine is the browser translator

      const d = deferred();
      host.chrome.setSendMessageHandler(() => d.promise);
      host.chrome.changePreference('translator', 'local');
      await tick();
      expect(mine(host).getAttribute('translate')).toBe('no');

      d.resolve({ ok: true, translations: ['번역됨'] });
      await tick();
      expect(mine(host).textContent).toBe('번역됨');
    });
  });

  describe('E2E test bridge (dev builds only)', () => {
    // jsdom's real window.postMessage() doesn't populate event.source/origin the way browsers
    // do, so tests dispatch a MessageEvent directly — this still exercises the same
    // `event.source !== window` guard the production code relies on.
    function postFromPage(host, data) {
      host.window.dispatchEvent(
        new host.window.MessageEvent('message', {
          data,
          origin: host.window.location.origin,
          source: host.window,
        }),
      );
    }

    it('writes a preference via chrome.storage when sent a dsubs-e2e message', async () => {
      postFromPage(host, { source: 'dsubs-e2e', type: 'set-preference', key: 'on_off', value: false });
      await tick();
      expect(host.chrome.writes).toContainEqual({ on_off: false });
    });

    it('ignores messages without the dsubs-e2e marker', async () => {
      postFromPage(host, { type: 'set-preference', key: 'on_off', value: false });
      await tick();
      expect(host.chrome.writes).toEqual([]);
    });

    it('ignores an unknown preference key', async () => {
      postFromPage(host, { source: 'dsubs-e2e', type: 'set-preference', key: 'not_a_real_key', value: 1 });
      await tick();
      expect(host.chrome.writes).toEqual([]);
    });

    it('ignores a message whose source is not this window', async () => {
      const other = {};
      host.window.dispatchEvent(
        new host.window.MessageEvent('message', {
          data: { source: 'dsubs-e2e', type: 'set-preference', key: 'on_off', value: false },
          origin: host.window.location.origin,
          source: other,
        }),
      );
      await tick();
      expect(host.chrome.writes).toEqual([]);
    });
  });

  it('lets the context menu through Netflix’s suppression so the translator can be opened', async () => {
    await startPlayback(host);
    const video = host.document.querySelector('#video-canvas video');
    const event = new host.window.MouseEvent('contextmenu', { bubbles: true, cancelable: true });
    video.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(false);
  });
});
