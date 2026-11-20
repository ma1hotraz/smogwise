// @vitest-environment jsdom
import { render, screen, waitFor } from '@testing-library/preact';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { App } from '../../src/client/App.js';
import { AnnouncerProvider } from '../../src/client/lib/announcer.js';
import { expectAccessible } from '../helpers/a11y.js';
import { liveAir, stubApi } from '../helpers/browser.js';
import { sample } from '../helpers/fixtures.js';

const renderApp = () =>
  render(
    <AnnouncerProvider>
      <App />
    </AnnouncerProvider>,
  );

describe('App', () => {
  it('goes from a sample to the plan, saves it, and focuses the new heading', async () => {
    stubApi({ '/api/air': liveAir() });
    const user = userEvent.setup();
    renderApp();
    expect(screen.getByRole('link', { name: 'Skip to content' })).toHaveAttribute('href', '#main');
    await user.click(screen.getByRole('button', { name: /Chen family/ }));
    const heading = await screen.findByRole('heading', { level: 1, name: /Beijing/ });
    await waitFor(() => {
      expect(heading).toHaveFocus();
    });
    expect(JSON.parse(localStorage.getItem('smogwise.profile.v1') ?? '{}').location.name).toBe(
      'Beijing',
    );
    await waitFor(() => {
      expect(screen.getByTestId('announcer')).toHaveTextContent(/ready|Live air/);
    });
  });

  it('restores a saved plan, edits it and forgets everything', async () => {
    localStorage.setItem('smogwise.profile.v1', JSON.stringify(sample('ayesha')));
    stubApi({ '/api/air': liveAir() });
    const user = userEvent.setup();
    renderApp();
    expect(await screen.findByRole('heading', { level: 1, name: /Lahore/ })).toBeInTheDocument();
    await user.click(screen.getByText(/Have a reading/));
    await user.click(screen.getByRole('button', { name: 'Edit household details' }));
    expect(
      screen.getByRole('heading', { level: 1, name: /Plan a cleaner-air day/ }),
    ).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: 'City or town' })).toHaveValue(
      'Lahore, Punjab, PK',
    );
    await user.click(screen.getByRole('button', { name: 'Build my day' }));
    await screen.findByRole('heading', { level: 1, name: /Lahore/ });
    await user.click(screen.getByText(/Have a reading/));
    await user.click(screen.getByRole('button', { name: 'Forget my data' }));
    expect(localStorage.getItem('smogwise.profile.v1')).toBeNull();
    expect(
      screen.getByRole('heading', { level: 1, name: /Plan a cleaner-air day/ }),
    ).toBeInTheDocument();
  });

  it('applies theme and text size preferences and remembers them', async () => {
    const user = userEvent.setup();
    renderApp();
    await user.selectOptions(screen.getByLabelText('Theme'), 'dark');
    await user.selectOptions(screen.getByLabelText('Text size'), '130');
    expect(document.documentElement).toHaveAttribute('data-theme', 'dark');
    expect(document.documentElement).toHaveAttribute('data-text', '130');
    expect(JSON.parse(localStorage.getItem('smogwise.prefs.v1') ?? '{}')).toEqual({
      theme: 'dark',
      textSize: '130',
    });
    await user.selectOptions(screen.getByLabelText('Theme'), 'system');
    expect(document.documentElement).not.toHaveAttribute('data-theme');
  });

  it('has no axe violations', async () => {
    const { container } = renderApp();
    await expectAccessible(container);
  });
});
