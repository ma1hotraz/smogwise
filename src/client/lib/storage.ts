/**
 * Browser storage (docs/05 "Client storage"): the profile lives only in localStorage and is
 * zod-validated on every read; tampered or outdated data is discarded, never trusted.
 */
import * as z from 'zod/mini';

import { AirData } from '../../shared/schema/air.js';
import { Profile } from '../../shared/schema/profile.js';

const PROFILE_ITEM = 'smogwise.profile.v1';
const PREFS_ITEM = 'smogwise.prefs.v1';
const AIR_ITEM_PREFIX = 'smogwise.air.';
const AIR_MAX_AGE_MS = 30 * 60_000;

export const Prefs = z.object({
  theme: z.enum(['system', 'light', 'dark']),
  textSize: z.enum(['100', '115', '130']),
});
export type Prefs = z.infer<typeof Prefs>;
export const DEFAULT_PREFS: Prefs = { theme: 'system', textSize: '100' };

const CachedAir = z.object({ savedAt: z.number(), air: AirData });

function read(storage: Storage, key: string): unknown {
  try {
    const raw = storage.getItem(key);
    return raw === null ? null : (JSON.parse(raw) as unknown);
  } catch {
    return null;
  }
}

function write(storage: Storage, key: string, value: unknown): void {
  try {
    storage.setItem(key, JSON.stringify(value));
  } catch {
    // Storage full or disabled (private mode): the app keeps working without persistence.
  }
}

/** The saved profile, or null when missing or invalid. */
export function loadProfile(): Profile | null {
  const parsed = Profile.safeParse(read(localStorage, PROFILE_ITEM));
  return parsed.success ? parsed.data : null;
}

export function saveProfile(profile: Profile): void {
  write(localStorage, PROFILE_ITEM, profile);
}

export function loadPrefs(): Prefs {
  const parsed = Prefs.safeParse(read(localStorage, PREFS_ITEM));
  return parsed.success ? parsed.data : DEFAULT_PREFS;
}

export function savePrefs(prefs: Prefs): void {
  write(localStorage, PREFS_ITEM, prefs);
}

const airKey = (lat: number, lon: number): string => `${AIR_ITEM_PREFIX}${lat},${lon}`;

/** Live air data cached for this tab for 30 minutes per 0.1° cell. */
export function loadCachedAir(lat: number, lon: number, now: number): AirData | null {
  const parsed = CachedAir.safeParse(read(sessionStorage, airKey(lat, lon)));
  return parsed.success && now - parsed.data.savedAt < AIR_MAX_AGE_MS ? parsed.data.air : null;
}

export function saveCachedAir(lat: number, lon: number, air: AirData, now: number): void {
  write(sessionStorage, airKey(lat, lon), { savedAt: now, air });
}

/** "Forget my data": removes everything Smogwise stored in this browser. */
export function forgetEverything(): void {
  for (const storage of [localStorage, sessionStorage]) {
    for (const key of Object.keys(storage)) {
      if (key.startsWith('smogwise.')) {
        storage.removeItem(key);
      }
    }
  }
}
