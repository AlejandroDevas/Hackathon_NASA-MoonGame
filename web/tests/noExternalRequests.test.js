import { readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, test } from 'vitest';

const WEB = join(dirname(fileURLToPath(import.meta.url)), '..');

function filesUnder(dir, extension) {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return filesUnder(path, extension);
    return path.endsWith(extension) ? [path] : [];
  });
}

describe('the page works offline and does not tell third parties who visits', () => {
  test('index.html loads no script, stylesheet, font or preconnect from another origin', () => {
    const html = readFileSync(join(WEB, 'index.html'), 'utf8');
    expect(html).not.toMatch(/(?:src|href)\s*=\s*["']\s*(?:https?:)?\/\//i);
  });

  test('no stylesheet imports or references a remote URL', () => {
    for (const file of filesUnder(join(WEB, 'src'), '.css')) {
      const css = readFileSync(file, 'utf8');
      expect(css, file).not.toMatch(/url\(\s*["']?\s*(?:https?:)?\/\//i);
      expect(css, file).not.toMatch(/@import\s+["']?\s*(?:https?:)?\/\//i);
    }
  });
});
