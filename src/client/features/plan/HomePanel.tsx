/** Home air: modelled indoor PM2.5, purifier verdict and ranked hacks with what-if toggles (F3). */
import type { Choices, Cost, Plan, PurifierVerdict } from '../../../shared/engine/types.js';
import { CheckField } from '../../components/Fields.js';
import { DoseMeter } from '../../components/PlanBits.js';
import { hackIsOn, toggleHack } from '../../../shared/engine/whatIf.js';

const COST: Record<Cost, string> = {
  free: 'Free',
  low: 'Low cost',
  medium: 'Costs more',
  none: '',
};

function purifierText(verdict: PurifierVerdict): string {
  const need = `This room needs a clean-air delivery rate (CADR) of about ${verdict.requiredCadr} m³/h.`;
  switch (verdict.status) {
    case 'none':
      return `${need} You have no purifier yet; see the first fixes below.`;
    case 'undersized':
      return `${need} Yours covers ${Math.round(verdict.coverage * 100)}% of that — too small to keep up.`;
    case 'adequate':
      return `${need} Yours covers ${Math.round(verdict.coverage * 100)}%: it helps, especially with the door shut.`;
    case 'good':
      return `${need} Yours is big enough. Run it with doors and windows shut.`;
  }
}

interface PanelProps {
  plan: Plan;
  choices: Choices;
  onChoices: (next: Choices) => void;
}

export function HomePanel({ plan, choices, onChoices }: PanelProps) {
  const { indoor } = plan;
  return (
    <>
      <h2>Cleaner air at home</h2>
      <p>
        On today’s average outdoor level ({plan.air.dayMeanPm25} µg/m³), your main room sits at
        about <strong>{indoor.homePm25} µg/m³</strong> indoors. Outdoor smog alone would give about{' '}
        {Math.round(indoor.ratio * 100)}% of the outdoor level; the rest comes from indoor sources.
      </p>
      <p>{purifierText(indoor.purifier)}</p>
      <ul class="cards">
        {indoor.hacks.map((hack) => (
          <li key={hack.id}>
            <h3>{hack.title}</h3>
            <p id={`hack-${hack.id}-detail`}>{hack.detail}</p>
            <ul class="figures">
              {hack.reductionPct !== null ? (
                <li>
                  <strong>−{hack.reductionPct}%</strong> indoor PM2.5
                </li>
              ) : null}
              {hack.cost === 'none' ? null : <li>{COST[hack.cost]}</li>}
              <li class="rule">Rule {hack.ruleId}</li>
            </ul>
            {hack.choice ? (
              <CheckField
                id={`hack-${hack.id}`}
                checked={hackIsOn(hack.choice, plan.choices)}
                describedById={`hack-${hack.id}-detail`}
                onChange={(on) => {
                  if (hack.choice) {
                    onChoices(toggleHack(hack.choice, choices, plan.choices, on));
                  }
                }}
              >
                Include in my plan
              </CheckField>
            ) : null}
          </li>
        ))}
      </ul>
      <DoseMeter {...plan.exposure} />
    </>
  );
}
