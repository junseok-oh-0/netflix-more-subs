export function injectStyle(id, css) {
  removeStyle(id);
  const style = document.createElement('style');
  style.id = id;
  style.textContent = css;
  document.head.appendChild(style);
}

export function removeStyle(id) {
  const existing = document.getElementById(id);
  if (existing) existing.remove();
}

// Netflix blocks the context menu, which the user needs to trigger the browser translator.
export function enableRightClick() {
  for (const el of document.getElementsByTagName('*')) {
    el.addEventListener('contextmenu', (e) => e.stopPropagation(), true);
    el.oncontextmenu = null;
  }
}

// Netflix normally renders container > div > span[style], but transitional frames can be flatter.
export function styledTextElements(root) {
  return root ? Array.from(root.querySelectorAll('[style*="font-size"]')) : [];
}

export function readBaseFont(root, fallback) {
  for (const el of styledTextElements(root)) {
    const px = parseFloat(el.style.fontSize);
    if (!Number.isNaN(px)) return px;
  }
  return fallback;
}

export function overflowsParent(el, margin) {
  return el.offsetWidth > el.parentNode.clientWidth - margin;
}
