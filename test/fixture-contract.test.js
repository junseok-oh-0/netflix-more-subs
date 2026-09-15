// Guards the DOM contract between the fixture page and the selectors content.js relies on.
import { describe, expect, it } from 'vitest';
import { createFixtureDom } from './helpers/extension-host.js';

const PLAYER_ROOT_SELECTOR =
  '#appMountPoint > div > div >div > div > div > div:nth-child(1) > div > div > div > div';

describe('fake-player fixture', () => {
  const { window } = createFixtureDom();
  const { document } = window;

  it('exposes the player root at the depth content.js waits for', () => {
    expect(document.querySelector(PLAYER_ROOT_SELECTOR)).not.toBeNull();
  });

  it('has the containers content.js queries by class', () => {
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

  it('builds subtitle containers in the shape content.js walks', () => {
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
