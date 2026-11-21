/** WCAG contrast over the design tokens, both themes (docs/06 §1: 1.4.3 and 1.4.11). */
import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

const css = readFileSync('src/client/styles/tokens.css', 'utf8');

/** Colour tokens for one theme, read from `--name: light-dark(#light, #dark)` declarations. */
function tokens(theme: 'light' | 'dark'): Record<string, string> {
  const pairs = [...css.matchAll(/--([\w-]+):\s*light-dark\((#[0-9a-f]{6}),\s*(#[0-9a-f]{6})\)/gi)];
  return Object.fromEntries(
    pairs.map((m): [string, string] => [m[1] ?? '', (theme === 'light' ? m[2] : m[3]) ?? '']),
  );
}

const light = tokens('light');
const dark = tokens('dark');

function luminance(hex: string): number {
  const channels = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
  const [r, g, b] = channels.map((c) =>
    c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4,
  ) as [number, number, number];
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(a: string, b: string): number {
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

describe('theme tokens', () => {
  it('defines every colour for both themes, once', () => {
    expect(Object.keys(light).length).toBeGreaterThanOrEqual(19);
    expect(Object.keys(dark)).toEqual(Object.keys(light));
    expect(css).not.toMatch(/prefers-color-scheme/);
  });
});
