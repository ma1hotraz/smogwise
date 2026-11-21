/** The plan: live air summary, then Today / Home air / Swaps / Community / Ask tabs (layout only). */
import type { VNode } from 'preact';
import { useState } from 'preact/hooks';

import type { Profile } from '../../../shared/schema/profile.js';
import { Tabs, type TabItem } from '../../components/Tabs.js';
import { lazyComponent } from '../../lib/lazy.js';
import { AirHeader } from './AirHeader.js';
import { HomePanel } from './HomePanel.js';
import { SwapsPanel } from './SwapsPanel.js';
import { TodayPanel } from './TodayPanel.js';
import { usePlanModel, type PlanModel } from './usePlanModel.js';

const CommunityPanel = lazyComponent(() =>
  import('../community/CommunityPanel.js').then((m) => m.CommunityPanel),
);
const AskPanel = lazyComponent(() => import('../ask/AskPanel.js').then((m) => m.AskPanel));

interface PanelInput {
  model: PlanModel;
  profile: Profile;
}

/** The plan's sections. Adding a tab is one entry: its label and how it renders. */
const TABS: readonly (TabItem & { render: (input: PanelInput) => VNode })[] = [
  {
    id: 'today',
    label: 'Today',
    render: ({ model }) => (
      <TodayPanel plan={model.plan} context={model.context} ready={model.status !== 'loading'} />
    ),
  },
  {
    id: 'home',
    label: 'Home air',
    render: ({ model }) => (
      <HomePanel plan={model.plan} choices={model.choices} onChoices={model.setChoices} />
    ),
  },
  {
    id: 'swaps',
    label: 'Swaps & impact',
    render: ({ model }) => (
      <SwapsPanel plan={model.plan} choices={model.choices} onChoices={model.setChoices} />
    ),
  },
  {
    id: 'community',
    label: 'Community',
    render: ({ model, profile }) => (
      <CommunityPanel plan={model.plan} location={profile.location} />
    ),
  },
  { id: 'ask', label: 'Ask Smogwise', render: ({ model }) => <AskPanel context={model.context} /> },
];

interface PlanViewProps {
  profile: Profile;
  focusHeading?: boolean;
  onEdit: () => void;
  onForget: () => void;
}

export function PlanView({ profile, focusHeading = false, onEdit, onForget }: PlanViewProps) {
  const [tab, setTab] = useState('today');
  const model = usePlanModel(profile);
  const active = TABS.find((t) => t.id === tab) ?? TABS[0];

  return (
    <>
      <AirHeader
        focusHeading={focusHeading}
        plan={model.plan}
        location={profile.location}
        status={model.status}
        onManual={model.setManual}
        onEdit={onEdit}
        onForget={onForget}
      />
      <Tabs label="Plan sections" tabs={TABS} active={tab} onChange={setTab}>
        {active?.render({ model, profile })}
      </Tabs>
    </>
  );
}
