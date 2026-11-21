/**
 * User-facing wording for rules, kept apart from the logic so rules stay short and the copy can
 * be reviewed in one place: alert, routine and community wording. Hack and swap wording sits with
 * its rule tables in hacks.ts and swaps.ts. Keys are rule ids from docs/03.
 */

export interface Copy {
  title: string;
  detail: string;
}

export const ALERT_COPY = {
  AL01: {
    title: 'Carbon monoxide risk from your heater',
    detail:
      'Braziers (angithi), wood and kerosene heaters give off carbon monoxide, which you cannot see or smell. Never sleep with one burning in a closed room. Keep a window ajar and fit a CO alarm if you can.',
  },
  AL02: {
    title: 'Higher risk for your household today',
    detail: 'With {who} at home, limit time outdoors and avoid effort outside.',
  },
  AL03: {
    title: 'Know the warning signs',
    detail:
      "Follow your doctor's action plan. Get urgent care for breathlessness at rest, chest pain or tightness, blue lips, confusion or fainting.",
  },
  AL04: {
    title: 'Emergency-level smog',
    detail:
      'Everyone should stay indoors, keep windows shut and avoid all physical effort outside.',
  },
  AL05: {
    title: 'Pregnancy: limit time outdoors',
    detail:
      'Fine-particle exposure in pregnancy is linked to low birth weight. Keep trips short and wear an N95 outside.',
  },
  AL06_fallback: {
    title: 'Estimated air data',
    detail:
      'Live data is unavailable, so Smogwise is using a typical winter pattern for your area. Treat the figures as rough.',
  },
  AL06_manual: {
    title: 'Estimated air data',
    detail: 'Smogwise is using the PM2.5 value you entered with a typical winter daily pattern.',
  },
} as const satisfies Record<string, Copy>;

export const ROUTINE_COPY = {
  shutUntil: {
    title: 'Keep windows shut until {time}',
    detail: 'Morning air is about {now} µg/m³; it should ease to about {clean} by then.',
  },
  airFreely: {
    title: 'Open windows and air the home',
    detail: 'The air is fair today, so cross-ventilate freely.',
  },
  shutAllDay: {
    title: 'Keep windows shut all day',
    detail: 'Air only the kitchen, with the exhaust fan on, while you cook.',
  },
  airBurst: {
    title: 'Air the home for {minutes} minutes',
    detail:
      '{span} is the cleanest stretch of the day. A short burst clears cooking fumes and stale air without letting much smog in.',
  },
  exerciseIndoorUsual: {
    title: 'Indoor workout as usual',
    detail: 'Yoga, skipping, stairs or a home circuit. Run the purifier while you train.',
  },
  exerciseIndoorToday: {
    title: 'Exercise indoors today',
    detail:
      'Yoga, skipping, stairs or a home circuit. Heavy breathing pulls smog deep into the lungs.',
  },
  exerciseMove: {
    title: 'Move your outdoor workout to {time}',
    detail: 'The cleanest part of the day for hard breathing.',
  },
  exerciseMoveSensitive: {
    title: 'Move your outdoor workout to {time}',
    detail: 'Keep it light: sensitive members should avoid hard effort outside.',
  },
  exerciseLight: {
    title: 'Keep outdoor exercise light and short',
    detail: 'There is no meaningfully cleaner time today.',
  },
  exerciseAsUsual: {
    title: 'Exercise outdoors as usual',
    detail: 'The air supports normal activity.',
  },
  carRecirculate: {
    title: 'Windows up, air on recirculate',
    detail: 'Recirculation with a clean cabin filter keeps most traffic smoke out of the car.',
  },
  commuteQuiet: {
    title: 'Commute as usual, on quieter streets',
    detail: 'Side roads often carry much less exhaust than main roads.',
  },
  commuteMask: {
    title: 'Wear a well-fitted N95 on your commute',
    detail:
      'Pinch the nose clip and check the seal. Cloth and surgical masks do little against PM2.5.',
  },
  commuteMetro: {
    title: 'Take the metro if you can; otherwise wear an N95',
    detail:
      'Pinch the nose clip and check the seal. Cloth and surgical masks do little against PM2.5.',
  },
  playIndoor: {
    title: 'Indoor play this afternoon',
    detail: 'Ask school to keep sport indoors at this level.',
  },
  playWindow: {
    title: 'Outdoor play in the clean window',
    detail: 'Children breathe faster than adults, so timing matters most for them.',
  },
  elderWalk: {
    title: 'Indoor walk instead of the evening walk',
    detail: 'Evening air is usually among the worst. A corridor or mall walk keeps the habit.',
  },
  cookBiomass: {
    title: 'Cook with the door open and children out of the kitchen',
    detail: 'See Swaps: a cleaner fuel is the biggest single win for this home.',
  },
  cookGas: {
    title: 'Exhaust on and lids on while cooking',
    detail: 'Keep the fan running for 10 minutes after you finish.',
  },
  heatSafely: {
    title: 'Heat safely tonight',
    detail:
      'Never sleep with a brazier, wood or kerosene heater burning in a closed room. Put it out before bed.',
  },
  purifierNight: {
    title: 'Purifier on high in the bedroom',
    detail: 'Run it for 30 minutes before sleep with the door shut, then on low overnight.',
  },
  doorNight: {
    title: 'Shut the bedroom door before sleep',
    detail: 'Damp-dust surfaces and keep the window closed overnight, when smog peaks.',
  },
} as const satisfies Record<string, Copy>;

export const COMMUNITY_COPY = {
  carpool: {
    title: 'Start a carpool board',
    detail:
      'Pin a sheet in the lobby or start a group chat by office area. Two people per car halves those trips.',
  },
  compost: {
    title: 'No-burning pledge and a shared compost pit',
    detail:
      'Leaves and waste burnt in one lane affect the whole block. A compost pit turns them into soil for the garden.',
  },
  report: { title: 'Report open burning', detail: '{channel}' },
  'clean-room': {
    title: 'Open a clean-air room for older residents',
    detail:
      'One room in the community hall with a purifier and shut windows gives neighbours without one a place to breathe easier.',
  },
  school: {
    title: 'Agree an outdoor-play rule with your school',
    detail: 'Move sport indoors when PM2.5 passes 55 µg/m³, or 35 µg/m³ for children with asthma.',
  },
  neighbours: {
    title: 'Check on vulnerable neighbours',
    detail:
      'Older people living alone and people with lung or heart conditions may need help with errands on the worst days.',
  },
} as const satisfies Record<string, Copy>;

/** Replaces `{name}` placeholders with values. */
export function fill(template: string, values: Record<string, string | number> = {}): string {
  return template.replace(/\{(\w+)\}/g, (match, key: string) =>
    key in values ? String(values[key]) : match,
  );
}
