/** Swaps & impact: sustainable alternatives with their direct impact, toggled live (F4). */
import type { Choices, Plan } from '../../../shared/engine/types.js';
import { CheckField } from '../../components/Fields.js';
import { DoseMeter } from '../../components/PlanBits.js';
import { savingText } from '../../lib/labels.js';
import { swapIsOn, toggleSwap } from '../../lib/whatIf.js';

interface PanelProps {
  plan: Plan;
  choices: Choices;
  onChoices: (next: Choices) => void;
}

function doseText(delta: number): string {
  if (delta === 0) {
    return 'same dose for you';
  }
  return delta < 0 ? `${-delta}% less for you to breathe` : `${delta}% more for you to breathe`;
}

export function SwapsPanel({ plan, choices, onChoices }: PanelProps) {
  return (
    <>
      <h2>Swaps and their impact</h2>
      <p>
        Each swap shows what it changes for the city’s air (PM2.5 and CO₂ you no longer emit) and
        for your own lungs. Tick one to see your day change.
      </p>
      <DoseMeter {...plan.exposure} />
      {plan.swaps.length === 0 ? (
        <p>
          Your travel, cooking and heating are already low-emission. See the Community tab for what
          you can do with neighbours.
        </p>
      ) : (
        <ul class="cards">
          {plan.swaps.map((swap) => (
            <li key={swap.id}>
              <h3>{swap.title}</h3>
              <p id={`swap-${swap.id}-detail`}>{swap.detail}</p>
              <ul class="figures">
                <li>
                  <strong>{savingText(swap.pm25GWeek, 'g')}</strong> PM2.5 a week
                </li>
                <li>
                  {swap.co2KgWeek === null ? (
                    'CO₂: biogenic, not counted'
                  ) : (
                    <>
                      <strong>{savingText(swap.co2KgWeek, 'kg')}</strong> CO₂ a week
                    </>
                  )}
                </li>
                <li>{doseText(swap.doseDeltaPct)}</li>
                <li class="rule">Rule {swap.ruleId}</li>
              </ul>
              {swap.tradeOff ? <p class="impact">Trade-off: {swap.tradeOff}</p> : null}
              <CheckField
                id={`swap-${swap.id}`}
                checked={swapIsOn(swap.choice, plan.choices)}
                describedById={`swap-${swap.id}-detail`}
                onChange={(on) => {
                  onChoices(toggleSwap(swap.choice, choices, on));
                }}
              >
                Try this in my plan
              </CheckField>
            </li>
          ))}
        </ul>
      )}
      <p class="hint">
        Figures are estimates from published emission factors; see the README for sources.
      </p>
    </>
  );
}
