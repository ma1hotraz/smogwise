/** Today: the hour strip, safety alerts, dose, the AI brief and the time-slotted routine (F2). */
import { useEffect, useState } from 'preact/hooks';

import type { Plan } from '../../../shared/engine/types.js';
import type { AiContext, BriefResponse } from '../../../shared/schema/ai.js';
import { formatHour } from '../../../shared/time.js';
import { HourStrip } from '../../components/AirVisuals.js';
import { AlertList, DoseMeter } from '../../components/PlanBits.js';
import { requestBrief } from '../../lib/api.js';
import { canSpeak, speak, stopSpeaking } from '../../lib/speech.js';

/** The AI brief. It waits until live data has arrived, so one visit costs one model call. */
function Brief({ context, ready }: { context: AiContext; ready: boolean }) {
  const [brief, setBrief] = useState<BriefResponse | null>(null);
  const [speaking, setSpeaking] = useState(false);
  const key = JSON.stringify(context);
  useEffect(() => {
    if (!ready) {
      return undefined;
    }
    const controller = new AbortController();
    void requestBrief(JSON.parse(key) as AiContext, controller.signal).then((next) => {
      if (!controller.signal.aborted) {
        setBrief(next);
      }
    });
    return () => {
      controller.abort();
    };
  }, [key, ready]);
  if (!brief) {
    return <p class="hint">Writing today’s brief…</p>;
  }
  const toggle = (): void => {
    if (speaking) {
      stopSpeaking();
      setSpeaking(false);
      return;
    }
    setSpeaking(true);
    speak(`${brief.headline}. ${brief.summary}`, 'en-IN', () => {
      setSpeaking(false);
    });
  };
  return (
    <section class="panel" aria-labelledby="brief-title">
      <h2 id="brief-title">{brief.headline}</h2>
      <p>{brief.summary}</p>
      <p class="status-line">
        <span>
          {brief.source === 'gemini'
            ? 'Written by Gemini from your plan’s figures.'
            : 'Written from your plan’s rules.'}
        </span>
        {canSpeak() ? (
          <button
            class="button button-quiet button-small"
            type="button"
            aria-pressed={speaking}
            onClick={toggle}
          >
            {speaking ? 'Stop reading' : 'Listen'}
          </button>
        ) : null}
      </p>
    </section>
  );
}

interface TodayPanelProps {
  plan: Plan;
  context: AiContext;
  /** False while live air data is still loading. */
  ready: boolean;
}

export function TodayPanel({ plan, context, ready }: TodayPanelProps) {
  return (
    <>
      <h2 class="visually-hidden">Today</h2>
      <section class="panel">
        <HourStrip
          day={plan.air.day}
          scale={plan.air.scale}
          nowHour={plan.air.nowHour}
          clean={plan.windows.clean}
        />
      </section>
      <AlertList alerts={plan.alerts} />
      <Brief context={context} ready={ready} />
      <DoseMeter {...plan.exposure} />
      <section aria-labelledby="routine-title">
        <h2 id="routine-title">Your low-emission day</h2>
        <ol class="timeline">
          {plan.routine.map((step) => (
            <li key={`${step.ruleId}-${step.hour}`}>
              <time>{formatHour(step.hour)}</time>
              <div>
                <h3>{step.title}</h3>
                <p>{step.detail}</p>
                {step.impact ? <p class="impact">{step.impact}</p> : null}
                <p class="rule">Why: rule {step.ruleId}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>
      <p class="hint">
        Smogwise gives general guidance, not medical advice. Follow your doctor’s plan for any
        condition.
      </p>
    </>
  );
}
