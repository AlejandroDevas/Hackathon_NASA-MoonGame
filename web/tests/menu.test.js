import { afterEach, describe, expect, test, vi } from 'vitest';
import { attachMenu } from '../src/ui/menu.js';

function build(count = 3, { disabledAt = -1 } = {}) {
  document.body.replaceChildren();
  const trigger = document.createElement('button');
  trigger.textContent = 'open';
  const menu = document.createElement('div');
  menu.setAttribute('role', 'menu');
  const items = [];
  for (let i = 0; i < count; i++) {
    const item = document.createElement('button');
    item.setAttribute('role', 'menuitem');
    item.textContent = `item ${i}`;
    if (i === disabledAt) item.disabled = true;
    menu.append(item);
    items.push(item);
  }
  const outside = document.createElement('button');
  document.body.append(trigger, menu, outside);
  const onOpenChange = vi.fn();
  const handle = attachMenu({ trigger, menu, onOpenChange });
  return { trigger, menu, items, outside, handle, onOpenChange };
}
const press = (target, key) => target.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }));

afterEach(() => document.body.replaceChildren());

describe('attachMenu', () => {
  test('starts closed and described for assistive technology', () => {
    const { trigger, menu } = build();
    expect(menu.hidden).toBe(true);
    expect(trigger.getAttribute('aria-haspopup')).toBe('menu');
    expect(trigger.getAttribute('aria-expanded')).toBe('false');
  });

  test('the button opens and closes the menu and reports it', () => {
    const { trigger, menu, onOpenChange, handle } = build();
    trigger.click();
    expect(menu.hidden).toBe(false);
    expect(trigger.getAttribute('aria-expanded')).toBe('true');
    expect(handle.isOpen()).toBe(true);
    trigger.click();
    expect(menu.hidden).toBe(true);
    expect(onOpenChange.mock.calls.map((c) => c[0])).toEqual([true, false]);
  });

  test('Escape closes it and gives the focus back to the button', () => {
    const { trigger, menu, items } = build();
    trigger.click();
    items[1].focus();
    press(items[1], 'Escape');
    expect(menu.hidden).toBe(true);
    expect(document.activeElement).toBe(trigger);
  });

  test('the arrow keys move between the items, wrapping around, and Home and End jump', () => {
    const { trigger, items } = build();
    trigger.focus();
    press(trigger, 'ArrowDown'); // opens at the first item
    expect(document.activeElement).toBe(items[0]);
    press(items[0], 'ArrowDown');
    expect(document.activeElement).toBe(items[1]);
    press(items[1], 'ArrowUp');
    press(items[0], 'ArrowUp'); // wraps to the last
    expect(document.activeElement).toBe(items[2]);
    press(items[2], 'Home');
    expect(document.activeElement).toBe(items[0]);
    press(items[0], 'End');
    expect(document.activeElement).toBe(items[2]);
  });

  test('ArrowUp on the button opens the menu at the last item', () => {
    const { trigger, items } = build();
    trigger.focus();
    press(trigger, 'ArrowUp');
    expect(document.activeElement).toBe(items[2]);
  });

  test('opening with the keyboard focuses the checked item, if there is one', () => {
    const { trigger, items } = build();
    items[1].setAttribute('aria-checked', 'true');
    trigger.focus();
    press(trigger, 'ArrowDown');
    expect(document.activeElement).toBe(items[1]);
  });

  test('disabled items are skipped', () => {
    const { trigger, items } = build(3, { disabledAt: 1 });
    trigger.focus();
    press(trigger, 'ArrowDown');
    press(items[0], 'ArrowDown');
    expect(document.activeElement).toBe(items[2]);
  });

  test('a click outside closes it', () => {
    const { trigger, menu, outside } = build();
    trigger.click();
    outside.dispatchEvent(new Event('pointerdown', { bubbles: true }));
    expect(menu.hidden).toBe(true);
  });

  test('a click inside the menu (on the menu itself) does not close it', () => {
    const { trigger, menu } = build();
    trigger.click();
    menu.dispatchEvent(new Event('pointerdown', { bubbles: true }));
    expect(menu.hidden).toBe(false);
  });

  test('choosing an item closes the menu', () => {
    const { trigger, menu, items } = build();
    trigger.click();
    items[0].click();
    expect(menu.hidden).toBe(true);
    expect(document.activeElement).toBe(trigger);
  });

  test('Tab closes it', () => {
    const { trigger, menu, items } = build();
    trigger.click();
    items[0].focus();
    press(items[0], 'Tab');
    expect(menu.hidden).toBe(true);
  });

  test('keys pressed elsewhere on the page do not affect an open menu', () => {
    const { trigger, menu, outside } = build();
    trigger.click();
    outside.focus();
    press(outside, 'Escape');
    expect(menu.hidden).toBe(false);
  });

  test('dispose removes the document listeners', () => {
    const { trigger, menu, handle, outside } = build();
    trigger.click();
    handle.dispose();
    outside.dispatchEvent(new Event('pointerdown', { bubbles: true }));
    expect(menu.hidden).toBe(false);
  });
});
