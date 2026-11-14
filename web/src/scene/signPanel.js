import { t } from '../i18n.js';

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

/**
 * The site sign shown when the robot reaches the goal. Closed, it is hidden from
 * assistive technology (aria-hidden) and, through CSS, from the tab order.
 * @returns {{el: HTMLElement, setInfo(info: object, locale: string): void, setOpen(open: boolean): void, isOpen(): boolean}}
 */
export function createSignPanel() {
  const root = el('aside', 'scene-sign');
  root.setAttribute('role', 'status');
  root.setAttribute('aria-hidden', 'true');
  let open = false;

  return {
    el: root,
    setInfo(info, locale) {
      const sign = info.sign[locale] ?? info.sign.es;
      const facts = el('ul');
      for (const fact of sign.facts) facts.append(el('li', '', fact));
      root.replaceChildren(el('h3', '', sign.title), el('p', '', sign.body), facts, el('p', 'scene-sign-hint', t('scene.signClose')));
    },
    setOpen(next) {
      open = Boolean(next);
      root.classList.toggle('open', open);
      root.setAttribute('aria-hidden', String(!open));
    },
    isOpen: () => open,
  };
}
