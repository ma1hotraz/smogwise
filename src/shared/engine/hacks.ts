/** H01–H11 — indoor air hacks ranked by modelled reduction (docs/03). */
import { INDOOR_SOURCES, type IndoorSource, type Lifestyle } from '../schema/profile.js';
import { INDOOR } from './data/factors.js';
import { homeState, indoorPm, purifierVerdict } from './indoor.js';
import { choicesFor } from './whatIf.js';
import type { Cost, Hack, HackChoice, RuleId } from './types.js';

const SOURCE_HACKS: Record<
  IndoorSource,
  { ruleId: RuleId; title: string; detail: string; cost: Cost }
> = {
  smoking: {
    ruleId: 'H04',
    title: 'Smoke outside, never indoors',
    detail: 'Indoor smoke lingers for hours and reaches children and older relatives first.',
    cost: 'free',
  },
  incense: {
    ruleId: 'H05',
    title: 'Pause incense on smoggy days',
    detail: 'Use flowers, an unlit diffuser or a single short stick by an open kitchen window.',
    cost: 'free',
  },
  mosquitoCoil: {
    ruleId: 'H06',
    title: 'Use a bed net or plug-in repellent instead of coils',
    detail: 'One burning coil can release as much fine particulate as dozens of cigarettes.',
    cost: 'low',
  },
  drySweeping: {
    ruleId: 'H07',
    title: 'Wet-mop instead of dry sweeping',
    detail: 'Dry brooms throw settled dust back into the air you breathe.',
    cost: 'free',
  },
  candles: {
    ruleId: 'H08',
    title: 'Switch candles for LED lights',
    detail: 'Small, but it is free and adds up over a long winter.',
    cost: 'free',
  },
};

/** A hack before its effect is measured; every measurable hack maps to a what-if choice. */
type Candidate = Omit<Hack, 'reductionPct' | 'choice'> & { choice: HackChoice };

function purifierHacks(lifestyle: Lifestyle): Candidate[] {
  const verdict = purifierVerdict(lifestyle.home.roomM2, lifestyle.home.purifierCadr);
  if (verdict.status !== 'none' && verdict.status !== 'undersized') {
    return [];
  }
  const fresh = verdict.status === 'none';
  const hacks: Candidate[] = [
    {
      id: 'purifier',
      ruleId: 'H01',
      title: fresh ? 'Run an air purifier sized for this room' : 'Add purifier capacity',
      detail: `Aim for a clean-air delivery rate (CADR) of at least ${verdict.requiredCadr} m³/h — five air changes an hour for this room. Keep doors and windows shut while it runs.`,
      cost: 'medium',
      choice: { kind: 'purifier', cadr: verdict.requiredCadr },
    },
  ];
  if (fresh) {
    hacks.push({
      id: 'diy',
      ruleId: 'H02',
      title: 'Build a fan-and-filter box',
      detail: `Strap a MERV-13 or HEPA filter to a box or table fan (about ${INDOOR.diyCadr} m³/h). A low-cost stop-gap that genuinely works.`,
      cost: 'low',
      choice: { kind: 'purifier', cadr: INDOOR.diyCadr },
    });
  }
  return hacks;
}

function otherHacks(lifestyle: Lifestyle): Candidate[] {
  const hacks: Candidate[] = [];
  if (lifestyle.home.tightness !== 'sealed') {
    hacks.push({
      id: 'seal',
      ruleId: 'H03',
      title: 'Seal gaps and keep windows shut in the bad hours',
      detail:
        'Draught strips on doors and windows, and close unused vents. Air out only in the clean window.',
      cost: 'low',
      choice: { kind: 'sealGaps' },
    });
  }
  for (const source of INDOOR_SOURCES) {
    if (lifestyle.sources[source]) {
      hacks.push({ id: source, ...SOURCE_HACKS[source], choice: { kind: 'removeSource', source } });
    }
  }
  if (lifestyle.cooking === 'lpg') {
    hacks.push({
      id: 'exhaust',
      ruleId: 'H09',
      title: 'Exhaust fan on and lids on pots while cooking',
      detail:
        'Cooking is the biggest indoor spike in most homes. Run the chimney or fan for 10 minutes after, too.',
      cost: 'free',
      choice: { kind: 'kitchenExhaust' },
    });
  }
  return hacks;
}

const MYTHS: Hack[] = [
  {
    id: 'ionisers',
    ruleId: 'H10',
    title: 'Skip ionisers and "ozone" air cleaners',
    detail:
      'Some release ozone, a lung irritant. Choose a filter (HEPA) purifier with a stated CADR.',
    cost: 'none',
    reductionPct: null,
    choice: null,
  },
  {
    id: 'plants',
    ruleId: 'H11',
    title: 'Houseplants will not clean the air',
    detail:
      'You would need hundreds per room to match one small purifier (Cummings & Waring, 2019). Enjoy them for other reasons.',
    cost: 'none',
    reductionPct: null,
    choice: null,
  },
];

/** Hacks that reduce this home's daily-average PM2.5, ranked by modelled reduction, then myths. */
export function indoorHacks(lifestyle: Lifestyle, outdoorMean: number): Hack[] {
  const before = indoorPm(outdoorMean, homeState(lifestyle));
  const measured = [...purifierHacks(lifestyle), ...otherHacks(lifestyle)].map((hack) => {
    const after = indoorPm(outdoorMean, homeState(lifestyle, choicesFor(hack.choice)));
    return { ...hack, reductionPct: Math.round((1 - after / Math.max(before, 1e-9)) * 100) };
  });
  // Only recommend what helps here: sealing a home can trap indoor smoke when outdoor air is clean.
  const helpful = measured.filter((hack) => hack.reductionPct > 0);
  helpful.sort((a, b) => b.reductionPct - a.reductionPct);
  return [...helpful, ...MYTHS];
}
