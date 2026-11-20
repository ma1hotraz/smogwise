import { render } from 'preact';

import './styles/tokens.css';
import './styles/base.css';
import './styles/print.css';
import { App, loadPlanView } from './App.js';
import { AnnouncerProvider } from './lib/announcer.js';
import { applyPrefs } from './lib/prefs.js';
import { loadPrefs } from './lib/storage.js';

applyPrefs(loadPrefs());

const root = document.getElementById('app');
if (root) {
  render(
    <AnnouncerProvider>
      <App />
    </AnnouncerProvider>,
    root,
  );
}

// Fetch the plan chunk while the visitor reads the intake form, so "Build my day" is instant.
const prefetch = (): void => {
  void loadPlanView();
};
if ('requestIdleCallback' in window) {
  window.requestIdleCallback(prefetch);
} else {
  setTimeout(prefetch, 1500);
}
