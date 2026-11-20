/** The plan: live air summary, then Today / Home air / Swaps / Community / Ask tabs. */
import { useEffect, useMemo, useRef, useState } from 'preact/hooks';

import { buildContext } from '../../../shared/ai/context.js';
import { buildPlan } from '../../../shared/engine/plan.js';
import type { Choices } from '../../../shared/engine/types.js';
import type { Profile } from '../../../shared/schema/profile.js';
import { Tabs } from '../../components/Tabs.js';
import { useAnnounce } from '../../lib/announcer.js';
import { lazyComponent } from '../../lib/lazy.js';
import { useAir } from '../../lib/useAir.js';
import { AirHeader } from './AirHeader.js';
import { HomePanel } from './HomePanel.js';
import { SwapsPanel } from './SwapsPanel.js';
import { TodayPanel } from './TodayPanel.js';

const TABS = [
  { id: 'today', label: 'Today' },
  { id: 'home', label: 'Home air' },
  { id: 'swaps', label: 'Swaps & impact' },
  { id: 'community', label: 'Community' },
  { id: 'ask', label: 'Ask Smogwise' },
] as const;

const CommunityPanel = lazyComponent(() =>
  import('../community/CommunityPanel.js').then((m) => m.CommunityPanel),
);
const AskPanel = lazyComponent(() => import('../ask/AskPanel.js').then((m) => m.AskPanel));

interface PlanViewProps {
  profile: Profile;
  focusHeading?: boolean;
  onEdit: () => void;
  onForget: () => void;
}

export function PlanView({ profile, focusHeading = false, onEdit, onForget }: PlanViewProps) {
  const [manual, setManual] = useState<number | null>(null);
  const [choices, setChoices] = useState<Choices>({});
  const [tab, setTab] = useState<string>('today');
  const { air, status } = useAir(profile.location, manual);
  const plan = useMemo(() => buildPlan(profile, air, new Date(), choices), [profile, air, choices]);
  const context = useMemo(() => buildContext(plan, profile), [plan, profile]);
  const announce = useAnnounce();
  const firstDose = useRef(true);

  useEffect(() => {
    if (status === 'live') {
      announce(`Live air data loaded for ${profile.location.name}.`);
    } else if (status === 'estimated') {
      announce('Live data is unavailable; showing a seasonal estimate.');
    }
  }, [status, announce, profile.location.name]);

  const reduction = plan.exposure.reductionPct;
  useEffect(() => {
    if (firstDose.current) {
      firstDose.current = false;
      return;
    }
    announce(`With your choices: ${reduction}% less PM2.5 breathed in today.`);
  }, [reduction, announce]);

  return (
    <>
      <AirHeader
        focusHeading={focusHeading}
        plan={plan}
        location={profile.location}
        status={status}
        onManual={setManual}
        onEdit={onEdit}
        onForget={onForget}
      />
      <Tabs label="Plan sections" tabs={TABS} active={tab} onChange={setTab}>
        {tab === 'today' ? (
          <TodayPanel plan={plan} context={context} ready={status !== 'loading'} />
        ) : null}
        {tab === 'home' ? <HomePanel plan={plan} choices={choices} onChoices={setChoices} /> : null}
        {tab === 'swaps' ? (
          <SwapsPanel plan={plan} choices={choices} onChoices={setChoices} />
        ) : null}
        {tab === 'community' ? <CommunityPanel plan={plan} location={profile.location} /> : null}
        {tab === 'ask' ? <AskPanel context={context} /> : null}
      </Tabs>
    </>
  );
}
