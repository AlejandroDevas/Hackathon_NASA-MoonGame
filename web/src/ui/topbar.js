import { setLocale, t } from '../i18n.js';
import { icon } from './icons.js';
import { attachMenu } from './menu.js';

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

/** A button with an icon and a text label (the label is hidden on narrow screens; the button keeps its accessible name). */
function toolButton(testId, iconName, onClick) {
  const button = el('button', 'tb-button');
  button.type = 'button';
  button.dataset.testid = testId;
  const label = el('span', 'tb-label');
  button.append(icon(iconName), label);
  button.addEventListener('click', onClick);
  return { button, label };
}

/**
 * The top bar: the name of the app, the language and the site on the left; the 3D view toggles (from right to
 * left: sound, lighten shadows, LROC image, free view) and a drop-down menu on the right. The menu
 * opens the planner panel and the Analysis window, switches Compare on and off and starts the tutorial.
 * @param {{get(): object, set(p: object): void}} store
 * @param {{analysis: {open(): void}, sites: Map<string, object>, siteList: Array<{id: string, name: string}>, audioCue?: {setEnabled(on: boolean): boolean}, tutorial?: {open(): void}}} deps
 */
export function createTopBar(store, { analysis, sites, siteList, audioCue, tutorial }) {
  const header = el('header', 'topbar');

  const brand = el('div', 'topbar-brand');
  const kicker = el('p', 'topbar-kicker');
  const title = el('h1', 'topbar-title');
  brand.append(kicker, title);

  const locale = el('select', 'topbar-locale');
  locale.dataset.testid = 'locale';
  for (const code of ['es', 'en']) locale.add(new Option(code.toUpperCase(), code, false, code === store.get().locale));
  locale.addEventListener('change', () => {
    setLocale(locale.value);
    store.set({ locale: locale.value });
  });

  // the site shown in the 3D scene (scenario A's); scenario B has its own selector in the planner
  const site = el('select', 'topbar-site');
  site.dataset.testid = 'site-top';
  for (const entry of siteList) site.add(new Option(entry.name, entry.id, false, entry.id === store.get().scenarios.A.siteId));
  site.addEventListener('change', () => {
    const { scenarios } = store.get();
    if (site.value !== scenarios.A.siteId) store.set({ scenarios: { ...scenarios, A: { ...scenarios.A, siteId: site.value } } });
  });

  // left to right: free view, LROC image, lighten shadows, sound (so, from the right: sound first)
  const view = toolButton('view-toggle', 'orbit', () =>
    store.set({ viewMode: store.get().viewMode === 'free' ? 'follow' : 'free' }),
  );
  const lroc = toolButton('lroc-toggle', 'image', () => store.set({ lrocTexture: store.get().lrocTexture === false }));
  const shadow = toolButton('shadow-lift-toggle', 'shadow', () => store.set({ shadowLift: !store.get().shadowLift }));
  const sound = toolButton('sound-toggle', 'sound', () => {
    const enabled = !store.get().soundEnabled;
    const active = audioCue ? audioCue.setEnabled(enabled) : enabled;
    store.set({ soundEnabled: active });
  });
  const tools = el('div', 'topbar-tools');
  tools.setAttribute('role', 'group');
  tools.append(view.button, lroc.button, shadow.button, sound.button);

  // drop-down menu
  const menuWrap = el('div', 'topbar-menu');
  const menuButton = el('button', 'tb-button tb-menu-button');
  menuButton.type = 'button';
  menuButton.dataset.testid = 'menu-toggle';
  const menuLabel = el('span', 'tb-label');
  menuButton.append(icon('menu'), menuLabel, icon('chevron'));
  const menu = el('div', 'menu-list');
  menu.setAttribute('role', 'menu');
  menu.dataset.testid = 'menu';

  function menuItem(testId, role, onClick) {
    const item = el('button', 'menu-item');
    item.type = 'button';
    item.setAttribute('role', role);
    item.dataset.testid = testId;
    const mark = icon('check');
    mark.classList.add('menu-check');
    const text = el('span', 'menu-text');
    item.append(text, mark);
    item.addEventListener('click', onClick);
    return { item, text };
  }
  const planner = menuItem('panel-toggle', 'menuitemcheckbox', () => store.set({ panelOpen: !store.get().panelOpen }));
  const analysisItem = menuItem('analysis-open', 'menuitem', () => analysis.open());
  const compare = menuItem('compare-toggle', 'menuitemcheckbox', () => {
    const { scenarios } = store.get();
    const turningOn = !scenarios.B;
    // comparing is done in the planner, so switching it on shows the planner
    store.set({ scenarios: { A: scenarios.A, B: turningOn ? { ...scenarios.A } : null }, ...(turningOn ? { panelOpen: true } : {}) });
  });
  const tutorialItem = menuItem('tutorial-open', 'menuitem', () => tutorial?.open());
  menu.append(planner.item, analysisItem.item, compare.item, tutorialItem.item);
  menuWrap.append(menuButton, menu);
  attachMenu({ trigger: menuButton, menu });

  header.append(brand, locale, site, el('div', 'topbar-spacer'), tools, menuWrap);

  /** Text, state and availability of every control for the current state. */
  function refresh(state) {
    document.documentElement.lang = state.locale;
    kicker.textContent = t('app.kicker');
    title.textContent = t('app.title');
    locale.setAttribute('aria-label', t('ctl.language'));
    if (locale.value !== state.locale) locale.value = state.locale;
    site.setAttribute('aria-label', t('ctl.site'));
    site.title = t('ctl.site');
    if (site.value !== state.scenarios.A.siteId) site.value = state.scenarios.A.siteId;

    const setToggle = ({ button, label }, text, pressed, ariaLabel = text) => {
      label.textContent = text;
      button.title = text;
      button.setAttribute('aria-label', ariaLabel);
      button.setAttribute('aria-pressed', String(pressed));
    };
    setToggle(view, state.viewMode === 'free' ? t('app.viewFollow') : t('app.viewFree'), state.viewMode === 'free');
    const hasLroc = Boolean(sites.get(state.scenarios.A.siteId)?.info.albedo);
    setToggle(lroc, t('app.lroc'), hasLroc && state.lrocTexture !== false);
    lroc.button.disabled = !hasLroc;
    lroc.button.title = hasLroc ? t('app.lroc') : t('app.lrocNone');
    setToggle(shadow, t('app.shadowLift'), Boolean(state.shadowLift));
    setToggle(sound, state.soundEnabled ? t('app.soundOff') : t('app.soundOn'), Boolean(state.soundEnabled));

    menuLabel.textContent = t('ui.menu');
    menuButton.setAttribute('aria-label', t('ui.menu'));
    planner.text.textContent = t('ui.menuPlanner');
    planner.item.setAttribute('aria-checked', String(Boolean(state.panelOpen)));
    analysisItem.text.textContent = t('analysis.open');
    compare.text.textContent = state.scenarios.B ? t('app.compareOff') : t('app.compare');
    compare.item.setAttribute('aria-checked', String(Boolean(state.scenarios.B)));
    tutorialItem.text.textContent = t('ui.menuTutorial');
  }

  return { el: header, refresh, menu: { button: menuButton, list: menu } };
}
