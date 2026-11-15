const ITEM = '[role^="menuitem"]';

/**
 * Wires a button to a popup menu, the keyboard way: the button opens and closes it, Escape closes it
 * and returns the focus to the button, the arrow keys, Home and End move between the items, Tab or a
 * click outside closes it, and choosing an item closes it. The menu stays in the page (only `hidden`
 * changes), so its items can be found and tested while it is closed.
 * @param {{trigger: HTMLElement, menu: HTMLElement, onOpenChange?: (open: boolean) => void}} options
 */
export function attachMenu({ trigger, menu, onOpenChange }) {
  let open = false;
  menu.hidden = true;
  trigger.setAttribute('aria-haspopup', 'menu');
  trigger.setAttribute('aria-expanded', 'false');

  const items = () => [...menu.querySelectorAll(ITEM)].filter((node) => !node.disabled);

  function setOpen(next, { focus = null } = {}) {
    if (next === open) return;
    open = next;
    menu.hidden = !open;
    trigger.setAttribute('aria-expanded', String(open));
    if (open) {
      document.addEventListener('pointerdown', onOutside, true);
      document.addEventListener('keydown', onKey, true);
      const list = items();
      const target = focus === 'last' ? list.at(-1) : list.find((node) => node.getAttribute('aria-checked') === 'true') ?? list[0];
      if (focus !== null || document.activeElement === trigger) target?.focus();
    } else {
      document.removeEventListener('pointerdown', onOutside, true);
      document.removeEventListener('keydown', onKey, true);
    }
    onOpenChange?.(open);
  }

  function onOutside(event) {
    if (!menu.contains(event.target) && !trigger.contains(event.target)) setOpen(false);
  }

  function onKey(event) {
    if (!menu.contains(document.activeElement) && document.activeElement !== trigger) return;
    const list = items();
    const index = list.indexOf(document.activeElement);
    if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      setOpen(false);
      trigger.focus();
    } else if (event.key === 'Tab') {
      setOpen(false);
    } else if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      const step = event.key === 'ArrowDown' ? 1 : -1;
      list[(index + step + list.length) % list.length]?.focus();
    } else if (event.key === 'Home' || event.key === 'End') {
      event.preventDefault();
      (event.key === 'Home' ? list[0] : list.at(-1))?.focus();
    }
  }

  trigger.addEventListener('click', () => setOpen(!open));
  trigger.addEventListener('keydown', (event) => {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      setOpen(true, { focus: event.key === 'ArrowUp' ? 'last' : 'first' });
    }
  });
  menu.addEventListener('click', (event) => {
    if (event.target.closest(ITEM)) {
      setOpen(false);
      trigger.focus();
    }
  });

  return {
    isOpen: () => open,
    open: () => setOpen(true),
    close: () => setOpen(false),
    dispose() {
      document.removeEventListener('pointerdown', onOutside, true);
      document.removeEventListener('keydown', onKey, true);
    },
  };
}
