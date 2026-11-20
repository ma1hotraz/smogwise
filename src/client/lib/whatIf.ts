/**
 * Maps swap and hack cards to what-if choices (docs/03 "Choices"). `current` is the plan's merged
 * choices (engine defaults + user); the user's own overrides are what we store.
 */
import type { Choices, HackChoice, SwapChoice } from '../../shared/engine/types.js';

type SwapKey = 'mode' | 'carpool' | 'wfhDays' | 'cooking' | 'heating' | 'stopBurning';

/** The single choice field a swap sets, and its value. */
function swapEntry(choice: SwapChoice): [SwapKey, Choices[SwapKey]] {
  switch (choice.kind) {
    case 'mode':
      return ['mode', choice.mode];
    case 'wfhDays':
      return ['wfhDays', choice.days];
    case 'cooking':
      return ['cooking', choice.fuel];
    case 'heating':
      return ['heating', choice.heating];
    default:
      return [choice.kind, true];
  }
}

/** Whether a swap is currently applied to the plan. */
export function swapIsOn(choice: SwapChoice, current: Choices): boolean {
  const [key, value] = swapEntry(choice);
  return current[key] === value;
}

/** New user choices with a swap switched on or off (one commute mode at a time). */
export function toggleSwap(choice: SwapChoice, user: Choices, on: boolean): Choices {
  const [key, value] = swapEntry(choice);
  const rest = Object.fromEntries(Object.entries(user).filter(([k]) => k !== key)) as Choices;
  return on ? { ...rest, [key]: value } : rest;
}

/** Whether an indoor hack is currently applied to the plan. */
export function hackIsOn(choice: HackChoice, current: Choices): boolean {
  switch (choice.kind) {
    case 'purifier':
      return current.purifierCadr === choice.cadr;
    case 'sealGaps':
      return current.sealGaps === true;
    case 'removeSource':
      return (current.removeSources ?? []).includes(choice.source);
    case 'kitchenExhaust':
      return current.kitchenExhaust === true;
  }
}

/** New user choices with a hack switched on or off. */
export function toggleHack(
  choice: HackChoice,
  user: Choices,
  current: Choices,
  on: boolean,
): Choices {
  switch (choice.kind) {
    case 'purifier': {
      const { purifierCadr: _drop, ...rest } = user;
      return on ? { ...rest, purifierCadr: choice.cadr } : rest;
    }
    case 'sealGaps':
      return { ...user, sealGaps: on };
    case 'kitchenExhaust':
      return { ...user, kitchenExhaust: on };
    case 'removeSource': {
      const base = (current.removeSources ?? []).filter((s) => s !== choice.source);
      return { ...user, removeSources: on ? [...base, choice.source] : base };
    }
  }
}
