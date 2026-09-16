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
// Stopping the event at the top of the capture phase keeps it from ever reaching Netflix's handlers.
export function enableRightClick() {
  window.addEventListener('contextmenu', (e) => e.stopPropagation(), true);
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
