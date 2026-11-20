/** Community: scaled impact of the household's swaps, local actions and a printable notice (F5). */
import { useState } from 'preact/hooks';

import { formatGrams, scaleImpact } from '../../../shared/engine/community.js';
import type { Plan } from '../../../shared/engine/types.js';
import type { Location } from '../../../shared/schema/profile.js';
import { NumberField } from '../../components/Fields.js';
import { formatInt } from '../../lib/labels.js';
import { swapIsOn } from '../../lib/whatIf.js';

interface CommunityPanelProps {
  plan: Plan;
  location: Location;
}

export function CommunityPanel({ plan, location }: CommunityPanelProps) {
  const [households, setHouseholds] = useState(50);
  const chosen = plan.swaps.filter((s) => swapIsOn(s.choice, plan.choices));
  const swaps = chosen.length > 0 ? chosen : plan.swaps;
  const impact = scaleImpact(swaps, households);
  const basis =
    chosen.length > 0 ? 'the swaps you ticked' : 'all the swaps suggested for your household';
  return (
    <>
      <h2>Clean air is a group effort</h2>
      <p>
        Smog is shared air. Here is what your building, lane or school could change together, based
        on {basis}.
      </p>
      <section class="panel no-print" aria-labelledby="scale-title">
        <h3 id="scale-title">If more households joined in</h3>
        <NumberField
          id="households"
          label="Households taking part"
          value={households}
          min={1}
          max={1000}
          onChange={setHouseholds}
        />
        <p aria-live="polite">
          Each month, {formatInt(households)} households would keep about{' '}
          <strong>{formatGrams(impact.pm25GMonth)} of PM2.5</strong> and{' '}
          <strong>{formatInt(impact.co2KgMonth)} kg of CO₂</strong> out of the air — the CO₂ that
          about {formatInt(impact.treeYears)} trees take up in a year (approximate).
        </p>
      </section>
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
