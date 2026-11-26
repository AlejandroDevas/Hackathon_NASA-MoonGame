import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { setLocale } from '../src/i18n.js';
import { DEFAULT_THRESHOLDS } from '../src/metrics/scenario.js';
import { createStore } from '../src/state.js';
import en from '../src/strings/en.json';
import es from '../src/strings/es.json';
import { mountInterface } from '../src/ui/interface.js';
import { ESSENTIAL_STEPS, TUTORIAL_STEPS, createTutorial } from '../src/ui/tutorial.js';
import { HOUR, T0, loadTinySite } from './helpers.js';

const site = loadTinySite();
const sites = new Map([['tiny-site', site]]);
const siteList = [{ id: 'tiny-site', name: 'Tiny' }];

const q = (id) => document.querySelector(`[data-testid="${id}"]`);
const title = () => document.querySelector('.tut-title').textContent;

function mount() {
  const store = createStore({
    scenarios: { A: { siteId: 'tiny-site', timeMs: T0 + 5 * HOUR }, B: null },
    windowMs: 24 * HOUR,
    thresholds: { ...DEFAULT_THRESHOLDS },
    playing: false,
    soundEnabled: false,
    shadowLift: false,
    viewMode: 'follow',
    panelOpen: false,
    locale: 'es',
  });
  const drawer = document.createElement('div');
  document.body.append(drawer);
  return mountInterface(drawer, store, siteList, sites, {
    renderTimeline: () => ({ destroy() {}, setCursor() {} }),
    audioCue: { setEnabled: (next) => next, play() {} },
  });
}

beforeEach(() => {
  window.localStorage.clear();
  vi.stubGlobal('requestAnimationFrame', () => 1);
  vi.stubGlobal('cancelAnimationFrame', () => {});
});
afterEach(() => {
  vi.unstubAllGlobals();
  setLocale('es');
  document.body.replaceChildren();
});

describe('tutorial', () => {
  test('the steps start with a welcome, end with driving the rover, and every step has its texts in both languages', () => {
    expect(TUTORIAL_STEPS[0].id).toBe('welcome');
    expect(TUTORIAL_STEPS.at(-1).id).toBe('scene');
    for (const { id } of TUTORIAL_STEPS) {
      for (const table of [es, en]) {
        expect(table[`tutorial.${id}.title`], id).toBeTruthy();
        expect(table[`tutorial.${id}.text`], id).toBeTruthy();
      }
    }
  });

  test('every step that points at a control finds it in the interface', () => {
    mount();
    for (const { id, target } of TUTORIAL_STEPS) {
      if (target) expect(document.querySelector(target), id).not.toBeNull();
    }
  });

  test('opens on the first visit with the welcome, and not again once it was seen', () => {
    const tutorial = createTutorial();
    expect(tutorial.openIfFirstVisit()).toBe(true);
    expect(tutorial.isOpen()).toBe(true);
    expect(title()).toBe(es['tutorial.welcome.title']);
    tutorial.close();
    expect(tutorial.seen()).toBe(true);
    expect(createTutorial().openIfFirstVisit()).toBe(false);
    expect(document.querySelector('.tut-card')).toBeNull();
  });

  test('Previous and Next sit at the bottom left, Skip at the bottom right, and Previous is off on the first step', () => {
    createTutorial().open();
    const footer = document.querySelector('.tut-footer');
    expect([...footer.children].map((c) => c.className.split(' ')[0])).toEqual(['tut-nav', 'tut-button']);
    expect([...footer.firstElementChild.children].map((b) => b.dataset.testid)).toEqual(['tutorial-prev', 'tutorial-next']);
    expect(footer.lastElementChild.dataset.testid).toBe('tutorial-skip');
    expect(q('tutorial-prev').disabled).toBe(true);
  });

  test('the short tour is the essentials: welcome, a site, playing time, the timeline and driving the rover', () => {
    expect(ESSENTIAL_STEPS.map((step) => step.id)).toEqual(['welcome', 'site', 'play', 'timeline', 'scene']);
    for (const step of ESSENTIAL_STEPS) expect(TUTORIAL_STEPS).toContain(step);
  });

  test('the first visit gets the short tour, whose last step offers every control from the one after the welcome', () => {
    const tutorial = createTutorial();
    tutorial.openIfFirstVisit();
    expect(document.querySelector('.tut-count').textContent).toBe('Paso 1 de 5');
    expect(q('tutorial-more').hidden).toBe(true);
    for (let i = 1; i < ESSENTIAL_STEPS.length; i += 1) q('tutorial-next').click();
    expect(title()).toBe(es['tutorial.scene.title']);
    expect(q('tutorial-more').hidden).toBe(false);
    q('tutorial-more').click();
    expect(tutorial.isOpen()).toBe(true);
    expect(document.querySelector('.tut-count').textContent).toBe(`Paso 2 de ${TUTORIAL_STEPS.length}`);
    expect(title()).toBe(es['tutorial.locale.title']);
    expect(q('tutorial-more').hidden).toBe(true);
  });

  test('Next and Previous walk through the steps, and the last step offers Finish', () => {
    const tutorial = createTutorial();
    tutorial.open({ full: true });
    expect(document.querySelector('.tut-count').textContent).toBe(`Paso 1 de ${TUTORIAL_STEPS.length}`);
    q('tutorial-next').click();
    expect(title()).toBe(es['tutorial.locale.title']);
    expect(q('tutorial-prev').disabled).toBe(false);
    q('tutorial-prev').click();
    expect(title()).toBe(es['tutorial.welcome.title']);
    for (let i = 1; i < TUTORIAL_STEPS.length; i += 1) q('tutorial-next').click();
    expect(title()).toBe(es['tutorial.scene.title']);
    expect(q('tutorial-next').textContent).toBe(es['tutorial.finish']);
    q('tutorial-next').click();
    expect(tutorial.isOpen()).toBe(false);
    expect(tutorial.seen()).toBe(true);
  });

  test('Skip closes it and remembers it, so it does not open by itself again', () => {
    const tutorial = createTutorial();
    tutorial.openIfFirstVisit();
    q('tutorial-skip').click();
    expect(tutorial.isOpen()).toBe(false);
    expect(window.localStorage.getItem('inside-moon-153.tutorial-seen')).toBe('1');
    expect(tutorial.openIfFirstVisit()).toBe(false);
    tutorial.open(); // but it can be opened by hand
    expect(tutorial.isOpen()).toBe(true);
  });

  test('the keyboard: right and left arrows move, Escape skips, and the keys do not reach the scene', () => {
    const tutorial = createTutorial();
    tutorial.open({ full: true });
    const reachedScene = vi.fn();
    window.addEventListener('keydown', reachedScene);
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
    expect(title()).toBe(es['tutorial.locale.title']);
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true }));
    expect(title()).toBe(es['tutorial.welcome.title']);
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'w', bubbles: true }));
    expect(reachedScene).not.toHaveBeenCalled();
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    expect(tutorial.isOpen()).toBe(false);
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'w', bubbles: true }));
    expect(reachedScene).toHaveBeenCalledTimes(1); // closed: the keys reach the scene again
    window.removeEventListener('keydown', reachedScene);
  });

  test('it is a dialog, and it is written in English when the language is English', () => {
    setLocale('en');
    createTutorial().open();
    const card = document.querySelector('.tut-card');
    expect(card.getAttribute('role')).toBe('dialog');
    expect(card.getAttribute('aria-modal')).toBe('true');
    expect(title()).toBe(en['tutorial.welcome.title']);
    expect(q('tutorial-skip').textContent).toBe('Skip tutorial');
  });

  test('a browser that refuses storage does not break it: it simply shows every time', () => {
    const spy = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    const set = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    try {
      const tutorial = createTutorial();
      expect(tutorial.seen()).toBe(false);
      tutorial.open();
      expect(() => q('tutorial-skip').click()).not.toThrow();
      expect(tutorial.isOpen()).toBe(false);
    } finally {
      spy.mockRestore();
      set.mockRestore();
    }
  });

  test('the menu item opens it, and mounting the interface does not open it by itself', () => {
    const ui = mount();
    expect(ui.tutorial.isOpen()).toBe(false);
    q('tutorial-open').click();
    expect(ui.tutorial.isOpen()).toBe(true);
    expect(q('tutorial')).not.toBeNull();
    ui.dispose();
    expect(q('tutorial')).toBeNull();
  });
});
