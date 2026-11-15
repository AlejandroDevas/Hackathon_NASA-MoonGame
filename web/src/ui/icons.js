/**
 * Small line icons (24 x 24, drawn with the current text colour) for the top bar and the player.
 * They are static strings written here, never built from user data.
 */
const PATHS = {
  menu: '<path d="M4 7h16M4 12h16M4 17h16"/>',
  chevron: '<path d="m6 9 6 6 6-6"/>',
  check: '<path d="m5 12.5 4.5 4.5L19 7.5"/>',
  close: '<path d="M6 6l12 12M18 6 6 18"/>',
  play: '<path class="fill" d="M8 5.5v13l11-6.5z"/>',
  pause: '<path class="fill" d="M7 5h3.5v14H7zM13.5 5H17v14h-3.5z"/>',
  back: '<path d="m12 7-5 5 5 5M18 7l-5 5 5 5"/>',
  forward: '<path d="m12 7 5 5-5 5M6 7l5 5-5 5"/>',
  sound: '<path d="M4 10v4h3.5L12 18V6L7.5 10z"/><path d="M15.5 9a4 4 0 0 1 0 6M18 6.5a7.5 7.5 0 0 1 0 11"/>',
  shadow: '<circle cx="12" cy="12" r="4"/><path d="M12 3v2.5M12 18.5V21M3 12h2.5M18.5 12H21M5.6 5.6l1.8 1.8M16.6 16.6l1.8 1.8M5.6 18.4l1.8-1.8M16.6 7.4l1.8-1.8"/>',
  image: '<rect x="4" y="5" width="16" height="14" rx="1.5"/><path d="m4 16 4.5-4.5 3.5 3.5 3-3 5 5"/><circle cx="9" cy="9.5" r="1.2"/>',
  orbit: '<circle cx="12" cy="12" r="2.5"/><path d="M4 12a8 4 0 1 0 16 0 8 4 0 1 0-16 0" transform="rotate(-25 12 12)"/>',
  gamepad: '<path d="M7.5 8h9a4.5 4.5 0 0 1 4.4 5.4l-.7 3.2a2 2 0 0 1-3.4 1l-1.9-2.1h-4.6l-1.9 2.1a2 2 0 0 1-3.4-1l-.7-3.2A4.5 4.5 0 0 1 7.5 8z"/><path d="M8 10.5v3M6.5 12h3"/><circle cx="15.5" cy="11.2" r=".6"/><circle cx="17.5" cy="13" r=".6"/>',
  speed: '<path d="M4.5 16a8 8 0 1 1 15 0"/><path d="m12 13 4-4"/>',
};

/**
 * @param {keyof typeof PATHS} name
 * @returns {SVGSVGElement}
 */
export function icon(name) {
  const template = document.createElement('template');
  template.innerHTML = `<svg class="icon icon-${name}" viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${PATHS[name]}</svg>`;
  return template.content.firstElementChild;
}

export const ICON_NAMES = Object.keys(PATHS);
