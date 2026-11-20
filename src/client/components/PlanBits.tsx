/** Small presentational pieces shared by the plan tabs. */
import type { Alert, Dose } from '../../shared/engine/types.js';
import { formatInt } from '../lib/labels.js';

/** Safety alerts. Danger alerts use role="alert" so they are announced once on arrival. */
export function AlertList({ alerts }: { alerts: readonly Alert[] }) {
  if (alerts.length === 0) {
    return null;
  }
  return (
    <section class="alerts" aria-label="Safety alerts">
      {alerts.map((alert) => (
        <div
          key={alert.ruleId}
          class={`alert alert-${alert.level}`}
          role={alert.level === 'danger' ? 'alert' : undefined}
        >
          <h3>{alert.title}</h3>
          <p>
            {alert.detail} <span class="rule">({alert.ruleId})</span>
          </p>
        </div>
      ))}
    </section>
  );
}

interface DoseMeterProps {
  usual: Dose;
  withPlan: Dose;
  reductionPct: number;
}

/** Usual day vs. Smogwise day: what the household breathes in, as µg and cigarette-equivalents. */
export function DoseMeter({ usual, withPlan, reductionPct }: DoseMeterProps) {
  const change =
    reductionPct > 0
      ? `${reductionPct}% less PM2.5 breathed in`
      : reductionPct < 0
        ? `${-reductionPct}% more PM2.5 breathed in`
        : 'No change yet';
  return (
    <section class="panel dose" aria-labelledby="dose-title">
      <h2 id="dose-title">What you breathe in today</h2>
      <div class="dose-figures">
        <p>
          Your usual day
          <strong>{formatInt(usual.totalUg)} µg</strong>
          <span class="hint">≈ {usual.cigarettes} cigarettes</span>
        </p>
        <p>
          With this plan
          <strong>{formatInt(withPlan.totalUg)} µg</strong>
          <span class="hint">≈ {withPlan.cigarettes} cigarettes</span>
        </p>
      </div>
      <label htmlFor="dose-meter">{change}</label>
      <meter
        id="dose-meter"
        min={0}
        max={Math.max(usual.totalUg, withPlan.totalUg, 1)}
        low={usual.totalUg * 0.6}
        high={usual.totalUg * 0.9}
        optimum={0}
        value={withPlan.totalUg}
      >
        {formatInt(withPlan.totalUg)} µg
      </meter>
      <p class="hint">
        Estimates for one adult on a typical day, from the forecast, your home and your choices. 22
        µg/m³ of PM2.5 over a day ≈ one cigarette (Berkeley Earth).
      </p>
    </section>
  );
}
