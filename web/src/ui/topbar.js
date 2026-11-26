import { setLocale, t } from '../i18n.js';
import { icon } from './icons.js';
import { nextQualityMode } from '../scene/quality.js';
import { buildUrlSearch } from '../urlState.js';
import { attachMenu } from './menu.js';

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

const DEFAULT_VOLUME = 0.6;
const LANG_KEY = 'inside-moon-153.lang';

/** The mini-game (`web/public/juego/`), served next to the app; relative so it works under any base path. */
export const GAME_URL = './juego/index.html';

/** The start screen with the Moon (`web/public/inicio/`); relative, like the game's. */
export const HOME_URL = './inicio/index.html';

const TOAST_MS = 2200;

/** A short message that fades by itself (a polite status for screen readers too). */
function showToast(text) {
  document.querySelector('.toast')?.remove();
  const toast = el('div', 'toast', text);
  toast.setAttribute('role', 'status');
  document.body.append(toast);
  setTimeout(() => toast.remove(), TOAST_MS);
}

/** The link to the scenario on screen: this page with its site, date and language. */
export function shareLink(state, win = window) {
  const { siteId, timeMs } = state.scenarios.A;
  return `${win.location.origin}${win.location.pathname}${buildUrlSearch('', { siteId, timeMs, locale: state.locale })}`;
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
 * Beside the menu, a link takes the visitor to the mini-game.
 * @param {{get(): object, set(p: object): void}} store
 * @param {{analysis: {open(): void}, sites: Map<string, object>, siteList: Array<{id: string, name: string}>, audioCue?: {setEnabled(on: boolean): boolean}, tutorial?: {open(): void}}} deps
 */
export function createTopBar(store, { analysis, sites, siteList, audioCue, tutorial }) {
  const header = el('header', 'topbar');

  // back to the start screen (the Moon with the landing sites); a plain link, so it also works with the keyboard
  const homeLink = el('a', 'tb-button tb-home');
  homeLink.href = HOME_URL;
  homeLink.dataset.testid = 'home-link';
  const homeLabel = el('span', 'tb-label');
  homeLink.append(icon('home'), homeLabel);

  const brand = el('div', 'topbar-brand');
  const kicker = el('p', 'topbar-kicker');
  const title = el('h1', 'topbar-title');
  brand.append(kicker, title);

  const locale = el('select', 'topbar-locale');
  locale.dataset.testid = 'locale';
  for (const code of ['es', 'en']) locale.add(new Option(code.toUpperCase(), code, false, code === store.get().locale));
  locale.addEventListener('change', () => {
    setLocale(locale.value);
    try {
      window.localStorage.setItem(LANG_KEY, locale.value); // the game reads the same choice
    } catch {
      /* no storage: the choice lasts for this visit */
    }
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
  // the master volume, just left of the sound button it belongs to
  const volume = el('input', 'tb-volume');
  volume.type = 'range';
  volume.min = '0';
  volume.max = '1';
  volume.step = '0.05';
  volume.value = String(store.get().volume ?? DEFAULT_VOLUME);
  volume.dataset.testid = 'volume';
  volume.addEventListener('input', () => {
    const next = Number(volume.value);
    store.set({ volume: next });
    audioCue?.setVolume?.(next);
  });

  // two groups with a thin divider between them: what the 3D view shows, and the sound
  const tools = el('div', 'topbar-tools');
  const viewGroup = el('div', 'tb-group');
  viewGroup.setAttribute('role', 'group');
  viewGroup.append(view.button, lroc.button, shadow.button);
  const soundGroup = el('div', 'tb-group');
  soundGroup.setAttribute('role', 'group');
  soundGroup.append(volume, sound.button);
  tools.append(viewGroup, soundGroup);

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
  const qualityItem = menuItem('quality-cycle', 'menuitem', () => store.set({ quality: nextQualityMode(store.get().quality ?? 'auto') }));
  const shareItem = menuItem('share-link', 'menuitem', async () => {
    try {
      await navigator.clipboard.writeText(shareLink(store.get()));
      showToast(t('ui.shareDone'));
    } catch {
      showToast(t('ui.shareFail')); // no clipboard (an insecure page, or the browser said no)
    }
  });
  // the game, also here: on a narrower screen its button leaves the bar to give the site name room (see ui.css)
  const gameItem = el('a', 'menu-item menu-game');
  gameItem.setAttribute('role', 'menuitem');
  gameItem.dataset.testid = 'game-menu-link';
  gameItem.href = GAME_URL;
  const gameItemText = el('span', 'menu-text');
  gameItem.append(gameItemText, icon('gamepad'));
  menu.append(planner.item, analysisItem.item, compare.item, qualityItem.item, shareItem.item, gameItem, tutorialItem.item);
  menuWrap.append(menuButton, menu);
  attachMenu({ trigger: menuButton, menu });

  // the game lives on its own page: a plain link, so it works as a redirect (and with the keyboard)
  const gameLink = el('a', 'tb-button tb-game');
  gameLink.href = GAME_URL;
  gameLink.dataset.testid = 'game-link';
  const gameLabel = el('span', 'tb-label');
  gameLink.append(icon('gamepad'), gameLabel);

  header.append(homeLink, brand, locale, site, el('div', 'topbar-spacer'), tools, gameLink, menuWrap);

  /** Text, state and availability of every control for the current state. */
  function refresh(state) {
    document.documentElement.lang = state.locale;
    kicker.textContent = t('app.kicker');
    viewGroup.setAttribute('aria-label', t('ui.groupView'));
    soundGroup.setAttribute('aria-label', t('ui.groupSound'));
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
    volume.setAttribute('aria-label', t('ctl.volume'));
    volume.title = t('ctl.volume');
    if (state.volume !== undefined && Number(volume.value) !== state.volume) volume.value = String(state.volume);

    homeLabel.textContent = t('app.home');
    homeLink.href = `${HOME_URL}?lang=${state.locale}`; // the start screen opens in the same language
    homeLink.setAttribute('aria-label', t('app.homeLabel'));
    homeLink.title = t('app.homeLabel');

    gameLabel.textContent = t('app.game');
    gameLink.href = `${GAME_URL}?lang=${state.locale}`; // the game opens in the same language
    gameItem.href = gameLink.href;
    gameItemText.textContent = t('app.game');
    gameItem.title = t('app.gameLabel');
    gameLink.setAttribute('aria-label', t('app.gameLabel'));
    gameLink.title = t('app.gameLabel');

    menuLabel.textContent = t('ui.menu');
    menuButton.setAttribute('aria-label', t('ui.menu'));
    planner.text.textContent = t('ui.menuPlanner');
    planner.item.setAttribute('aria-checked', String(Boolean(state.panelOpen)));
    analysisItem.text.textContent = t('analysis.open');
    compare.text.textContent = state.scenarios.B ? t('app.compareOff') : t('app.compare');
    compare.item.setAttribute('aria-checked', String(Boolean(state.scenarios.B)));
    qualityItem.text.textContent = t('ui.menuQuality', { mode: t(`quality.${state.quality ?? 'auto'}`) });
    shareItem.text.textContent = t('ui.menuShare');
    tutorialItem.text.textContent = t('ui.menuTutorial');
  }

  return { el: header, refresh, menu: { button: menuButton, list: menu } };
}
