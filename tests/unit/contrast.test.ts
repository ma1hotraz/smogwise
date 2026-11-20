/** WCAG contrast over the design tokens, both themes (docs/06 §1: 1.4.3 and 1.4.11). */
import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

const css = readFileSync('src/client/styles/tokens.css', 'utf8');

function tokens(selector: string): Record<string, string> {
  const start = css.indexOf(selector);
  const block = css.slice(css.indexOf('{', start) + 1, css.indexOf('}', start));
  return Object.fromEntries(
    [...block.matchAll(/--([\w-]+):\s*(#[0-9a-f]{6})/gi)].map((m): [string, string] => [
      m[1] ?? '',
      m[2] ?? '',
    ]),
  );
}

const light = tokens(':root {');
const dark = { ...light, ...tokens(":root[data-theme='dark']") };

function luminance(hex: string): number {
  const channels = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
  const [r, g, b] = channels.map((c) =>
    c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4,
  ) as [number, number, number];
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number];
  return (hi + 0.05) / (lo + 0.05);
}

const TEXT_PAIRS: [string, string][] = [
  ['ink', 'paper'],
  ['ink', 'surface'],
  ['ink-soft', 'paper'],
  ['ink-soft', 'surface'],
  ['sky', 'paper'],
  ['sky', 'surface'],
  ['sky-ink', 'sky'],
  ['haze', 'surface'],
  ['haze', 'paper'],
  ['danger', 'surface'],
  ['ink', 'haze-wash'],
  ['ink', 'danger-wash'],
  ['ink', 'sky-wash'],
  ['sky', 'sky-wash'],
];

const GRAPHIC_PAIRS: [string, string][] = [
  ['focus', 'paper'],
  ['focus', 'surface'],
  ...[0, 1, 2, 3, 4, 5].flatMap((l): [string, string][] => [
    [`lvl-${l}`, 'surface'],
    [`lvl-${l}`, 'paper'],
  ]),
];

describe.each([
  ['light', light],
  ['dark', dark],
])('%s theme', (_name, theme) => {
  it.each(TEXT_PAIRS)('text %s on %s is at least 4.5:1', (fg, bg) => {
    expect(contrast(theme[fg]!, theme[bg]!)).toBeGreaterThanOrEqual(4.5);
  });

  it.each(GRAPHIC_PAIRS)('graphic %s on %s is at least 3:1', (fg, bg) => {
    expect(contrast(theme[fg]!, theme[bg]!)).toBeGreaterThanOrEqual(3);
  });
});

describe('dark theme is defined twice, identically', () => {
  it('the prefers-color-scheme block matches the explicit dark theme', () => {
    const media = tokens(":root:not([data-theme='light'])");
    expect(media).toEqual(tokens(":root[data-theme='dark']"));
  });
});
