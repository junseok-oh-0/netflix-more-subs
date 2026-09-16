export function injectStyle(id: string, css: string): void {
  removeStyle(id);
  const style = document.createElement('style');
  style.id = id;
  style.textContent = css;
  document.head.appendChild(style);
}

export function removeStyle(id: string): void {
  document.getElementById(id)?.remove();
}

// Netflix blocks the context menu, which the user needs to trigger the browser translator.
// Stopping the event at the top of the capture phase keeps it from ever reaching Netflix's handlers.
export function enableRightClick(): void {
  window.addEventListener('contextmenu', (e) => e.stopPropagation(), true);
}

// Netflix normally renders container > div > span[style], but transitional frames can be flatter.
export function styledTextElements(root: Element | null): HTMLElement[] {
  return root ? Array.from(root.querySelectorAll<HTMLElement>('[style*="font-size"]')) : [];
}

export function readBaseFont(root: Element | null, fallback: number): number {
  for (const el of styledTextElements(root)) {
    const px = parseFloat(el.style.fontSize);
    if (!Number.isNaN(px)) return px;
  }
  return fallback;
}

export function overflowsParent(el: HTMLElement, margin: number): boolean {
  const parent = el.parentElement;
  return parent != null && el.offsetWidth > parent.clientWidth - margin;
}
