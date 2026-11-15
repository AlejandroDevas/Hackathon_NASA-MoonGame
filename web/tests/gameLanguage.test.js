import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { JSDOM } from 'jsdom';
import { afterEach, describe, expect, test } from 'vitest';

const GAME_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'juego');
const HTML = readFileSync(join(GAME_DIR, 'index.html'), 'utf8');

// a canvas context that accepts any call: the game draws every frame, jsdom has no canvas
const anyCall = () => new Proxy(function () {}, { get: (t, key) => (key === Symbol.toPrimitive ? () => 0 : anyCall()), apply: () => anyCall(), set: () => true });

const open = [];
function load(query = '') {
  const dom = new JSDOM(HTML, {
    runScripts: 'dangerously',
    pretendToBeVisual: true,
    url: `http://localhost/juego/index.html${query}`,
    beforeParse(window) {
      window.HTMLCanvasElement.prototype.getContext = () => anyCall();
    },
  });
  open.push(dom);
  return dom.window;
}
afterEach(() => {
  while (open.length) open.pop().window.close();
});

const read = (window, expression) => window.eval(expression);
const visibleText = (window) => {
  const out = [];
  const walker = window.document.createTreeWalker(window.document.body, window.NodeFilter.SHOW_TEXT);
  while (walker.nextNode()) {
    const node = walker.currentNode;
    if (['SCRIPT', 'STYLE', 'OPTION'].includes(node.parentElement?.tagName)) continue;
    const text = node.nodeValue.trim().replace(/\s+/g, ' ');
    if (/\p{L}/u.test(text)) out.push(text);
  }
  return out;
};
const DATA = `({
  npcs: npcs.map((n) => [n.name, n.role, n.targetLabel, n.introDialogue, n.activeDialogue, n.doneDialogue]),
  sites: Object.values(lunarLandingSites).map((s) => [s.name, s.sunHours, s.earthComm, s.iceProximity, s.desc]),
  structures: lunarStructures.map((s) => [s.name]),
  research: researchNodes.map((n) => [n.title, n.body, n.stats]),
  monsters: monsters.map((m) => [m.name]),
  story: storySlides.map((s) => [s.title, s.text, s.svg]),
  shop: shopCatalog.map((i) => [i.name, i.desc]),
})`;

describe('the game works without internet', () => {
  test('loads nothing from another origin, and its local files exist', () => {
    expect(HTML).not.toMatch(/(?:src|href)\s*=\s*["']\s*(?:https?:)?\/\//i);
    expect(HTML).not.toMatch(/cdn\.tailwindcss|fonts\.googleapis|fonts\.gstatic/i);
    for (const file of ['tailwind.css', 'fonts.css']) expect(existsSync(join(GAME_DIR, file)), file).toBe(true);
    const fonts = readFileSync(join(GAME_DIR, 'fonts.css'), 'utf8');
    const files = [...fonts.matchAll(/url\('\.\/(fonts\/[^']+)'\)/g)].map((m) => m[1]);
    expect(files.length).toBe(5);
    for (const file of files) expect(existsSync(join(GAME_DIR, file)), file).toBe(true);
    for (const css of ['tailwind.css', 'fonts.css']) expect(readFileSync(join(GAME_DIR, css), 'utf8')).not.toMatch(/url\(\s*["']?\s*(?:https?:)?\/\//i);
  });

  test('the compiled Tailwind has the classes the page uses', () => {
    const css = readFileSync(join(GAME_DIR, 'tailwind.css'), 'utf8');
    for (const cls of ['.bg-slate-900', '.rounded-3xl', '.backdrop-blur-md', '.animate-ping', '.hidden', '.fixed', '.sm\\:text-base']) {
      expect(css, cls).toContain(cls);
    }
  });
});

describe('the game in English', () => {
  test('starts in Spanish by default and in English with ?lang=en, and remembers the choice', () => {
    const es = load();
    expect(read(es, 'GAME_LANG')).toBe('es');
    expect(es.document.documentElement.lang).toBe('es');
    expect(es.document.getElementById('gameLang').value).toBe('es');
    const en = load('?lang=en');
    expect(read(en, 'GAME_LANG')).toBe('en');
    expect(en.document.documentElement.lang).toBe('en');
    expect(en.document.title).toBe('Lunar Rescue Mission: South Pole (Roblox NASA Edition)');
    expect(en.localStorage.getItem('inside-moon-153.lang')).toBe('en');
    // without the parameter, the saved language is used
    expect(read(en, "new URLSearchParams(location.search).get('lang')")).toBe('en');
  });

  test('the way back keeps the language', () => {
    const en = load('?lang=en');
    for (const id of ['btnBackHome', 'btnBackHomeStory']) {
      expect(en.document.getElementById(id).getAttribute('href')).toBe('../index.html?lang=en');
    }
    expect(load('?lang=es').document.getElementById('btnBackHome').getAttribute('href')).toBe('../index.html?lang=es');
  });

  test('every piece of game data (people, sites, beacons, story, shop) is translated', () => {
    const es = read(load('?lang=es'), DATA);
    const en = read(load('?lang=en'), DATA);
    for (const group of Object.keys(es)) {
      expect(en[group].length).toBe(es[group].length);
      es[group].forEach((fields, i) => {
        fields.forEach((value, j) => {
          const label = `${group}[${i}][${j}]`;
          if (group === 'story' && j === 2) {
            // the drawings carry text too
            const labels = (svg) => [...svg.matchAll(/>([^<>]+)<\/text>/g)].map((m) => m[1].trim());
            labels(value).forEach((text, k) => expect(labels(en[group][i][j])[k], label).not.toBe(text));
            return;
          }
          expect(en[group][i][j], label).not.toBe(value);
        });
      });
    }
    // and nothing left in Spanish punctuation or accents in the English data
    expect(JSON.stringify(en)).not.toMatch(/[¡¿ñáéíóúÁÉÍÓÚ]/);
  });

  test('every text of the page is translated, except names and symbols that are the same in English', () => {
    const es = visibleText(load('?lang=es'));
    const en = new Set(visibleText(load('?lang=en')));
    const same = es.filter((text) => en.has(text));
    // proper names and key hints written the same in both languages
    const allowed = new Set(['Moon Insight 153', 'Radio [C]', 'Rover [R]', 'Visible', 'Lat', 'Lon', 'NASA', 'CLPS', 'Artemis', 'CLPS (Commercial Lunar Payload Services)', '15 Oct 2026']);
    const missing = same.filter((text) => !allowed.has(text) && !/^[\d\W]+$/u.test(text) && !/^\[[A-Z]\]$/.test(text));
    expect(missing).toEqual([]);
  });

  test('every text the script translates on the fly has an English version', () => {
    const dictionary = read(load('?lang=en'), 'EN');
    const keys = new Set(Object.keys(dictionary));
    const calls = [...HTML.matchAll(/\btr\((?:'((?:[^'\\]|\\.)*)'|"((?:[^"\\]|\\.)*)"|`((?:[^`\\]|\\.)*)`)/g)];
    expect(calls.length).toBeGreaterThan(40);
    for (const match of calls) {
      const key = (match[1] ?? match[2] ?? match[3]).replace(/\\'/g, "'").replace(/\\"/g, '"');
      if (key.includes('${') || /^\w+$/.test(key) && !keys.has(key) && key === 'text') continue;
      expect(keys.has(key), key).toBe(true);
    }
    // no toast is shown without going through the translator
    const raw = [...HTML.matchAll(/showToast\((?!tr\()/g)].length;
    expect(raw).toBe(1); // the definition itself: function showToast(msg, ...)
  });

  test('the dynamic texts come out in English', () => {
    const en = load('?lang=en');
    expect(read(en, "tr('Luz activa • {h}h restantes', { h: 5 })")).toBe('Light active • 5h left');
    expect(read(en, "tr('🎉 ¡Tarea \\'{label}\\' completada! +{bonus} Puntos.', { label: 'X', bonus: 150 })")).toBe("🎉 Task 'X' completed! +150 points.");
    expect(read(en, "tr('un texto sin traducir')")).toBe('un texto sin traducir');
    const es = load('?lang=es');
    expect(read(es, "tr('Luz activa • {h}h restantes', { h: 5 })")).toBe('Luz activa • 5h restantes');
  });

  test('the language selector of the intro screen has both languages', () => {
    const picker = load().document.getElementById('gameLang');
    expect([...picker.options].map((o) => o.value)).toEqual(['es', 'en']);
  });
});
