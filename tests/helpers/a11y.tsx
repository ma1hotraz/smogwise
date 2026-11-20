import { render } from '@testing-library/preact';
import type { VNode } from 'preact';
import { expect } from 'vitest';
import { axe } from 'vitest-axe';

/**
 * Renders in light and dark themes and asserts axe finds no violations. jsdom cannot compute
 * colours, so contrast is asserted separately over the design tokens (tests/unit/contrast.test.ts).
 */
export async function expectNoViolations(ui: () => VNode): Promise<void> {
  for (const theme of ['light', 'dark']) {
    document.documentElement.dataset.theme = theme;
    const { container, unmount } = render(ui());
    const results = await axe(container, { rules: { 'color-contrast': { enabled: false } } });
    expect(results).toHaveNoViolations();
    unmount();
  }
}

/** Asserts no violations on an element that is already rendered. */
export async function expectAccessible(container: Element): Promise<void> {
  const results = await axe(container, { rules: { 'color-contrast': { enabled: false } } });
  expect(results).toHaveNoViolations();
}
