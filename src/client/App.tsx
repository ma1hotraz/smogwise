/** App shell: skip link, masthead with preferences, intake or plan, footer. */
import { SelectField } from './components/Fields.js';
import { IntakeForm } from './features/intake/IntakeForm.js';
import { lazyComponent } from './lib/lazy.js';
import { usePrefs } from './lib/prefs.js';
import { type Prefs, TEXT_SIZES, THEMES } from './lib/storage.js';
import { useAppModel } from './useAppModel.js';

/** The plan view carries the decision engine; it is a separate chunk prefetched from main.tsx. */
export const loadPlanView = () => import('./features/plan/PlanView.js').then((m) => m.PlanView);
const PlanView = lazyComponent(loadPlanView);

const THEME_LABELS: Record<Prefs['theme'], string> = {
  system: 'Match device',
  light: 'Light',
  dark: 'Dark',
};
const THEME_OPTIONS = THEMES.map((value) => ({ value, label: THEME_LABELS[value] }));

const TEXT_SIZE_LABELS: Record<Prefs['textSize'], string> = {
  '100': 'Standard',
  '115': 'Large',
  '130': 'Larger',
};
const TEXT_SIZE_OPTIONS = TEXT_SIZES.map((value) => ({ value, label: TEXT_SIZE_LABELS[value] }));

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

/** Data sources and the privacy promise. */
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
  const [prefs, setPrefs] = usePrefs();
  const { profile, view, moved, submit, edit, forget } = useAppModel();
  return (
    <div class="shell">
      <a class="skip-link" href="#main">
        Skip to content
      </a>
      <Masthead prefs={prefs} onPrefs={setPrefs} />
      <main id="main" tabIndex={-1}>
        {view === 'plan' && profile ? (
          <PlanView profile={profile} focusHeading={moved} onEdit={edit} onForget={forget} />
        ) : (
          <IntakeForm initial={profile} focusHeading={moved} onSubmit={submit} />
        )}
      </main>
      <Footer />
    </div>
  );
}
