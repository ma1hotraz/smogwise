/** Props shared by the intake fieldsets: a slice of the profile and its change handler. */
import type { Household, Lifestyle } from '../../../shared/schema/profile.js';

export interface FieldsetProps<T> {
  value: T;
  onChange: (next: T) => void;
}

export type HouseholdProps = FieldsetProps<Household>;
export type LifestyleProps = FieldsetProps<Lifestyle>;
