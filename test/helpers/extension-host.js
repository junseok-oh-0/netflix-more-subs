import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { buildSync } from 'esbuild';
import { JSDOM } from 'jsdom';

const root = resolve(import.meta.dirname, '../..');
const fixtureHtml = readFileSync(resolve(root, 'test/fixtures/fake-player.html'), 'utf8');

const bundleCache = new Map();
export function bundleEntry(name) {
  if (!bundleCache.has(name)) {
    const result = buildSync({
      entryPoints: [resolve(root, 'src', name)],
      bundle: true,
      write: false,
      format: 'iife',
      target: 'chrome110',
    });
    bundleCache.set(name, result.outputFiles[0].text);
  }
  return bundleCache.get(name);
}

export const tick = (ms = 0) => new Promise((r) => setTimeout(r, ms));

// In-memory chrome.storage.sync; changePreference() behaves like another context writing to it.
export function installChromeStub(window, { preferences = {} } = {}) {
  const store = { ...preferences };
  const changeListeners = [];
  const writes = [];
  window.chrome = {
    runtime: { getURL: (p) => 'chrome-extension://test' + p },
    storage: {
      sync: {
        get: async () => ({ ...store }),
        set: async (values) => {
          writes.push(values);
          changePreference(values);
        },
      },
      onChanged: { addListener: (fn) => changeListeners.push(fn) },
    },
  };
  function changePreference(keyOrValues, value) {
    const values = typeof keyOrValues === 'string' ? { [keyOrValues]: value } : keyOrValues;
    const changes = {};
    for (const [k, v] of Object.entries(values)) {
      changes[k] = { oldValue: store[k], newValue: v };
      store[k] = v;
    }
    changeListeners.forEach((fn) => fn(changes, 'sync'));
  }
  return { store, writes, changePreference };
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

export async function loadExtension({ preferences = {} } = {}) {
  const dom = createFixtureDom();
  const { window } = dom;
  polyfillInnerText(window);
  const chrome = installChromeStub(window, { preferences });
  window.__errors = [];
  window.addEventListener('error', (e) => window.__errors.push(e.error ?? e.message));
  window.eval(bundleEntry('content.ts'));
  await tick();
  return { dom, window, document: window.document, chrome, player: window.fakePlayer };
}
