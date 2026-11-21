/** Props shared by the plan tabs that toggle what-if choices. */
import type { Choices, Plan } from '../../../shared/engine/types.js';

export interface PanelProps {
  plan: Plan;
  choices: Choices;
  onChoices: (next: Choices) => void;
}
