/**
 * What-if choices for hacks and swaps, as one handler table per kind (open for extension: a new
 * kind is one entry). `current` is the plan's merged choices (engine defaults + user); the user's
 * own overrides are what the UI stores.
 */
import type { Choices, HackChoice, SwapChoice } from './types.js';

interface HackHandler<C extends HackChoice> {
  /** The choices that model this hack on its own. */
  toChoices: (choice: C) => Choices;
  isOn: (choice: C, current: Choices) => boolean;
  toggle: (choice: C, user: Choices, current: Choices, on: boolean) => Choices;
}

type HackHandlers = { [K in HackChoice['kind']]: HackHandler<Extract<HackChoice, { kind: K }>> };

const HACKS: HackHandlers = {
  purifier: {
    toChoices: (c) => ({ purifierCadr: c.cadr }),
    isOn: (c, current) => current.purifierCadr === c.cadr,
    toggle: (c, user, _current, on) => {
      const { purifierCadr: _drop, ...rest } = user;
      return on ? { ...rest, purifierCadr: c.cadr } : rest;
    },
  },
  sealGaps: {
    toChoices: () => ({ sealGaps: true }),
    isOn: (_c, current) => current.sealGaps === true,
    toggle: (_c, user, _current, on) => ({ ...user, sealGaps: on }),
  },
  kitchenExhaust: {
    toChoices: () => ({ kitchenExhaust: true }),
    isOn: (_c, current) => current.kitchenExhaust === true,
    toggle: (_c, user, _current, on) => ({ ...user, kitchenExhaust: on }),
  },
  removeSource: {
    toChoices: (c) => ({ removeSources: [c.source] }),
    isOn: (c, current) => (current.removeSources ?? []).includes(c.source),
    toggle: (c, user, current, on) => {
      const others = (current.removeSources ?? []).filter((s) => s !== c.source);
      return { ...user, removeSources: on ? [...others, c.source] : others };
    },
  },
};

/** The handler for a hack. TypeScript cannot correlate a union with a mapped table by itself. */
const hackHandler = (choice: HackChoice): HackHandler<HackChoice> =>
  HACKS[choice.kind] as HackHandler<HackChoice>;

/** Translates a hack into the what-if choices that model it. */
export const choicesFor = (choice: HackChoice): Choices => hackHandler(choice).toChoices(choice);

/** Whether an indoor hack is currently applied to the plan. */
export const hackIsOn = (choice: HackChoice, current: Choices): boolean =>
  hackHandler(choice).isOn(choice, current);

/** New user choices with a hack switched on or off. */
export const toggleHack = (
  choice: HackChoice,
  user: Choices,
  current: Choices,
  on: boolean,
): Choices => hackHandler(choice).toggle(choice, user, current, on);

type SwapKey = 'mode' | 'carpool' | 'wfhDays' | 'cooking' | 'heating' | 'stopBurning';

/** The single choice field each swap kind sets, and its value. */
const SWAPS: {
  [K in SwapChoice['kind']]: (c: Extract<SwapChoice, { kind: K }>) => [SwapKey, Choices[SwapKey]];
} = {
  mode: (c) => ['mode', c.mode],
  carpool: () => ['carpool', true],
  wfhDays: (c) => ['wfhDays', c.days],
  cooking: (c) => ['cooking', c.fuel],
  heating: (c) => ['heating', c.heating],
  stopBurning: () => ['stopBurning', true],
};

const swapEntry = (choice: SwapChoice): [SwapKey, Choices[SwapKey]] =>
  (SWAPS[choice.kind] as (c: SwapChoice) => [SwapKey, Choices[SwapKey]])(choice);

/** Whether a swap is currently applied to the plan. */
export function swapIsOn(choice: SwapChoice, current: Choices): boolean {
  const [key, value] = swapEntry(choice);
  return current[key] === value;
}

/** New user choices with a swap switched on or off (one commute mode at a time). */
export function toggleSwap(choice: SwapChoice, user: Choices, on: boolean): Choices {
  const [key, value] = swapEntry(choice);
  const { [key]: _previous, ...rest } = user;
  return on ? { ...rest, [key]: value } : rest;
}
