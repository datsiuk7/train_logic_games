import { chooseHints } from './hint-data.mjs';

export function setupGameHints(container, level, preview = false) {
  const hints = chooseHints(level);
  const openButton = container.querySelector('#help-open');
  const card = container.querySelector('#help-card');
  const text = container.querySelector('#help-text');
  const counter = container.querySelector('#help-count');
  const nextButton = container.querySelector('#help-next');
  const closeButton = container.querySelector('#help-close');
  const key = `lamplighter-help-seen-${preview ? 'preview-' : ''}${level.id}`;
  let index = 0;
  let focused = null;

  if (!hints.length) {
    openButton.hidden = true;
    return { close() {}, refresh() {} };
  }

  function findTarget(target) {
    if (target.startsWith('command:')) {
      const command = target.slice(8);
      return container.querySelector(`#palette .command-${command}`) || container.querySelector('#palette');
    }
    const selector = { palette: '#palette', program: '#program', run: '#run', scene: '#scene' }[target];
    return selector ? container.querySelector(selector) : null;
  }

  function refresh() {
    focused?.classList.remove('help-focus');
    focused = null;
    if (card.hidden) return;
    focused = findTarget(hints[index].target);
    focused?.classList.add('help-focus');
  }

  function show(step = 0) {
    index = step;
    card.hidden = false;
    text.textContent = hints[index].text;
    counter.textContent = `${index + 1} / ${hints.length}`;
    nextButton.textContent = index === hints.length - 1 ? 'Готово' : 'Далі';
    refresh();
    focused?.scrollIntoView?.({ behavior: 'smooth', block: 'nearest' });
    try { sessionStorage.setItem(key, '1'); } catch {}
  }

  function close() {
    card.hidden = true;
    focused?.classList.remove('help-focus');
    focused = null;
  }

  openButton.onclick = () => show(0);
  nextButton.onclick = () => index + 1 < hints.length ? show(index + 1) : close();
  closeButton.onclick = close;

  let seen = false;
  try { seen = sessionStorage.getItem(key) === '1'; } catch {}
  if (!seen) show();

  return { close, refresh };
}
