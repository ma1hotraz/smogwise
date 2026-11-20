/** The plan: live air summary, then Today / Home air / Swaps / Community / Ask tabs (layout only). */
import { useState } from 'preact/hooks';

import type { Profile } from '../../../shared/schema/profile.js';
import { Tabs } from '../../components/Tabs.js';
import { lazyComponent } from '../../lib/lazy.js';
import { AirHeader } from './AirHeader.js';
import { HomePanel } from './HomePanel.js';
import { SwapsPanel } from './SwapsPanel.js';
import { TodayPanel } from './TodayPanel.js';
import { usePlanModel } from './usePlanModel.js';

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
  const [tab, setTab] = useState<string>('today');
  const { plan, context, status, choices, setChoices, setManual } = usePlanModel(profile);

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
