/** Community: scaled impact of the household's swaps, local actions and a printable notice (F5). */
import { useState } from 'preact/hooks';

import { formatGrams, scaleImpact } from '../../../shared/engine/community.js';
import type { Plan, Swap } from '../../../shared/engine/types.js';
import type { Location } from '../../../shared/schema/profile.js';
import { NumberField } from '../../components/Fields.js';
import { formatInt } from '../../lib/labels.js';
import { swapIsOn } from '../../../shared/engine/whatIf.js';

interface CommunityPanelProps {
  plan: Plan;
  location: Location;
}

const DEFAULT_HOUSEHOLDS = 50;
const MAX_HOUSEHOLDS = 1000;

/** How much a group of households would save each month. */
function ScaledImpact({ swaps }: { swaps: readonly Swap[] }) {
  const [households, setHouseholds] = useState(DEFAULT_HOUSEHOLDS);
  const impact = scaleImpact(swaps, households);
  return (
    <section class="panel no-print" aria-labelledby="scale-title">
      <h3 id="scale-title">If more households joined in</h3>
      <NumberField
        id="households"
        label="Households taking part"
        value={households}
        min={1}
        max={MAX_HOUSEHOLDS}
        onChange={setHouseholds}
      />
      <p aria-live="polite">
        Each month, {formatInt(households)} households would keep about{' '}
        <strong>{formatGrams(impact.pm25GMonth)} of PM2.5</strong> and{' '}
        <strong>{formatInt(impact.co2KgMonth)} kg of CO₂</strong> out of the air — the CO₂ that
        about {formatInt(impact.treeYears)} trees take up in a year (approximate).
      </p>
    </section>
  );
}

/** Community actions; printed on their own as a noticeboard notice. */
function ActionSheet({ plan, location }: CommunityPanelProps) {
  return (
    <section class="panel print-sheet" aria-labelledby="actions-title">
      <h3 id="actions-title" class="print-only">
        Cleaner air for our neighbourhood, {location.name}
      </h3>
      <h3 class="no-print" aria-hidden="true">
        What to do together
      </h3>
      <ul class="cards">
        {plan.community.map((action) => (
          <li key={action.id}>
            <h4>{action.title}</h4>
            <p>{action.detail}</p>
          </li>
        ))}
      </ul>
      <p class="print-only">
        Today: PM2.5 {plan.air.pm25} µg/m³ ({plan.air.band.label}). Plan made with Smogwise, using
        public air-quality forecasts.
      </p>
    </section>
  );
}

export function CommunityPanel({ plan, location }: CommunityPanelProps) {
  const chosen = plan.swaps.filter((s) => swapIsOn(s.choice, plan.choices));
  const basis =
    chosen.length > 0 ? 'the swaps you ticked' : 'all the swaps suggested for your household';
  return (
    <>
      <h2>Clean air is a group effort</h2>
      <p>
        Smog is shared air. Here is what your building, lane or school could change together, based
        on {basis}.
      </p>
      <ScaledImpact swaps={chosen.length > 0 ? chosen : plan.swaps} />
      <ActionSheet plan={plan} location={location} />
      <button
        class="button no-print"
        type="button"
        onClick={() => {
          window.print();
        }}
      >
        Print a notice for your noticeboard
      </button>
    </>
  );
}
