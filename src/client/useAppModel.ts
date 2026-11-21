/** View model for the app shell: the saved profile, which view is showing and focus hand-off. */
import { useState } from 'preact/hooks';

import type { Profile } from '../shared/schema/profile.js';
import { useAnnounce } from './lib/announcer.js';
import { forgetEverything, loadProfile, saveProfile } from './lib/storage.js';

interface AppModel {
  profile: Profile | null;
  view: 'intake' | 'plan';
  /** True after navigation, so the new view focuses its heading for keyboard and screen-reader users. */
  moved: boolean;
  submit: (next: Profile) => void;
  edit: () => void;
  forget: () => void;
}

/** Owns the profile (persisted in this browser), navigation and the matching announcements. */
export function useAppModel(): AppModel {
  const [profile, setProfile] = useState<Profile | null>(loadProfile);
  const [editing, setEditing] = useState(false);
  const [moved, setMoved] = useState(false);
  const announce = useAnnounce();
  return {
    profile,
    view: profile && !editing ? 'plan' : 'intake',
    moved,
    submit: (next) => {
      saveProfile(next);
      setProfile(next);
      setEditing(false);
      setMoved(true);
      announce(`Your plan for ${next.location.name} is ready.`);
    },
    edit: () => {
      setEditing(true);
      setMoved(true);
    },
    forget: () => {
      forgetEverything();
      setProfile(null);
      setMoved(true);
      announce('Your saved details were removed from this browser.');
    },
  };
}
