/** App shell: skip link, masthead with preferences, intake or plan, footer. */
import { useState } from 'preact/hooks';

import type { Profile } from '../shared/schema/profile.js';
import { SelectField } from './components/Fields.js';
import { IntakeForm } from './features/intake/IntakeForm.js';
import { useAnnounce } from './lib/announcer.js';
import { lazyComponent } from './lib/lazy.js';
import { usePrefs } from './lib/prefs.js';
import { forgetEverything, loadProfile, type Prefs, saveProfile } from './lib/storage.js';

/** The plan view carries the decision engine; it is a separate chunk prefetched from main.tsx. */
export const loadPlanView = () => import('./features/plan/PlanView.js').then((m) => m.PlanView);
const PlanView = lazyComponent(loadPlanView);

const THEME_OPTIONS = [
  { value: 'system', label: 'Match device' },
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
] as const;

const TEXT_SIZE_OPTIONS = [
  { value: '100', label: 'Standard' },
  { value: '115', label: 'Large' },
  { value: '130', label: 'Larger' },
] as const;

/** Brand and display preferences (theme, text size). */
function Masthead({ prefs, onPrefs }: { prefs: Prefs; onPrefs: (next: Prefs) => void }) {
  return (
    <header class="masthead">
      <a class="brand" href="/">
        Smogwise <small>clean air through smog season</small>
      </a>
      <div class="prefs">
        <SelectField
          id="theme"
          label="Theme"
          value={prefs.theme}
          options={THEME_OPTIONS}
          onChange={(theme) => {
            onPrefs({ ...prefs, theme });
          }}
        />
        <SelectField
          id="text-size"
          label="Text size"
          value={prefs.textSize}
          options={TEXT_SIZE_OPTIONS}
          onChange={(textSize) => {
            onPrefs({ ...prefs, textSize });
          }}
        />
      </div>
    </header>
  );
}

function Footer() {
  return (
    <footer class="footer">
      <p>
        Air data: CAMS forecasts via Open-Meteo. Estimates use published emission and exposure
        factors; they are for comparing choices, not medical advice. Your details never leave this
        browser.
      </p>
    </footer>
  );
}

export function App() {
  const [profile, setProfile] = useState<Profile | null>(loadProfile);
  const [editing, setEditing] = useState(false);
  const [prefs, setPrefs] = usePrefs();
  const announce = useAnnounce();
  // After navigation, the new view focuses its heading so keyboard and screen-reader users land in context.
  const [moved, setMoved] = useState(false);
  const view = profile && !editing ? 'plan' : 'intake';

  const submit = (next: Profile): void => {
    saveProfile(next);
    setProfile(next);
    setEditing(false);
    setMoved(true);
    announce(`Your plan for ${next.location.name} is ready.`);
  };

  return (
    <div class="shell">
      <a class="skip-link" href="#main">
        Skip to content
      </a>
      <Masthead prefs={prefs} onPrefs={setPrefs} />
      <main id="main" tabIndex={-1}>
        {view === 'plan' && profile ? (
          <PlanView
            profile={profile}
            focusHeading={moved}
            onEdit={() => {
              setEditing(true);
              setMoved(true);
            }}
            onForget={() => {
              forgetEverything();
              setProfile(null);
              setMoved(true);
              announce('Your saved details were removed from this browser.');
            }}
          />
        ) : (
          <IntakeForm initial={profile} focusHeading={moved} onSubmit={submit} />
        )}
      </main>
      <Footer />
    </div>
  );
}
