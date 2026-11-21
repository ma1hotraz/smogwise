// @vitest-environment jsdom
import { fireEvent, render, screen } from '@testing-library/preact';
import userEvent from '@testing-library/user-event';
import { useState } from 'preact/hooks';
import { describe, expect, it, vi } from 'vitest';

import { BandChip, HourStrip } from '../../src/client/components/AirVisuals.js';
import { CheckField, NumberField, SelectField } from '../../src/client/components/Fields.js';
import { AlertList, DoseMeter } from '../../src/client/components/PlanBits.js';
import { Tabs } from '../../src/client/components/Tabs.js';
import { expectNoViolations } from '../helpers/a11y.js';
import { WINTER_DAY } from '../helpers/fixtures.js';

const TABS = [
  { id: 'a', label: 'First' },
  { id: 'b', label: 'Second' },
  { id: 'c', label: 'Third' },
];

function TabsHarness() {
  const [active, setActive] = useState('a');
  return (
    <Tabs label="Sections" tabs={TABS} active={active} onChange={setActive}>
      <p>Panel {active}</p>
    </Tabs>
  );
}

describe('Tabs', () => {
  it('follows the WAI-ARIA tabs pattern with arrow, Home and End keys', async () => {
    const user = userEvent.setup();
    render(<TabsHarness />);
    const first = screen.getByRole('tab', { name: 'First' });
    expect(first).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('tabpanel')).toHaveAttribute('aria-labelledby', 'tab-a');
    first.focus();
    await user.keyboard('{ArrowRight}');
    expect(screen.getByRole('tab', { name: 'Second' })).toHaveFocus();
    expect(screen.getByText('Panel b')).toBeInTheDocument();
    await user.keyboard('{End}');
    expect(screen.getByRole('tab', { name: 'Third' })).toHaveAttribute('aria-selected', 'true');
    await user.keyboard('{ArrowRight}');
    expect(screen.getByRole('tab', { name: 'First' })).toHaveFocus();
    await user.keyboard('{ArrowLeft}{Home}');
    expect(screen.getByRole('tab', { name: 'First' })).toHaveAttribute('tabindex', '0');
    await user.keyboard('x');
    await user.click(screen.getByRole('tab', { name: 'Second' }));
    expect(screen.getByText('Panel b')).toBeInTheDocument();
  });

  it('has no axe violations', async () => {
    await expectNoViolations(() => <TabsHarness />);
  });
});

describe('Fields', () => {
  it('clamps numbers to their range and handles junk', () => {
    const onChange = vi.fn<(value: number) => void>();
    render(
      <NumberField
        id="n"
        label="Adults"
        unit="people"
        hint="Over 18"
        value={2}
        min={0}
        max={12}
        onChange={onChange}
      />,
    );
    const input = screen.getByLabelText(/Adults/);
    expect(input).toHaveAccessibleDescription('Over 18');
    fireEvent.change(input, { target: { value: '99' } });
    fireEvent.change(input, { target: { value: '' } });
    fireEvent.change(input, { target: { value: '-4' } });
    expect(onChange.mock.calls.map((c) => c[0])).toEqual([12, 0, 0]);
  });

  it('selects only listed options and toggles checkboxes', async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    const onCheck = vi.fn();
    render(
      <>
        <SelectField
          id="s"
          label="Fuel"
          value="a"
          options={[
            { value: 'a', label: 'A' },
            { value: 'b', label: 'B' },
          ]}
          onChange={onSelect}
        />
        <CheckField id="c" checked={false} onChange={onCheck}>
          Smokes indoors
        </CheckField>
      </>,
    );
    await user.selectOptions(screen.getByLabelText('Fuel'), 'b');
    await user.click(screen.getByLabelText('Smokes indoors'));
    expect(onSelect).toHaveBeenCalledWith('b');
    expect(onCheck).toHaveBeenCalledWith(true);
  });

  it('has no axe violations', async () => {
    await expectNoViolations(() => (
      <form>
        <NumberField id="n" label="Room" value={16} min={6} max={100} onChange={() => undefined} />
        <SelectField
          id="s"
          label="Fuel"
          hint="Most used"
          value="a"
          options={[{ value: 'a', label: 'A' }]}
          onChange={() => undefined}
        />
        <CheckField id="c" checked onChange={() => undefined}>
          Candles
        </CheckField>
      </form>
    ));
  });
});

describe('air visuals', () => {
  it('shows a label and a distinct shape for each band', () => {
    const { container } = render(
      <>
        {([0, 1, 2, 3, 4, 5] as const).map((level) => (
          <BandChip key={level} band={{ level, label: `Level ${level}` }} />
        ))}
      </>,
    );
    const shapes = new Set([...container.querySelectorAll('path')].map((p) => p.getAttribute('d')));
    expect(shapes.size).toBe(6);
    expect(screen.getByText('Level 3')).toBeInTheDocument();
  });

  it('summarises the strip and offers an equivalent table', async () => {
    const user = userEvent.setup();
    render(
      <HourStrip
        day={WINTER_DAY}
        scale="NAQI"
        nowHour={10}
        clean={{ startHour: 14, hours: 2, meanPm25: 88 }}
      />,
    );
    expect(screen.getByRole('img')).toHaveAccessibleName(
      /ranges from 86 to 180 µg\/m³\. Cleanest 14:00 to 16:00/,
    );
    const toggle = screen.getByRole('button', { name: 'Show as table' });
    expect(screen.queryByRole('table')).toBeNull();
    await user.click(toggle);
    expect(toggle).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getAllByRole('row')).toHaveLength(25);
    expect(screen.getByRole('rowheader', { name: '14:00' })).toBeInTheDocument();
  });

  it('omits a clean window that has already passed', () => {
    render(
      <HourStrip
        day={WINTER_DAY}
        scale="US_AQI"
        nowHour={20}
        clean={{ startHour: 13, hours: 2, meanPm25: 88 }}
      />,
    );
    expect(screen.getByRole('img').getAttribute('aria-label')).not.toMatch(/Cleanest/);
  });

  it('has no axe violations', async () => {
    await expectNoViolations(() => (
      <>
        <BandChip band={{ level: 4, label: 'Very Poor' }} />
        <HourStrip day={WINTER_DAY} scale="NAQI" nowHour={10} clean={null} />
      </>
    ));
  });
});

describe('plan bits', () => {
  const dose = (totalUg: number, cigarettes: number) => ({
    totalUg,
    volumeM3: 12,
    cigarettes,
    byPlace: { sleep: 0, home: 0, work: 0, commute: 0, exercise: 0 },
  });

  it('announces danger alerts and labels the rule', () => {
    render(
      <AlertList
        alerts={[
          {
            level: 'danger',
            title: 'Carbon monoxide risk',
            detail: 'Never sleep with it lit.',
            ruleId: 'AL01',
          },
          { level: 'info', title: 'Estimated', detail: 'Rough.', ruleId: 'AL06' },
        ]}
      />,
    );
    expect(screen.getByRole('alert')).toHaveTextContent('Carbon monoxide risk');
    expect(screen.getByText('(AL06)')).toBeInTheDocument();
  });

  it('renders nothing without alerts', () => {
    const { container } = render(<AlertList alerts={[]} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('shows usual vs plan dose with a labelled meter', () => {
    const { rerender } = render(
      <DoseMeter usual={dose(1200, 5)} withPlan={dose(600, 2.5)} reductionPct={50} />,
    );
    expect(screen.getByRole('meter', { name: '50% less PM2.5 breathed in' })).toBeInTheDocument();
    expect(screen.getByText('1,200 µg')).toBeInTheDocument();
    rerender(<DoseMeter usual={dose(600, 2.5)} withPlan={dose(660, 2.8)} reductionPct={-10} />);
    expect(screen.getByText('10% more PM2.5 breathed in')).toBeInTheDocument();
    rerender(<DoseMeter usual={dose(600, 2.5)} withPlan={dose(600, 2.5)} reductionPct={0} />);
    expect(screen.getByText('No change yet')).toBeInTheDocument();
  });

  it('has no axe violations', async () => {
    await expectNoViolations(() => (
      <>
        <AlertList
          alerts={[
            {
              level: 'warning',
              title: 'Higher risk',
              detail: 'Limit time outdoors.',
              ruleId: 'AL02',
            },
          ]}
        />
        <DoseMeter usual={dose(1200, 5)} withPlan={dose(600, 2.5)} reductionPct={50} />
      </>
    ));
  });
});
