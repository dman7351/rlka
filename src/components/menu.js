// Native event and LINKS buttons share one pointer/keyboard selection.
import { eventFields, getEventValue } from '../config/event.js';

export function createMenu(container, eventInfo, { onEvent, onLinks, onSelect }) {
  const items = eventFields.map(({ key, label }) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.dataset.field = key;
    button.setAttribute('aria-haspopup', 'dialog');
    button.setAttribute('aria-controls', 'event-dialog');
    const value = getEventValue(eventInfo, key);
    button.setAttribute('aria-label', `${label}: ${value}. Open event information`);
    button.className = 'menu-row';
    button.textContent = `${label}: ${value}`;
    button.addEventListener('click', () => {
      select(button);
      onEvent(key, button);
    });
    return button;
  });

  const links = document.createElement('button');
  links.type = 'button';
  links.dataset.field = 'links';
  links.setAttribute('aria-label', 'LINKS: Open artist music links');
  links.setAttribute('aria-haspopup', 'dialog');
  links.setAttribute('aria-controls', 'event-dialog');
  links.className = 'menu-row';
  links.textContent = 'LINKS';
  links.addEventListener('click', () => {
    select(links);
    onLinks(links);
  });
  items.push(links);
  container.replaceChildren(...items);

  let selected = null;
  let hovered = null;

  function select(item) {
    if (item === selected) return;
    selected?.classList.remove('is-selected');
    selected = item;
    selected?.classList.add('is-selected');
    onSelect?.(selected);
  }

  for (const item of items) {
    const point = (event) => {
      if (event.pointerType === 'touch') return;
      hovered = item;
      select(item);
    };
    item.addEventListener('pointerenter', point);
    item.addEventListener('pointermove', point, { passive: true });
    item.addEventListener('pointerdown', () => select(item));
    item.addEventListener('pointerleave', () => {
      if (hovered === item) hovered = null;
      if (selected !== item || item.getAttribute('aria-expanded') === 'true') return;
      select(items.includes(document.activeElement) ? document.activeElement : null);
    });
    item.addEventListener('focus', () => select(item));
  }

  container.addEventListener('focusout', (event) => {
    if (items.includes(event.relatedTarget)) return;
    // Retain the chosen row behind its modal; closing restores native focus.
    if (selected?.getAttribute('aria-expanded') === 'true') return;
    select(hovered);
  });

  container.addEventListener('keydown', (event) => {
    const index = items.indexOf(document.activeElement);
    if (index < 0 || event.altKey || event.ctrlKey || event.metaKey) return;
    let next;
    if (event.key === 'ArrowDown') next = (index + 1) % items.length;
    if (event.key === 'ArrowUp') next = (index - 1 + items.length) % items.length;
    if (event.key === 'Home') next = 0;
    if (event.key === 'End') next = items.length - 1;
    if (next !== undefined) {
      event.preventDefault();
      items[next].focus();
    }
  });
  return items;
}
