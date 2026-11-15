import en from './strings/en.json';
import es from './strings/es.json';

const TABLES = { es, en };
let locale = 'es';

export function setLocale(next) {
  if (!TABLES[next]) throw new Error(`Unsupported locale: ${next}`);
  locale = next;
}

export function getLocale() {
  return locale;
}

/** Translate `key` in the active locale, replacing `{name}` placeholders. */
export function t(key, params = {}) {
  const text = TABLES[locale][key];
  if (text === undefined) return key;
  return text.replace(/\{(\w+)\}/g, (match, name) => (name in params ? String(params[name]) : match));
}

/** "2 d 3 h", "7 h 18 min", "30 min", "<1 min". */
export function formatDuration(ms) {
  const totalMin = Math.round(Math.max(ms, 0) / 60_000);
  if (totalMin < 1) return '<1 min';
  const days = Math.floor(totalMin / 1440);
  const hours = Math.floor((totalMin % 1440) / 60);
  const minutes = totalMin % 60;
  if (days >= 1) return hours ? `${days} d ${hours} h` : `${days} d`;
  if (hours >= 1) return minutes ? `${hours} h ${minutes} min` : `${hours} h`;
  return `${minutes} min`;
}

/** "7 may 2029" / "7 May 2029": the UTC calendar date of `ms`, in the active language. */
export function formatDate(ms) {
  return new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }).format(ms);
}
