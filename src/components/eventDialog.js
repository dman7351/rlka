// Populate one event/artist-links dialog and restore its trigger's focus.
import { getDialogContent } from './dialogContent.js';

export function createEventDialog(dialog, eventInfo, { onShown, onClose } = {}) {
  const list = dialog.querySelector('#event-details');
  const close = dialog.querySelector('#close-event');
  const heading = dialog.querySelector('#event-heading');
  let trigger;

  function content(mode) {
    dialog.dataset.content = mode;
    const { heading: title, rows } = getDialogContent(eventInfo, mode);
    heading.textContent = title;
    list.replaceChildren();
    for (const { key, label, value, stacked, href } of rows) {
      const row = document.createElement('div');
      row.dataset.field = key;
      const term = document.createElement('dt');
      const marker = document.createElement('span');
      marker.className = 'field-marker terminal-symbol';
      marker.textContent = '►';
      marker.setAttribute('aria-hidden', 'true');
      term.append(marker, `${label}:`);
      const detail = document.createElement('dd');
      if (href) {
        const link = document.createElement('a');
        link.href = href;
        link.target = '_blank';
        link.rel = 'noopener noreferrer';
        link.className = 'artist-link';
        link.textContent = value;
        link.setAttribute('aria-label', `${label}: ${value} (opens in a new tab)`);
        detail.append(link);
      } else if (stacked) {
        const acts = document.createElement('ul');
        for (const name of value.split('\n')) {
          const act = document.createElement('li');
          act.textContent = name;
          acts.append(act);
        }
        detail.append(acts);
      } else {
        detail.textContent = value;
      }
      row.append(term, detail);
      list.append(row);
    }
  }
  content('event');

  close.addEventListener('click', () => dialog.close());
  dialog.addEventListener('keydown', (event) => {
    if (event.altKey || event.ctrlKey || event.metaKey) return;
    if (dialog.dataset.content === 'links') {
      const items = [...list.querySelectorAll('a[href]'), close];
      const index = items.indexOf(document.activeElement);
      if (event.key === ' ' && document.activeElement.matches('a[href]')) {
        event.preventDefault();
        document.activeElement.click();
        return;
      }
      let next;
      if (index >= 0 && event.key === 'ArrowDown') next = (index + 1) % items.length;
      if (index >= 0 && event.key === 'ArrowUp') next = (index - 1 + items.length) % items.length;
      if (event.key === 'Home') next = 0;
      if (event.key === 'End') next = items.length - 1;
      if (next !== undefined) {
        event.preventDefault();
        items[next].focus();
        return;
      }
    }
    if (event.key !== 'Tab') return;
    const controls = [...dialog.querySelectorAll('button, a[href], select, input, [tabindex="0"]')];
    const first = controls[0];
    const last = controls.at(-1);
    if ((!event.shiftKey && document.activeElement === last) ||
        (event.shiftKey && document.activeElement === first)) {
      event.preventDefault();
      (event.shiftKey ? last : first).focus();
    }
  });
  // showModal supplies native focus containment, inert background, and Escape.
  dialog.addEventListener('close', () => {
    onClose?.();
    trigger?.setAttribute('aria-expanded', 'false');
    trigger?.focus({ preventScroll: true });
  });

  function open(mode, field, source) {
    if (dialog.open) return;
    trigger = source;
    content(mode);
    for (const row of list.children) {
      row.classList.toggle('selected-field', row.dataset.field === field);
    }
    source.setAttribute('aria-expanded', 'true');
    dialog.showModal();
    onShown?.(field, source);
    (mode === 'links' ? list.querySelector('a[href]') ?? close : close).focus({ preventScroll: true });
  }

  return {
    open(field, source) { open('event', field, source); },
    openLinks(source) { open('links', null, source); },
  };
}
