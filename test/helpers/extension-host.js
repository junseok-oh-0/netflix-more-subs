import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { JSDOM } from 'jsdom';

const root = resolve(import.meta.dirname, '../..');
const fixtureHtml = readFileSync(resolve(root, 'test/fixtures/fake-player.html'), 'utf8');
const jquerySrc = readFileSync(resolve(root, 'jquery-3.5.1.min.js'), 'utf8');
const contentSrc = readFileSync(resolve(root, 'content.js'), 'utf8');

export const tick = (ms = 0) => new Promise((r) => setTimeout(r, ms));

export function installChromeStub(window, { preferences = null } = {}) {
  const listeners = [];
  const sent = [];
  window.chrome = {
    runtime: {
      sendMessage(msg) {
        sent.push(msg);
        if (msg.message === 'request_preferences') {
          setTimeout(() => dispatch({ message: 'user_preferences', value: preferences }), 0);
        }
      },
      onMessage: { addListener: (fn) => listeners.push(fn) },
      getURL: (p) => 'chrome-extension://test' + p,
    },
    storage: { sync: { get: (_k, cb) => cb({}), set() {} } },
  };
  function dispatch(msg) {
    listeners.forEach((fn) => fn(msg, {}, () => {}));
  }
  return { sent, dispatch };
}

function polyfillInnerText(window) {
  if ('innerText' in window.HTMLElement.prototype) return;
  Object.defineProperty(window.HTMLElement.prototype, 'innerText', {
    configurable: true,
    get() {
      return this.textContent;
    },
    set(v) {
      this.textContent = v;
    },
  });
}

export function createFixtureDom() {
  return new JSDOM(fixtureHtml, {
    runScripts: 'dangerously',
    pretendToBeVisual: true,
    url: 'https://www.netflix.com/browse',
  });
}

export async function loadExtension({ preferences = null } = {}) {
  const dom = createFixtureDom();
  const { window } = dom;
  polyfillInnerText(window);
  const chrome = installChromeStub(window, { preferences });
  window.__errors = [];
  window.addEventListener('error', (e) => window.__errors.push(e.error ?? e.message));
  window.eval(jquerySrc);
  window.eval(contentSrc);
  await tick();
  return { dom, window, document: window.document, chrome, player: window.fakePlayer };
}
