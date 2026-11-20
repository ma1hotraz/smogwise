// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor, within } from '@testing-library/preact';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { PlanView } from '../../src/client/features/plan/PlanView.js';
import { AnnouncerProvider } from '../../src/client/lib/announcer.js';
import type { Profile } from '../../src/shared/schema/profile.js';
import { expectAccessible } from '../helpers/a11y.js';
import { liveAir, stubApi } from '../helpers/browser.js';
import { sample } from '../helpers/fixtures.js';

const BRIEF = {
  headline: 'Poor air in Delhi: limit time outdoors',
  summary: 'Cleanest 14:00–16:00.',
  source: 'gemini',
};

function renderPlan(profile: Profile = sample('sharma'), routes: Record<string, unknown> = {}) {
  const api = stubApi({ '/api/air': liveAir(), '/api/brief': BRIEF, ...routes });
  const onEdit = vi.fn();
  const onForget = vi.fn();
  const view = render(
    <AnnouncerProvider>
      <PlanView profile={profile} onEdit={onEdit} onForget={onForget} />
    </AnnouncerProvider>,
  );
  return { ...view, api, onEdit, onForget };
}

describe('PlanView — Today', () => {
  it('renders instantly, then swaps in live data and the AI brief', async () => {
    const { api } = renderPlan();
    expect(
      screen.getByRole('heading', { level: 1, name: /^Delhi: .* air on the India AQI scale$/ }),
    ).toBeInTheDocument();
    expect(screen.getByText(/Fetching the live forecast/)).toBeInTheDocument();
    expect(
      await screen.findByText('Live forecast: CAMS model via Open-Meteo.'),
    ).toBeInTheDocument();
    expect(await screen.findByRole('heading', { name: BRIEF.headline })).toBeInTheDocument();
    expect(screen.getByText('Written by Gemini from your plan’s figures.')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Your low-emission day' })).toBeInTheDocument();
    expect(screen.getAllByText(/Why: rule R\d\d/).length).toBeGreaterThan(3);
    expect(screen.getByText(/For your household:/)).toBeInTheDocument();
    expect(api.calls.map((c) => c.url)).toContain('/api/air?lat=28.7&lon=77.2');
    await waitFor(() => {
      expect(screen.getByTestId('announcer')).toHaveTextContent('Live air data loaded for Delhi.');
    });
  });

  it('falls back to a seasonal estimate and the rule-based brief when offline', async () => {
    stubApi({});
    render(
      <AnnouncerProvider>
        <PlanView profile={sample('ayesha')} onEdit={() => undefined} onForget={() => undefined} />
      </AnnouncerProvider>,
    );
    expect(
      await screen.findByText('Live data is unavailable: seasonal estimate.'),
    ).toBeInTheDocument();
    expect(await screen.findByText('Written from your plan’s rules.')).toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveTextContent('Carbon monoxide risk from your heater');
  });

  it('accepts a manual reading and returns to the forecast', async () => {
    const user = userEvent.setup();
    renderPlan();
    await user.click(screen.getByText(/Have a reading from a local monitor/));
    await user.type(screen.getByLabelText('PM2.5 now (µg/m³)'), '300');
    await user.click(screen.getByRole('button', { name: 'Use this reading' }));
    expect(screen.getByText('Using the PM2.5 reading you entered.')).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(/severe/);
    await user.click(screen.getByRole('button', { name: 'Back to the forecast' }));
    expect(
      await screen.findByText('Live forecast: CAMS model via Open-Meteo.'),
    ).toBeInTheDocument();
  });

  it('offers edit and forget actions', async () => {
    const user = userEvent.setup();
    const { onEdit, onForget } = renderPlan();
    await user.click(screen.getByText(/Have a reading from a local monitor/));
    await user.click(screen.getByRole('button', { name: 'Edit household details' }));
    await user.click(screen.getByRole('button', { name: 'Forget my data' }));
    expect(onEdit).toHaveBeenCalled();
    expect(onForget).toHaveBeenCalled();
  });

  it('reads the brief aloud when speech is available', async () => {
    const speakSpy = vi.fn();
    const cancel = vi.fn();
    vi.stubGlobal('speechSynthesis', { speak: speakSpy, cancel });
    vi.stubGlobal(
      'SpeechSynthesisUtterance',
      class {
        lang = '';
        onend: (() => void) | null = null;
        onerror: (() => void) | null = null;
        constructor(readonly text: string) {}
      },
    );
    const user = userEvent.setup();
    renderPlan();
    const listen = await screen.findByRole('button', { name: 'Listen' });
    await user.click(listen);
    expect(speakSpy).toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Stop reading' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    await user.click(screen.getByRole('button', { name: 'Stop reading' }));
    expect(cancel).toHaveBeenCalled();
    (speakSpy.mock.calls[0]?.[0] as { onend: () => void }).onend();
  });

  it('has no axe violations', async () => {
    const { container } = renderPlan();
    await screen.findByRole('heading', { name: BRIEF.headline });
    await expectAccessible(container);
  });
});

describe('PlanView — Home air and Swaps', () => {
  it('toggling a hack or swap recomputes the dose and announces it (AC8)', async () => {
    const user = userEvent.setup();
    renderPlan();
    await user.click(screen.getByRole('tab', { name: 'Home air' }));
    expect(screen.getByText(/This room needs a clean-air delivery rate/)).toBeInTheDocument();
    const before = screen.getByRole('meter').getAttribute('value');
    const purifier = screen.getAllByRole('checkbox', { name: 'Include in my plan' })[1]!;
    await user.click(purifier);
    expect(purifier).toBeChecked();
    expect(screen.getByRole('meter').getAttribute('value')).not.toBe(before);
    await waitFor(() => {
      expect(screen.getByTestId('announcer')).toHaveTextContent(/less PM2.5 breathed in today/);
    });
    await user.click(purifier);
    expect(purifier).not.toBeChecked();

    await user.click(screen.getByRole('tab', { name: 'Swaps & impact' }));
    const metro = screen
      .getAllByRole('listitem')
      .find((li) => within(li).queryByRole('heading', { name: 'Take the metro' }))!;
    const box = within(metro).getByRole('checkbox', { name: 'Try this in my plan' });
    await user.click(box);
    expect(box).toBeChecked();
    expect(within(metro).getByText(/less for you to breathe/)).toBeInTheDocument();
    await user.click(box);
    expect(box).not.toBeChecked();
  });

  it('shows each purifier verdict and honest trade-offs', async () => {
    const user = userEvent.setup();
    const { unmount } = renderPlan(sample('rohit'));
    await user.click(screen.getByRole('tab', { name: 'Home air' }));
    expect(screen.getByText(/Yours covers 62%/)).toBeInTheDocument();
    await user.click(screen.getByRole('tab', { name: 'Swaps & impact' }));
    expect(screen.getByText(/Trade-off: Uses about 1 kg more grid CO₂/)).toBeInTheDocument();
    expect(screen.getAllByText('CO₂: biogenic, not counted').length).toBeGreaterThan(0);
    unmount();
    renderPlan(sample('chen'));
    await user.click(screen.getByRole('tab', { name: 'Home air' }));
    expect(screen.getByText(/Yours is big enough/)).toBeInTheDocument();
    await user.click(screen.getByRole('tab', { name: 'Swaps & impact' }));
    expect(screen.getByText(/already low-emission/)).toBeInTheDocument();
  });

  it('labels an undersized purifier', async () => {
    const profile = sample('rohit');
    profile.lifestyle.home.roomM2 = 40;
    const user = userEvent.setup();
    renderPlan(profile);
    await user.click(screen.getByRole('tab', { name: 'Home air' }));
    expect(screen.getByText(/too small to keep up/)).toBeInTheDocument();
  });

  it('has no axe violations on Home air and Swaps', async () => {
    const user = userEvent.setup();
    const { container } = renderPlan(sample('rohit'));
    await user.click(screen.getByRole('tab', { name: 'Home air' }));
    await expectAccessible(container);
    await user.click(screen.getByRole('tab', { name: 'Swaps & impact' }));
    await expectAccessible(container);
  });
});

describe('PlanView — Community and Ask (lazy)', () => {
  it('scales impact with households and prints a notice', async () => {
    const print = vi.fn();
    window.print = print;
    const user = userEvent.setup();
    renderPlan(sample('rohit'));
    await user.click(screen.getByRole('tab', { name: 'Community' }));
    const field = await screen.findByLabelText('Households taking part');
    expect(screen.getByText(/all the swaps suggested/)).toBeInTheDocument();
    fireEvent.change(field, { target: { value: '120' } });
    expect(screen.getByText(/Each month, 120 households/)).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Start a carpool board' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Print a notice for your noticeboard' }));
    expect(print).toHaveBeenCalled();
  });

  it('uses only ticked swaps once the household picks some', async () => {
    const user = userEvent.setup();
    renderPlan(sample('rohit'));
    await user.click(screen.getByRole('tab', { name: 'Swaps & impact' }));
    await user.click(screen.getAllByRole('checkbox', { name: 'Try this in my plan' })[0]!);
    await user.click(screen.getByRole('tab', { name: 'Community' }));
    expect(await screen.findByText(/the swaps you ticked/)).toBeInTheDocument();
  });

  it('answers a question, in Hindi too, and offers follow-ups', async () => {
    const user = userEvent.setup();
    const reply = {
      answer: 'Walk indoors this evening.',
      citedRuleIds: ['R09'],
      followUps: ['What about tomorrow?'],
      source: 'gemini',
    };
    renderPlan(sample('sharma'), { '/api/ask': reply });
    await user.click(screen.getByRole('tab', { name: 'Ask Smogwise' }));
    const question = await screen.findByLabelText('Your question');
    await user.click(screen.getByRole('button', { name: 'Ask' }));
    expect(screen.getByText('Type a question first.')).toBeInTheDocument();
    expect(question).toHaveAttribute('aria-invalid', 'true');
    await user.type(question, 'Can my mother walk tonight?');
    await user.selectOptions(screen.getByLabelText('Answer in'), 'hi');
    await user.click(screen.getByRole('button', { name: 'Ask' }));
    expect(await screen.findByText('Walk indoors this evening.')).toHaveAttribute('lang', 'hi');
    expect(screen.getByText(/Based on rules R09/)).toBeInTheDocument();
    // Changing the picker afterwards must not re-label the answer already shown.
    await user.selectOptions(screen.getByLabelText('Answer in'), 'en');
    expect(screen.getByText('Walk indoors this evening.')).toHaveAttribute('lang', 'hi');
    await user.click(screen.getByRole('button', { name: 'What about tomorrow?' }));
    await waitFor(() => {
      expect(screen.getByTestId('announcer')).toHaveTextContent('Answer ready.');
    });
  });

  it('answers offline from the rules, and red flags with the safety text', async () => {
    const user = userEvent.setup();
    renderPlan(sample('sharma'), { '/api/ask': () => new Response('down', { status: 503 }) });
    await user.click(screen.getByRole('tab', { name: 'Ask Smogwise' }));
    await user.click(
      await screen.findByRole('button', { name: 'Do I need a mask on my commute?' }),
    );
    expect(await screen.findByText(/Answered from your plan’s rules/)).toBeInTheDocument();
    await user.clear(screen.getByLabelText('Your question'));
    await user.type(screen.getByLabelText('Your question'), 'She has chest pain');
    await user.click(screen.getByRole('button', { name: 'Ask' }));
    expect(await screen.findByText(/Safety answer/)).toBeInTheDocument();
  });

  it('has no axe violations on Community and Ask', async () => {
    const user = userEvent.setup();
    const { container } = renderPlan(sample('rohit'));
    await user.click(screen.getByRole('tab', { name: 'Community' }));
    await screen.findByLabelText('Households taking part');
    await expectAccessible(container);
    await user.click(screen.getByRole('tab', { name: 'Ask Smogwise' }));
    await screen.findByLabelText('Your question');
    await expectAccessible(container);
  });
});
