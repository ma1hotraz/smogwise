/** Home air: modelled indoor PM2.5, purifier verdict and ranked hacks with what-if toggles (F3). */
import { hackIsOn, toggleHack } from '../../../shared/engine/whatIf.js';
import { CheckField } from '../../components/Fields.js';
import { DoseMeter } from '../../components/PlanBits.js';
import { COST_LABELS, percent, purifierText } from '../../lib/labels.js';
import type { PanelProps } from './panelProps.js';

export function HomePanel({ plan, choices, onChoices }: PanelProps) {
  const { indoor } = plan;
  return (
    <>
      <h2>Cleaner air at home</h2>
      <p>
        On today’s average outdoor level ({plan.air.dayMeanPm25} µg/m³), your main room sits at
        about <strong>{indoor.homePm25} µg/m³</strong> indoors. Outdoor smog alone would give about{' '}
        {percent(indoor.ratio)}% of the outdoor level; the rest comes from indoor sources.
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
              {hack.cost === 'none' ? null : <li>{COST_LABELS[hack.cost]}</li>}
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
