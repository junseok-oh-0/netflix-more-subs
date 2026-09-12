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

  it('uses the exact video-canvas className content.js compares against', () => {
    expect(document.getElementById('video-canvas').className).toBe(' ltr-18tyyic');
    window.fakePlayer.setClassnameMode('css');
    expect(document.getElementById('video-canvas').className).toBe(' ltr-1b8gkd7-videoCanvasCss');
    window.fakePlayer.setClassnameMode('normal');
  });

  it('renders a Seek Back button two levels below the button row', () => {
    const seek = document.querySelector('button[aria-label="Seek Back"]');
    expect(seek).not.toBeNull();
    expect(seek.parentElement.parentElement.className).toBe('button-row');
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
