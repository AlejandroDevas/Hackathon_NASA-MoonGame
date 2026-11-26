import { t } from '../i18n.js';

/**
 * Every step of the tutorial, in order. `target` is a CSS selector of the control the step explains; a step
 * without one (the welcome and the last, about the 3D scene) is shown in the middle of the screen.
 * `essential` marks the short tour a first-time visitor gets; the last step of that tour offers the rest.
 */
export const TUTORIAL_STEPS = [
  { id: 'welcome', target: null, essential: true },
  { id: 'locale', target: '[data-testid="locale"]' },
  { id: 'site', target: '[data-testid="site-top"]', essential: true },
  { id: 'view', target: '[data-testid="view-toggle"]' },
  { id: 'lroc', target: '[data-testid="lroc-toggle"]' },
  { id: 'shadows', target: '[data-testid="shadow-lift-toggle"]' },
  { id: 'volume', target: '[data-testid="volume"]' },
  { id: 'sound', target: '[data-testid="sound-toggle"]' },
  { id: 'game', target: '[data-testid="game-link"]' },
  { id: 'menu', target: '[data-testid="menu-toggle"]' },
  { id: 'play', target: '[data-testid="play-toggle"]', essential: true },
  { id: 'skips', target: '.pb-transport' },
  { id: 'timeline', target: '.pb-seek', essential: true },
  { id: 'speed', target: '[data-testid="speed"]' },
  { id: 'scene', target: null, essential: true },
];

/** The short tour: welcome, choosing a site, playing time, the timeline and driving the rover. */
export const ESSENTIAL_STEPS = TUTORIAL_STEPS.filter((step) => step.essential);

const STORAGE_KEY = 'inside-moon-153.tutorial-seen';
const GAP = 14;
const MARGIN = 12;

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

/** The browser may refuse storage (private window, blocked data): then the tutorial simply shows every time. */
function readSeen() {
  try {
    return window.localStorage.getItem(STORAGE_KEY) === '1';
  } catch {
    return false;
  }
}

function writeSeen() {
  try {
    window.localStorage.setItem(STORAGE_KEY, '1');
  } catch {
    /* nothing to do: it will show again next time */
  }
}

/**
 * The interactive tutorial: a small window that walks through the controls one by one, dimming the page and
 * highlighting the control it explains. Previous and Next sit at the bottom left, Skip at the bottom right.
 * It opens by itself on the first visit (`openIfFirstVisit`) and from the menu afterwards (`open`).
 * @returns {{open(): void, openIfFirstVisit(): boolean, close(): void, isOpen(): boolean, seen(): boolean, dispose(): void}}
 */
export function createTutorial() {
  let root = null;
  let ring = null;
  let card = null;
  let parts = null;
  let index = 0;
  let steps = ESSENTIAL_STEPS;
  let returnFocus = null;

  const isOpen = () => root !== null;

  function place() {
    if (!root) return;
    const step = steps[index];
    const node = step.target ? document.querySelector(step.target) : null;
    const rect = node?.getBoundingClientRect();
    const visible = rect && rect.width > 0 && rect.height > 0;
    root.classList.toggle('tut-centered', !visible);
    const width = card.offsetWidth;
    const height = card.offsetHeight;
    if (!visible) {
      ring.style.display = 'none';
      card.style.left = `${Math.max(MARGIN, (window.innerWidth - width) / 2)}px`;
      card.style.top = `${Math.max(MARGIN, (window.innerHeight - height) / 2)}px`;
      return;
    }
    const pad = 5;
    ring.style.display = '';
    ring.style.left = `${rect.left - pad}px`;
    ring.style.top = `${rect.top - pad}px`;
    ring.style.width = `${rect.width + 2 * pad}px`;
    ring.style.height = `${rect.height + 2 * pad}px`;
    // under the target when it is in the upper half of the screen, over it otherwise
    const below = rect.top + rect.height / 2 < window.innerHeight / 2;
    const top = below ? rect.bottom + pad + GAP : rect.top - pad - GAP - height;
    const left = Math.min(Math.max(MARGIN, rect.left + rect.width / 2 - width / 2), window.innerWidth - width - MARGIN);
    card.style.left = `${Math.max(MARGIN, left)}px`;
    card.style.top = `${Math.min(Math.max(MARGIN, top), window.innerHeight - height - MARGIN)}px`;
  }

  function render() {
    const step = steps[index];
    const last = index === steps.length - 1;
    parts.count.textContent = t('tutorial.step', { n: index + 1, total: steps.length });
    parts.more.hidden = !(last && steps !== TUTORIAL_STEPS); // the short tour ends by offering the rest
    parts.more.textContent = t('tutorial.more');
    parts.title.textContent = t(`tutorial.${step.id}.title`);
    parts.text.textContent = t(`tutorial.${step.id}.text`);
    parts.prev.textContent = `‹ ${t('tutorial.prev')}`;
    parts.prev.disabled = index === 0;
    parts.next.textContent = last ? t('tutorial.finish') : `${t('tutorial.next')} ›`;
    parts.skip.textContent = t('tutorial.skip');
    place();
    parts.next.focus({ preventScroll: true });
  }

  function go(delta) {
    const next = index + delta;
    if (next < 0) return;
    if (next >= steps.length) {
      close();
      return;
    }
    index = next;
    render();
  }

  // The tutorial owns the keyboard while it is open, so the arrows or W/A/S/D do not drive the rover under it.
  function onKey(event) {
    if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      close();
    } else if (event.key === 'ArrowRight') {
      event.preventDefault();
      event.stopPropagation();
      go(1);
    } else if (event.key === 'ArrowLeft') {
      event.preventDefault();
      event.stopPropagation();
      go(-1);
    } else if (event.key === 'Tab') {
      const buttons = [parts.prev, parts.next, parts.more, parts.skip].filter((b) => !b.disabled && !b.hidden);
      const at = buttons.indexOf(document.activeElement);
      const to = (at + (event.shiftKey ? -1 : 1) + buttons.length) % buttons.length;
      event.preventDefault();
      buttons[to].focus();
    } else if (event.key !== 'Enter' && event.key !== ' ') {
      event.stopPropagation();
    }
  }

  /** @param {{full?: boolean}} [options] `full` walks through every control; otherwise the short tour */
  function open({ full = false } = {}) {
    if (isOpen()) return;
    steps = full ? TUTORIAL_STEPS : ESSENTIAL_STEPS;
    returnFocus = document.activeElement;
    root = el('div', 'tut-root');
    ring = el('div', 'tut-ring');
    card = el('div', 'tut-card');
    card.setAttribute('role', 'dialog');
    card.setAttribute('aria-modal', 'true');
    card.setAttribute('aria-labelledby', 'tut-title');
    card.dataset.testid = 'tutorial';

    parts = {
      count: el('p', 'tut-count'),
      title: el('h2', 'tut-title'),
      text: el('p', 'tut-text'),
      prev: el('button', 'tut-button'),
      next: el('button', 'tut-button tut-primary'),
      skip: el('button', 'tut-button tut-skip'),
      more: el('button', 'tut-button tut-more'),
    };
    parts.more.hidden = true;
    parts.more.dataset.testid = 'tutorial-more';
    parts.more.type = 'button';
    parts.more.addEventListener('click', () => {
      steps = TUTORIAL_STEPS; // every control, from the one after the welcome
      index = 1;
      render();
    });
    parts.title.id = 'tut-title';
    parts.prev.dataset.testid = 'tutorial-prev';
    parts.next.dataset.testid = 'tutorial-next';
    parts.skip.dataset.testid = 'tutorial-skip';
    for (const button of [parts.prev, parts.next, parts.skip]) button.type = 'button';
    parts.prev.addEventListener('click', () => go(-1));
    parts.next.addEventListener('click', () => go(1));
    parts.skip.addEventListener('click', close);

    const left = el('div', 'tut-nav');
    left.append(parts.prev, parts.next);
    const footer = el('div', 'tut-footer');
    footer.append(left, parts.skip);
    card.append(parts.count, parts.title, parts.text, parts.more, footer);
    root.append(ring, card);
    document.body.append(root);

    index = 0;
    document.addEventListener('keydown', onKey, true);
    window.addEventListener('resize', place);
    render();
  }

  function close() {
    if (!isOpen()) return;
    writeSeen();
    document.removeEventListener('keydown', onKey, true);
    window.removeEventListener('resize', place);
    root.remove();
    root = ring = card = parts = null;
    if (returnFocus?.isConnected) returnFocus.focus({ preventScroll: true });
    returnFocus = null;
  }

  return {
    open,
    close,
    isOpen,
    seen: readSeen,
    /** Opens the tutorial unless this browser has already seen or skipped it. */
    openIfFirstVisit() {
      if (readSeen()) return false;
      open();
      return true;
    },
    dispose: close,
  };
}
