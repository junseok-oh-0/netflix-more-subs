// Guards the DOM contract between the fixture page and the selectors the extension relies on.
import { describe, expect, it } from 'vitest';
import { createFixtureDom } from './helpers/extension-host.js';

describe('fake-player fixture', () => {
  const { window } = createFixtureDom();
  const { document } = window;

  it('has the containers the extension queries by class', () => {
    for (const cls of ['watch-video', 'watch-video--player-view', 'player-timedtext']) {
      expect(document.getElementsByClassName(cls).length, cls).toBe(1);
    }
  });

  it('remounts .watch-video--player-view directly under .watch-video on video load', () => {
    const watch = document.querySelector('.watch-video');
    const before = watch.querySelector('.watch-video--player-view');
    window.fakePlayer.loadVideo();
    const after = watch.querySelector('.watch-video--player-view');
    expect(after).not.toBe(before);
    expect(after.parentElement).toBe(watch);
    expect(watch.querySelectorAll('.watch-video--player-view').length).toBe(1);
  });

  it('swaps only .player-timedtext on autoplay, keeping the player view', () => {
    const view = document.querySelector('.watch-video--player-view');
    const before = view.querySelector('.player-timedtext');
    window.fakePlayer.nextEpisode();
    expect(document.querySelector('.watch-video--player-view')).toBe(view);
    expect(view.querySelector('.player-timedtext')).not.toBe(before);
    expect(document.querySelectorAll('.player-timedtext').length).toBe(1);
  });

  it('builds subtitle containers in the shape the extension walks', () => {
    window.fakePlayer.showSubtitle(['a', 'b']);
    const row = document.querySelector('.player-timedtext');
    expect(row.childElementCount).toBe(1);
    const span = row.firstChild.firstChild.firstChild;
    expect(span.tagName).toBe('SPAN');
    expect(span.style.fontSize).toBe('32px');
    expect(row.firstChild.style.bottom).toBe('10%');
    expect(row.style.inset).toBeTruthy();

    window.fakePlayer.showSubtitle(['a', 'b'], { containers: 2 });
    expect(row.childElementCount).toBe(2);
  });
});
